import { clientDb } from '@/shared/utils';
import { globalLogger as Logger } from '@/shared/utils/logger';
import { NotificationService } from '@/shared/utils/notification.service';
import { IUsecaseResponse } from '@/shared/utils/rest-api/types';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { BookingStatus, FundingSource, Prisma, RealtimeStatus, VerifyStatus } from '@prisma/client';
import { IFinanceReceiptItem } from '../domain/entities';
import { ICloseTripResponse, IVerifyItemResponse } from '../domain/response';
import { CloseTripDto } from '../dto/close-trip.dto';
import { VerificationAction, VerifyItemDto } from '../dto/verify-item.dto';
import { FinanceRepositoryPort } from '../ports/repository.port';
import { FinanceUsecasePort } from '../ports/usecase.port';

@Injectable()
export class FinanceUseCase implements FinanceUsecasePort {
  private readonly db = clientDb;

  constructor(
    @Inject('FinanceRepositoryPort')
    private readonly repository: FinanceRepositoryPort,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Generate unique ticket number
   * Format: {PREFIX}-YYYYMMDD-{RANDOM}
   * Example: REIMB-20241224-A1B2C3, REPLEN-20241224-A1B2C3
   */
  private async generateTicketNumber(prefix: string, retryCount = 0): Promise<string> {
    const MAX_RETRIES = 10;

    if (retryCount >= MAX_RETRIES) {
      throw new Error(`Failed to generate unique ticket number after ${MAX_RETRIES} attempts`);
    }

    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const datePrefix = `${year}${month}${day}`;

    const randomChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let randomPart = '';
    for (let i = 0; i < 6; i++) {
      randomPart += randomChars.charAt(Math.floor(Math.random() * randomChars.length));
    }

    const ticketNumber = `${prefix}-${datePrefix}-${randomPart}`;

    // Check if ticket number already exists
    const existing = await this.db.verificationHeader.findFirst({
      where: {
        OR: [{ reimburseTicket: ticketNumber }, { replenishTicket: ticketNumber }],
      },
    });

    if (existing) {
      Logger.warn(
        `Ticket number ${ticketNumber} already exists, retrying... (attempt ${retryCount + 1}/${MAX_RETRIES})`,
        'FinanceUseCase.generateTicketNumber',
      );
      return this.generateTicketNumber(prefix, retryCount + 1);
    }

    return ticketNumber;
  }

  /**
   * Check for duplicate receipt based on hash, amount, and date
   */
  private async checkDuplicateReceipt(
    dupHash: string,
    amountIdr: number,
    receiptDate: Date,
    excludeItemId?: number,
  ): Promise<{ isDuplicate: boolean; duplicateItems: IFinanceReceiptItem[] }> {
    try {
      // Check by hash first (most reliable)
      const itemsByHash = await this.repository.findReceiptItemsByHash(dupHash, excludeItemId);
      if (itemsByHash.length > 0) {
        return { isDuplicate: true, duplicateItems: itemsByHash };
      }

      // Check by amount and date (within same day) as secondary check
      const startOfDay = new Date(receiptDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(receiptDate);
      endOfDay.setHours(23, 59, 59, 999);

      const itemsByAmountDate = await this.db.receiptItem.findMany({
        where: {
          amountIdr,
          receiptDate: {
            gte: startOfDay,
            lte: endOfDay,
          },
          deletedAt: null,
          ...(excludeItemId ? { id: { not: excludeItemId } } : {}),
        },
        include: {
          verification: {
            include: {
              segmentExecution: {
                include: {
                  segment: {
                    include: {
                      booking: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (itemsByAmountDate.length > 0) {
        return { isDuplicate: true, duplicateItems: itemsByAmountDate };
      }

      return { isDuplicate: false, duplicateItems: [] };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in checkDuplicateReceipt',
        error instanceof Error ? error.stack : undefined,
        'FinanceUseCase.checkDuplicateReceipt',
      );
      return { isDuplicate: false, duplicateItems: [] };
    }
  }

  /**
   * Verify receipt item by GA
   */
  verifyItem = async (
    itemId: number,
    dto: VerifyItemDto,
    userId: string,
  ): Promise<IUsecaseResponse<IVerifyItemResponse>> => {
    try {
      // 1. Get receipt item with all relations
      const receiptItem = await this.repository.findReceiptItemById(itemId);
      if (!receiptItem) {
        return {
          error: {
            message: 'Receipt item not found',
            code: HttpStatus.NOT_FOUND,
          },
        };
      }

      // 2. Validate notes for REJECT or EDIT action
      if (
        (dto.action === VerificationAction.REJECT || dto.action === VerificationAction.EDIT) &&
        (!dto.notes || dto.notes.length < 10)
      ) {
        return {
          error: {
            message: 'Notes is required and must be at least 10 characters for REJECT or EDIT action',
            code: HttpStatus.BAD_REQUEST,
          },
        };
      }

      // 3. SoD Check: Verifier should not be the same as uploader
      if (receiptItem.createdBy === userId) {
        Logger.warn(
          `User ${userId} attempting to verify their own receipt item ${itemId}. SoD violation.`,
          'FinanceUseCase.verifyItem',
        );
        // Allow but log warning (can be made strict if needed)
      }

      // 4. Get verification header
      const verificationHeader = receiptItem.verification;
      if (!verificationHeader) {
        return {
          error: {
            message: 'Verification header not found',
            code: HttpStatus.NOT_FOUND,
          },
        };
      }

      // 5. Store before state for audit
      const beforeState = {
        fundingSource: receiptItem.fundingSource,
        gaNote: receiptItem.gaNote,
        action: dto.action,
      };

      // 6. Handle duplicate check
      if (receiptItem.dupHash) {
        const duplicateCheck = await this.checkDuplicateReceipt(
          receiptItem.dupHash,
          receiptItem.amountIdr,
          receiptItem.receiptDate,
          itemId,
        );

        if (duplicateCheck.isDuplicate && dto.action === VerificationAction.APPROVE) {
          Logger.warn(
            `Duplicate receipt detected for item ${itemId}. Hash: ${receiptItem.dupHash}`,
            'FinanceUseCase.verifyItem',
          );
          // Still allow but log warning
        }
      }

      // 7. Update receipt item based on action
      const updateData: Prisma.ReceiptItemUpdateInput = {
        fundingSource: dto.sourceFund,
        gaNote: dto.notes || null,
        updatedBy: userId,
        updatedAt: new Date(),
      };

      // If REJECT, mark as deleted (soft delete)
      if (dto.action === VerificationAction.REJECT) {
        updateData.deletedAt = new Date();
        updateData.deletedBy = userId;
      }

      await this.repository.updateReceiptItem(itemId, updateData);

      // 8. Handle funding source specific logic
      let reimburseTicket: string | null = null;
      let replenishTicket: string | null = null;

      if (dto.action === VerificationAction.APPROVE) {
        // Cash Driver: Check driver wallet and create replenish ticket if needed
        if (dto.sourceFund === FundingSource.DRIVER_CASH) {
          const segmentExecution = verificationHeader.segmentExecution;
          const assignment = segmentExecution?.segment?.booking?.assignment;
          const driver = assignment?.driverChosen;

          if (driver) {
            // TODO: Implement driver wallet balance check
            // For now, we'll create replenish ticket if not exists
            if (!verificationHeader.replenishTicket) {
              replenishTicket = await this.generateTicketNumber('REPLEN');
              await this.repository.updateVerificationHeader(verificationHeader.id, {
                replenishTicket,
                updatedBy: userId,
              });
            } else {
              replenishTicket = verificationHeader.replenishTicket;
            }

            // TODO: Deduct from driver wallet balance
            // await this.updateDriverWallet(driver.id, -receiptItem.amountIdr);
          }
        }

        // Mode-B: Create reimburse ticket
        if (dto.sourceFund === FundingSource.MODE_B) {
          if (!verificationHeader.reimburseTicket) {
            reimburseTicket = await this.generateTicketNumber('REIMB');
            await this.repository.updateVerificationHeader(verificationHeader.id, {
              reimburseTicket,
              updatedBy: userId,
            });
          } else {
            reimburseTicket = verificationHeader.reimburseTicket;
          }
        }
      }

      // 9. Create audit log
      await this.repository.createAuditLog({
        userNik: userId,
        featureCode: 'FR-FIN-002',
        action: `VERIFY_ITEM_${dto.action}`,
        entityType: 'ReceiptItem',
        entityId: itemId,
        beforeAfter: {
          before: beforeState,
          after: {
            fundingSource: dto.sourceFund,
            gaNote: dto.notes,
            action: dto.action,
            reimburseTicket,
            replenishTicket,
          },
        },
        reasonCode:
          dto.action === VerificationAction.REJECT
            ? 'REJECTED'
            : dto.action === VerificationAction.EDIT
              ? 'EDITED'
              : 'APPROVED',
      });

      return {
        data: {
          itemId,
          action: dto.action,
          fundingSource: dto.sourceFund,
          reimburseTicket,
          replenishTicket,
          message: `Receipt item ${dto.action.toLowerCase()}d successfully`,
        },
      };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in verifyItem',
        error instanceof Error ? error.stack : undefined,
        'FinanceUseCase.verifyItem',
      );
      return {
        error: {
          message: error instanceof Error ? error.message : 'Failed to verify receipt item',
          code: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  };

  /**
   * Close trip with validation
   */
  closeTrip = async (
    executionId: number,
    dto: CloseTripDto,
    userId: string,
  ): Promise<IUsecaseResponse<ICloseTripResponse>> => {
    try {
      // 1. Get segment execution with all relations
      const segmentExecution = await this.repository.findSegmentExecutionById(executionId);
      if (!segmentExecution) {
        return {
          error: {
            message: 'Segment execution not found',
            code: HttpStatus.NOT_FOUND,
          },
        };
      }

      // 2. Get verification header
      const verificationHeader = await this.repository.findVerificationHeaderByExecutionId(executionId);
      if (!verificationHeader) {
        return {
          error: {
            message: 'Verification header not found. Please verify execution first.',
            code: HttpStatus.BAD_REQUEST,
          },
        };
      }

      // 3. Guard: Completeness Check
      // All receipt items must be verified (not rejected, not in review)
      const receiptItems = verificationHeader.receiptItems || [];
      const unverifiedItems = receiptItems.filter((item: Prisma.ReceiptItemGetPayload<{}>) => {
        // Check if item is rejected (deleted) or has no funding source set
        return item.deletedAt || !item.fundingSource;
      });

      if (unverifiedItems.length > 0) {
        return {
          error: {
            message: `Cannot close trip. ${unverifiedItems.length} receipt item(s) are not verified or rejected.`,
            code: HttpStatus.BAD_REQUEST,
          },
        };
      }

      // Verification status must be IN_REVIEW or VERIFIED (if already closed once)
      if (
        verificationHeader.verifyStatus !== VerifyStatus.IN_REVIEW &&
        verificationHeader.verifyStatus !== VerifyStatus.VERIFIED
      ) {
        return {
          error: {
            message: `Cannot close trip. Verification status is ${verificationHeader.verifyStatus}, must be IN_REVIEW or VERIFIED.`,
            code: HttpStatus.BAD_REQUEST,
          },
        };
      }

      // 4. Guard: Anomaly Check
      if (segmentExecution.anomalyFlags && Object.keys(segmentExecution.anomalyFlags).length > 0) {
        if (!verificationHeader.anomalyHandled) {
          return {
            error: {
              message: 'Cannot close trip. Anomaly flags detected and not yet handled by GA.',
              code: HttpStatus.BAD_REQUEST,
            },
          };
        }
      }

      // 6. Calculate cost comparison (actual vs estimated)
      const actualCost = receiptItems.reduce(
        (sum: number, item: Prisma.ReceiptItemGetPayload<{}>) => sum + item.amountIdr,
        0,
      );

      // TODO: Get estimated cost from Master Variabel Biaya (FR-SET-008)
      // This should calculate estimated cost based on:
      // - Route distance (from booking segments)
      // - Cost variables (fuel consumption, toll rates, parking rates, etc.)
      // - Service type and vehicle type
      // For now, we'll return actual cost only
      const estimatedCost = 0; // Placeholder - to be implemented with cost-variable integration

      // Calculate cost breakdown by category
      const costByCategory = receiptItems.reduce(
        (acc: Record<string, { count: number; totalAmount: number }>, item: Prisma.ReceiptItemGetPayload<{}>) => {
          const category = item.category;
          if (!acc[category]) {
            acc[category] = { count: 0, totalAmount: 0 };
          }
          acc[category].count += 1;
          acc[category].totalAmount += item.amountIdr;
          return acc;
        },
        {},
      );

      // 7. Generate tickets if needed
      let reimburseTicket = verificationHeader.reimburseTicket;
      let replenishTicket = verificationHeader.replenishTicket;

      // Check if Mode-B items exist but no reimburse ticket
      const hasModeBItems = receiptItems.some(
        (item: Prisma.ReceiptItemGetPayload<{}>) => item.fundingSource === FundingSource.MODE_B,
      );
      if (hasModeBItems && !reimburseTicket) {
        reimburseTicket = await this.generateTicketNumber('REIMB');
      }

      // Check if Driver Cash items exist but no replenish ticket
      const hasDriverCashItems = receiptItems.some((item) => item.fundingSource === FundingSource.DRIVER_CASH);
      if (hasDriverCashItems && !replenishTicket) {
        replenishTicket = await this.generateTicketNumber('REPLEN');
      }

      // Update verification header with tickets and final status
      await this.repository.updateVerificationHeader(verificationHeader.id, {
        reimburseTicket: reimburseTicket || verificationHeader.reimburseTicket,
        replenishTicket: replenishTicket || verificationHeader.replenishTicket,
        verifyStatus: VerifyStatus.VERIFIED,
        verifiedAt: new Date(),
        verifierId: userId,
        updatedBy: userId,
      });

      // 8. Update booking and segment status to Finished/Closed
      const booking = segmentExecution.segment?.booking;
      if (booking) {
        // Update Host Booking
        await this.repository.updateBooking(booking.id, {
          bookingStatus: BookingStatus.FINISHED,
          updatedBy: userId,
        });

        // Update Driver Status to Idle
        const driverId = booking.assignment?.driverChosenId;
        if (driverId) {
          await this.repository.updateDriver(driverId, {
            realtimeStatus: RealtimeStatus.Idle,
            updatedBy: userId,
          });
          Logger.info(`Driver ${driverId} status updated to Idle`, 'FinanceUseCase.closeTrip');
        }

        // Update Carpool Joiner Bookings (if any)
        if (booking.carpoolGroupId) {
          await this.repository.updateManyBookings(
            {
              carpoolGroupId: booking.carpoolGroupId,
              bookingStatus: { not: BookingStatus.FINISHED },
              deletedAt: null,
            },
            {
              bookingStatus: BookingStatus.FINISHED,
              updatedBy: userId,
            },
          );
          Logger.info(
            `Carpool Group ${booking.carpoolGroupId} joiner bookings marked as FINISHED`,
            'FinanceUseCase.closeTrip',
          );
        }
      }

      // Update segment status if needed
      // Note: Segment status might need to be updated separately if there's a status field

      // 9. Create audit log
      await this.repository.createAuditLog({
        userNik: userId,
        featureCode: 'FR-TRP-004',
        action: 'CLOSE_TRIP',
        entityType: 'SegmentExecution',
        entityId: executionId,
        beforeAfter: {
          before: {
            status: segmentExecution.status,
            verifyStatus: verificationHeader.verifyStatus,
          },
          after: {
            status: 'FINISHED',
            verifyStatus: VerifyStatus.VERIFIED,
            reimburseTicket,
            replenishTicket,
          },
        },
        reasonCode: 'TRIP_CLOSED',
      });

      // 10. Send notifications
      try {
        if (booking) {
          const requester = booking.requester;
          const assignment = booking.assignment;
          const driver = assignment?.driverChosen;

          // Notify requester
          if (requester?.email) {
            await this.notificationService.sendEmail({
              to: requester.email,
              subject: 'Trip Closed',
              body: `Your trip ${booking.bookingNumber} has been closed and verified.`,
            });
          }

          // Notify driver
          const driverEmail = driver?.employee?.email;
          if (driverEmail) {
            await this.notificationService.sendEmail({
              to: driverEmail,
              subject: 'Trip Closed',
              body: `Trip ${booking.bookingNumber} has been closed and verified.`,
            });
          }

          // TODO: Send WA notifications if needed
        }
      } catch (notifError) {
        Logger.warn(
          `Failed to send notifications: ${notifError instanceof Error ? notifError.message : 'Unknown error'}`,
          'FinanceUseCase.closeTrip',
        );
        // Don't fail the close trip operation if notification fails
      }

      return {
        data: {
          executionId,
          bookingId: booking?.id,
          status: 'CLOSED',
          actualCost,
          estimatedCost,
          costDifference: actualCost - estimatedCost,
          costByCategory,
          reimburseTicket,
          replenishTicket,
          receiptCount: receiptItems.length,
          message: 'Trip closed successfully',
        },
      };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in closeTrip',
        error instanceof Error ? error.stack : undefined,
        'FinanceUseCase.closeTrip',
      );
      return {
        error: {
          message: error instanceof Error ? error.message : 'Failed to close trip',
          code: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  };
}
