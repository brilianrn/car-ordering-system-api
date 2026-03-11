import { clientDb } from '@/shared/utils';
import { globalLogger as Logger } from '@/shared/utils/logger';
import { NotificationService } from '@/shared/utils/notification.service';
import { IUsecaseResponse } from '@/shared/utils/rest-api/types';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { BookingStatus, FundingSource, Prisma, RealtimeStatus, VerifyStatus } from '@prisma/client';
import { IFinanceReceiptItem } from '../domain/entities';
import { ICloseTripResponse, IVerifyItemResponse } from '../domain/response';
import { BulkVerifyDto } from '../dto/bulk-verify.dto';
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

      // 2. Validate rejection reason for REJECT action
      const finalRejectionReason = dto.rejectionReason || dto.notes;
      if (dto.action === VerificationAction.REJECT && (!finalRejectionReason || finalRejectionReason.length < 5)) {
        return {
          error: {
            message: 'Rejection reason is required and must be at least 5 characters for REJECT action',
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
        status: receiptItem.status,
        amountIdr: receiptItem.amountIdr,
        category: receiptItem.category,
        receiptDate: receiptItem.receiptDate,
      };

      // 6. Update receipt item based on action
      const updateData: any = {
        updatedBy: userId,
        updatedAt: new Date(),
        gaNote: dto.notes ?? receiptItem.gaNote,
      };

      if (dto.action === VerificationAction.REJECT) {
        updateData.status = 'REJECTED';
        updateData.rejectionReason = finalRejectionReason;

        // Atomic Status Reversion:
        // REMOVED: Status isolation. Booking status remains in COMPLETED/ASSIGNED/etc.
        // Rejection only affects the ReceiptItem level.
      } else if (dto.action === VerificationAction.APPROVE) {
        updateData.status = 'APPROVED';
        updateData.rejectionReason = null; // Clear rejection reason on approval

        // Use sourceFund if provided, otherwise fallback to defaultFundingSource, then existing value, then DRIVER_CASH as final fallback
        updateData.fundingSource =
          dto.sourceFund || dto.defaultFundingSource || receiptItem.fundingSource || FundingSource.DRIVER_CASH;

        // Set isAffectingDriverBalance based on funding source and category
        // If it's a vendor-related item or funding source is COMPANY_TO_VENDOR, it doesn't affect driver balance
        if (
          updateData.fundingSource === FundingSource.COMPANY_TO_VENDOR ||
          updateData.fundingSource === FundingSource.VENDOR
        ) {
          updateData.isAffectingDriverBalance = false;
        } else {
          updateData.isAffectingDriverBalance = true;
        }

        // Apply revisions if provided during approval (Direct Revision)
        if (dto.amountIdr) updateData.amountIdr = dto.amountIdr;
        if (dto.category) updateData.category = dto.category;
        if (dto.receiptDate) updateData.receiptDate = dto.receiptDate;
      } else if (dto.action === VerificationAction.EDIT) {
        // Just revision without final approval
        if (dto.amountIdr) updateData.amountIdr = dto.amountIdr;
        if (dto.category) updateData.category = dto.category;
        if (dto.receiptDate) updateData.receiptDate = dto.receiptDate;
        if (dto.sourceFund) updateData.fundingSource = dto.sourceFund;
      }

      await this.db.receiptItem.update({
        where: { id: itemId },
        data: updateData,
      });

      // 6.b Sync VerificationHeader status
      // If all items are APPROVED, set header to VERIFIED
      const allItems = await this.db.receiptItem.findMany({
        where: { verifyId: verificationHeader.id, deletedAt: null },
      });

      const allApproved = allItems.every((item) => item.status === 'APPROVED');
      if (allApproved && allItems.length > 0) {
        await this.db.verificationHeader.update({
          where: { id: verificationHeader.id },
          data: {
            verifyStatus: VerifyStatus.VERIFIED,
            verifiedAt: new Date(),
            updatedBy: userId,
          },
        });
        Logger.info(
          `VerificationHeader ${verificationHeader.id} automatically marked VERIFIED`,
          'FinanceUseCase.verifyItem',
        );
      } else {
        // If not all approved (e.g. some pending or rejected), ensure it's IN_REVIEW
        if (verificationHeader.verifyStatus !== VerifyStatus.IN_REVIEW) {
          await this.db.verificationHeader.update({
            where: { id: verificationHeader.id },
            data: {
              verifyStatus: VerifyStatus.IN_REVIEW,
              updatedBy: userId,
            },
          });
        }
      }

      // 6.c Auto-Close Logic (Final Item Detection)
      // Check if this was the last item that needed processing (PENDING)
      const remainingItems = allItems.filter((item) => item.id !== itemId && item.status === 'PENDING');

      if (remainingItems.length === 0) {
        const executionId = verificationHeader.segmentExecutionId;
        if (executionId) {
          Logger.info(
            `Auto-closing trip for execution ${executionId} as last item ${itemId} was processed`,
            'FinanceUseCase.verifyItem',
          );
          await this.finalizeTripRecords(executionId, userId);
        }
      }

      // 7. Handle funding source specific logic for APPROVE
      let reimburseTicket: string | null = null;
      let replenishTicket: string | null = null;

      if (dto.action === VerificationAction.APPROVE) {
        const finalFundingSource = updateData.fundingSource;

        // Cash Driver: Check driver wallet and create replenish ticket if needed
        if (finalFundingSource === FundingSource.DRIVER_CASH) {
          const segmentExecution = verificationHeader.segmentExecution;
          const assignment = segmentExecution?.segment?.booking?.assignment;
          const driver = assignment?.driverChosen;

          if (driver) {
            if (!verificationHeader.replenishTicket) {
              replenishTicket = await this.generateTicketNumber('REPLEN');
              await this.repository.updateVerificationHeader(verificationHeader.id, {
                replenishTicket,
                updatedBy: userId,
              });
            } else {
              replenishTicket = verificationHeader.replenishTicket;
            }
          }
        }

        // Mode-B: Create reimburse ticket
        if (finalFundingSource === FundingSource.MODE_B) {
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

        // Company to Vendor / Vendor: Skip driver tickets
        if (finalFundingSource === FundingSource.COMPANY_TO_VENDOR || finalFundingSource === FundingSource.VENDOR) {
          Logger.info(
            `Skipping driver ticket generation for ${finalFundingSource} item ${itemId}`,
            'FinanceUseCase.verifyItem',
          );
        }
      }

      // 8. Create audit log
      await this.repository.createAuditLog({
        userNik: userId,
        featureCode: 'FR-FIN-002',
        action: `VERIFY_ITEM_${dto.action}`,
        entityType: 'ReceiptItem',
        entityId: itemId,
        beforeAfter: {
          before: beforeState,
          after: {
            ...updateData,
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
          fundingSource: updateData.fundingSource || receiptItem.fundingSource,
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
      // All receipt items must be APPROVED
      const receiptItems = verificationHeader.receiptItems || [];
      const unapprovedItems = receiptItems.filter((item: any) => {
        return item.status !== 'APPROVED' || item.deletedAt;
      });

      if (unapprovedItems.length > 0) {
        return {
          error: {
            message: `Cannot close trip. ${unapprovedItems.length} receipt item(s) are not approved (either pending, rejected, or deleted).`,
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
          // As per request, we allow closing the trip despite unhandled anomalies.
          // We only log a warning here. Frontend will handle user warnings.
          Logger.warn(
            `Closing trip with unhandled anomaly flags for execution ID: ${executionId}`,
            'FinanceUseCase.closeTrip',
          );
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
        (item: any) => item.fundingSource === FundingSource.MODE_B && item.isAffectingDriverBalance,
      );
      if (hasModeBItems && !reimburseTicket) {
        reimburseTicket = await this.generateTicketNumber('REIMB');
      }

      // Check if Driver Cash items exist but no replenish ticket
      const hasDriverCashItems = receiptItems.some(
        (item: any) => item.fundingSource === FundingSource.DRIVER_CASH && item.isAffectingDriverBalance,
      );
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
      await this.sendTripClosedNotifications(segmentExecution.segment?.booking);

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

  /**
   * Refactored shared logic to finalize trip records
   * Updates booking status, driver status, carpool bookings, generates final tickets, and sends notifications.
   */
  private async finalizeTripRecords(executionId: number, userId: string): Promise<void> {
    const verificationHeader = await this.repository.findVerificationHeaderByExecutionId(executionId);
    if (!verificationHeader) return;

    const segmentExecution = await this.repository.findSegmentExecutionById(executionId);
    if (!segmentExecution) return;

    const receiptItems = verificationHeader.receiptItems || [];

    // 1. Generate final tickets if missing
    let reimburseTicket = verificationHeader.reimburseTicket;
    let replenishTicket = verificationHeader.replenishTicket;

    const hasModeBItems = receiptItems.some(
      (item: any) => item.fundingSource === FundingSource.MODE_B && item.isAffectingDriverBalance,
    );
    if (hasModeBItems && !reimburseTicket) {
      reimburseTicket = await this.generateTicketNumber('REIMB');
    }

    const hasDriverCashItems = receiptItems.some(
      (item: any) => item.fundingSource === FundingSource.DRIVER_CASH && item.isAffectingDriverBalance,
    );
    if (hasDriverCashItems && !replenishTicket) {
      replenishTicket = await this.generateTicketNumber('REPLEN');
    }

    // 2. Update verification header
    await this.repository.updateVerificationHeader(verificationHeader.id, {
      reimburseTicket: reimburseTicket || verificationHeader.reimburseTicket,
      replenishTicket: replenishTicket || verificationHeader.replenishTicket,
      verifyStatus: VerifyStatus.VERIFIED,
      verifiedAt: new Date(),
      verifierId: userId,
      updatedBy: userId,
    });

    // 3. Update booking and segment status
    const booking = segmentExecution.segment?.booking;
    if (booking) {
      await this.repository.updateBooking(booking.id, {
        bookingStatus: BookingStatus.FINISHED,
        updatedBy: userId,
      });

      const driverId = booking.assignment?.driverChosenId;
      if (driverId) {
        await this.repository.updateDriver(driverId, {
          realtimeStatus: RealtimeStatus.Idle,
          updatedBy: userId,
        });
      }

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
      }
    }

    // 4. Audit Log
    await this.repository.createAuditLog({
      userNik: userId,
      featureCode: 'FR-TRP-004',
      action: 'AUTO_CLOSE_TRIP',
      entityType: 'SegmentExecution',
      entityId: executionId,
      beforeAfter: {
        before: { status: segmentExecution.status, verifyStatus: verificationHeader.verifyStatus },
        after: {
          status: 'FINISHED',
          verifyStatus: VerifyStatus.VERIFIED,
          reimburseTicket,
          replenishTicket,
        },
      },
      reasonCode: 'TRIP_AUTO_CLOSED',
    });

    // 5. Notifications
    await this.sendTripClosedNotifications(booking);
  }

  /**
   * Helper to send notifications when a trip is closed
   */
  private async sendTripClosedNotifications(booking: any): Promise<void> {
    if (!booking) return;
    try {
      const requester = booking.requester;
      const driver = booking.assignment?.driverChosen;

      if (requester?.email) {
        await this.notificationService.sendEmail({
          to: requester.email,
          subject: 'Trip Closed',
          body: `Your trip ${booking.bookingNumber} has been closed and verified.`,
        });
      }

      const driverEmail = driver?.employee?.email;
      if (driverEmail) {
        await this.notificationService.sendEmail({
          to: driverEmail,
          subject: 'Trip Closed',
          body: `Trip ${booking.bookingNumber} has been closed and verified.`,
        });
      }
    } catch (notifError) {
      Logger.warn(
        `Failed to send notifications: ${notifError instanceof Error ? notifError.message : 'Unknown error'}`,
        'FinanceUseCase.sendTripClosedNotifications',
      );
    }
  }

  /**
   * Bulk approve all receipt items under a VerificationHeader and finalize the header.
   * Wrapped in a Prisma $transaction for atomicity.
   */
  bulkVerify = async (dto: BulkVerifyDto, userId: string): Promise<IUsecaseResponse<any>> => {
    try {
      // 1. Load the verification header (idempotency check)
      const verificationHeader = await this.db.verificationHeader.findUnique({
        where: { id: dto.verificationHeaderId },
        include: {
          receiptItems: { where: { deletedAt: null } },
          segmentExecution: {
            include: {
              segment: {
                include: { booking: { select: { id: true, bookingStatus: true } } },
              },
            },
          },
        },
      });

      if (!verificationHeader) {
        return {
          error: {
            message: `Verification header ID ${dto.verificationHeaderId} not found`,
            code: HttpStatus.NOT_FOUND,
          },
        };
      }

      // 2. Idempotency guard: reject if already completed
      if (verificationHeader.verifyStatus === VerifyStatus.VERIFIED) {
        return {
          error: {
            message: 'Verification already completed. Cannot bulk verify again.',
            code: HttpStatus.BAD_REQUEST,
          },
        };
      }

      Logger.info(
        `[bulkVerify] Starting bulk verify for header ${dto.verificationHeaderId} with ${verificationHeader.receiptItems.length} items`,
        'FinanceUseCase.bulkVerify',
      );

      // 3. Atomic transaction: update all items + header in one shot
      const now = new Date();
      const updatedHeader = await this.db.$transaction(async (tx) => {
        // 3a. Mark every receipt item as APPROVED
        if (verificationHeader.receiptItems.length > 0) {
          await tx.receiptItem.updateMany({
            where: {
              verifyId: dto.verificationHeaderId,
              deletedAt: null,
            },
            data: {
              status: 'APPROVED',
              gaNote: `APPROVED via Bulk by ${userId} at ${now.toISOString()}`,
              updatedBy: userId,
            },
          });
        }

        // 3b. Close the VerificationHeader
        const header = await tx.verificationHeader.update({
          where: { id: dto.verificationHeaderId },
          data: {
            verifyStatus: VerifyStatus.VERIFIED,
            verifiedAt: now,
            reimburseTicket: dto.reimburseTicket ?? null,
            replenishTicket: dto.replenishTicket ?? null,
            updatedBy: userId,
          },
          include: { receiptItems: true },
        });

        // 3c. If bulk verifying, the header is now VERIFIED, we might should check if the trip can be closed.
        // But closeTrip is a separate endpoint usually.
        // Actually, if it's bulk approved, everything is approved, so it stays VERIFIED.

        return header;
      });

      Logger.info(
        `[bulkVerify] SUCCESS - header ${dto.verificationHeaderId} marked VERIFIED`,
        'FinanceUseCase.bulkVerify',
      );

      return { data: updatedHeader };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in bulkVerify',
        error instanceof Error ? error.stack : undefined,
        'FinanceUseCase.bulkVerify',
      );
      return {
        error: {
          message: error instanceof Error ? error.message : 'Failed to bulk verify receipts',
          code: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  };
}
