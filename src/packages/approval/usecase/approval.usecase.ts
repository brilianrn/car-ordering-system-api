import { IBookingWithRelations } from '@/packages/bookings/domain/entities';
import { transformBookingWithPresignedUrls } from '@/packages/bookings/domain/helpers/presigned-url.helper';
import { IBooking, IBookingListResponse } from '@/packages/bookings/domain/response';
import { S3Service } from '@/shared/utils';
import { globalLogger as Logger } from '@/shared/utils/logger';
import { NotificationService } from '@/shared/utils/notification.service';
import { IUsecaseResponse } from '@/shared/utils/rest-api/types';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ApprovalStatus, BookingStatus, Prisma } from '@prisma/client';
import { ApproveBookingDto } from '../dto/approve-booking.dto';
import { ApprovalLevel, QueryApprovalListDto } from '../dto/query-approval-list.dto';
import { ApprovalRepositoryPort } from '../ports/repository.port';
import { ApprovalUsecasePort } from '../ports/usecase.port';

@Injectable()
export class ApprovalUseCase implements ApprovalUsecasePort {
  constructor(
    @Inject('ApprovalRepositoryPort')
    private readonly repository: ApprovalRepositoryPort,
    private readonly s3Service: S3Service,
    private readonly notificationService: NotificationService,
  ) {}

  approveBooking = async (id: number, dto: ApproveBookingDto, user: any): Promise<IUsecaseResponse<IBooking>> => {
    try {
      const { employeeId } = user;
      // 1. Get booking with approval header
      const booking = await this.repository.findBookingById(id, {
        approvalHeader: {
          include: {
            approverL1: {
              select: {
                employeeId: true,
                fullName: true,
                email: true,
              },
            },
          },
        },
        requester: {
          select: {
            employeeId: true,
            fullName: true,
            email: true,
          },
        },
        segments: {
          where: { deletedAt: null },
          orderBy: { segmentNo: 'asc' },
        },
      });

      if (!booking) {
        return {
          error: {
            message: `Booking with ID ${id} not found`,
            code: HttpStatus.NOT_FOUND,
          },
        };
      }

      // 2. Validate booking status — allow both standard L1 and external re-approval
      const isExternalReApproval = booking.bookingStatus === BookingStatus.WAITING_EXTERNAL_APPROVE;
      const isStandardApproval = booking.bookingStatus === BookingStatus.SUBMITTED;

      if (!isStandardApproval && !isExternalReApproval) {
        return {
          error: {
            message: `Booking cannot be approved in its current status: ${booking.bookingStatus}`,
            code: HttpStatus.BAD_REQUEST,
          },
        };
      }

      // 3. Validate approval header exists
      if (!booking.approvalHeader) {
        return {
          error: {
            message: 'Approval header not found for this booking',
            code: HttpStatus.BAD_REQUEST,
          },
        };
      }

      // 4. Update approval header & booking based on approval type
      const decisionTime = new Date();

      if (isExternalReApproval) {
        // External Re-Approval Round: update decisionL1External field
        await this.repository.updateApprovalHeader(id, {
          decisionL1External: dto.decision as ApprovalStatus,
          decisionTimeL1External: decisionTime,
          updatedBy: employeeId,
        } as any);

        let newStatus: BookingStatus;
        if (dto.decision === ApprovalStatus.APPROVED) {
          // L1 approved the rental cost → mark as ASSIGNED + create SuratJalan
          newStatus = BookingStatus.ASSIGNED;

          await this.repository.updateApprovalHeader(id, {
            gaAssigneeId: (booking.approvalHeader as any)?.gaAssigneeId ?? employeeId,
            decisionL2: ApprovalStatus.APPROVED,
            updatedBy: employeeId,
          });

          // Create SuratJalan now that L1 has approved the external vehicle cost
          const assignment = (booking as any).assignment;
          if (booking.segments && booking.segments.length > 0 && assignment) {
            const segment = booking.segments[0];
            const sjCode = `SJ-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(id).padStart(3, '0')}`;
            const clientDb = (await import('@/shared/utils')).clientDb;
            await clientDb.suratJalan.create({
              data: {
                sjCode,
                bookingId: id,
                segmentId: segment.id,
                vehicleId: assignment.vehicleChosenId,
                driverId: assignment.driverChosenId,
                status: 'Draft',
                isHandover: false,
                createdBy: employeeId,
              },
            });
            Logger.info(
              `SuratJalan ${sjCode} created after external vehicle cost approved for booking ${booking.bookingNumber}`,
              'ApprovalUseCase.approveBooking',
            );
          }
        } else if (dto.decision === ApprovalStatus.REJECTED) {
          // L1 rejected → send back to GA (revert to APPROVED_L1 so GA can re-assign)
          newStatus = BookingStatus.APPROVED_L1;
        } else if (dto.decision === ApprovalStatus.RETURNED) {
          // L1 returned → same as rejected for GA
          newStatus = BookingStatus.APPROVED_L1;
        } else {
          return {
            error: {
              message: 'Invalid decision. Must be APPROVED, REJECTED, or RETURNED',
              code: HttpStatus.BAD_REQUEST,
            },
          };
        }

        await this.repository.updateBooking(id, { bookingStatus: newStatus, updatedBy: employeeId });
        Logger.info(
          `External re-approval for booking ${booking.bookingNumber}: decision=${dto.decision}, new status=${newStatus}`,
          'ApprovalUseCase.approveBooking',
        );
      } else {
        // Standard L1 Approval Round
        await this.repository.updateApprovalHeader(id, {
          decisionL1: dto.decision as ApprovalStatus,
          decisionTimeL1: decisionTime,
          commentL1: dto.comment || null,
          updatedBy: employeeId,
        });

        // 5. Update booking status based on decision
        let newStatus: BookingStatus;
        if (dto.decision === ApprovalStatus.APPROVED) {
          newStatus = BookingStatus.APPROVED_L1;
        } else if (dto.decision === ApprovalStatus.REJECTED) {
          newStatus = BookingStatus.REJECTED;
        } else if (dto.decision === ApprovalStatus.RETURNED) {
          newStatus = BookingStatus.RETURNED;
        } else {
          return {
            error: {
              message: 'Invalid decision. Must be APPROVED, REJECTED, or RETURNED',
              code: HttpStatus.BAD_REQUEST,
            },
          };
        }

        await this.repository.updateBooking(id, { bookingStatus: newStatus, updatedBy: employeeId });
      }

      // 6. Send notification to requester
      if (booking.requester) {
        const decisionMessage =
          dto.decision === ApprovalStatus.APPROVED
            ? 'approved'
            : dto.decision === ApprovalStatus.REJECTED
              ? 'rejected'
              : 'returned for revision';

        await this.notificationService.sendEmail({
          to: booking.requester.email,
          subject: `Booking ${booking.bookingNumber} ${decisionMessage}`,
          body: `Your booking ${booking.bookingNumber} has been ${decisionMessage}${dto.comment ? `\n\nComment: ${dto.comment}` : ''}`,
        });
      }

      // 7. If standard approval approved, notify GA for assignment
      if (!isExternalReApproval && dto.decision === ApprovalStatus.APPROVED) {
        Logger.info(
          `Booking ${booking.bookingNumber} approved, ready for GA assignment`,
          'ApprovalUseCase.approveBooking',
        );
      }

      // 8. Get updated booking
      const updatedBooking = await this.repository.findBookingById(id);
      if (!updatedBooking) {
        return {
          error: {
            message: 'Failed to fetch updated booking',
            code: HttpStatus.INTERNAL_SERVER_ERROR,
          },
        };
      }

      const transformedBooking = await transformBookingWithPresignedUrls(
        updatedBooking as IBookingWithRelations,
        this.s3Service,
      );

      return { data: transformedBooking || undefined };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in approveBooking',
        error instanceof Error ? error.stack : undefined,
        'ApprovalUseCase.approveBooking',
      );
      return {
        error: {
          message: error instanceof Error ? error.message : 'Failed to approve booking',
          code: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  };

  findApprovalList = async (
    query: QueryApprovalListDto,
    user: any,
  ): Promise<IUsecaseResponse<IBookingListResponse>> => {
    try {
      const { employeeId, roles = [] } = user;
      const isLeader = roles.includes('LEADER');
      const isGA = roles.includes('GA');
      const isAdmin = roles.includes('ADMIN');

      // Safety Check: If not Leader/GA/Admin, return empty list
      if (!isLeader && !isGA && !isAdmin) {
        return {
          data: {
            data: [],
            meta: { page: query.page ?? 1, limit: query.limit ?? 10, total: 0 },
          },
        };
      }

      // Set default values if not provided
      const page = query.page ?? 1;
      const limit = query.limit ?? 10;
      const level = query.level ?? ApprovalLevel.ALL;
      const { search, approverId } = query;
      const skip = (page - 1) * limit;

      const where: Prisma.BookingWhereInput = {
        deletedAt: null,
      };

      // Build OR conditions for L1, L2, and Tracking
      const orConditions: Prisma.BookingWhereInput[] = [];

      // 1. L1 Approval: Booking with status SUBMITTED waiting for L1 decision
      if (level === ApprovalLevel.ALL || level === ApprovalLevel.L1) {
        const approvalHeaderConditions: Prisma.ApprovalHeaderWhereInput = {
          decisionL1: null, // PENDING L1 approval
        };

        if (isLeader) {
          approvalHeaderConditions.approverL1Id = employeeId;
        } else if (approverId) {
          approvalHeaderConditions.approverL1Id = approverId;
        }

        orConditions.push({
          bookingStatus: BookingStatus.SUBMITTED,
          approvalHeader: {
            is: {
              ...approvalHeaderConditions,
            },
          },
        });

        // Also include re-approval bookings (WAITING_EXTERNAL_APPROVE) in L1 list
        const externalReApprovalCondition: Prisma.BookingWhereInput = {
          bookingStatus: BookingStatus.WAITING_EXTERNAL_APPROVE,
        };
        if (isLeader) {
          externalReApprovalCondition.approvalHeader = {
            approverL1Id: employeeId,
          };
        } else if (approverId) {
          externalReApprovalCondition.approvalHeader = {
            approverL1Id: approverId,
          };
        }
        orConditions.push(externalReApprovalCondition);
      }

      // 2. L2 Approval (GA Assignment): Booking approved by L1 waiting for GA/Assignment
      if (level === ApprovalLevel.ALL || level === ApprovalLevel.L2) {
        // L2 logic: APPROVED_L1 status is the primary indicator
        const l2Condition: Prisma.BookingWhereInput = {
          bookingStatus: BookingStatus.APPROVED_L1,
        };

        // If Leader is tracking, they only see bookings they approved
        if (isLeader && level === ApprovalLevel.ALL) {
          l2Condition.approvalHeader = {
            approverL1Id: employeeId,
          };
        }

        orConditions.push(l2Condition);
      }

      // 3. Tracking: Higher states (In-Progress, Finished)
      // For Leaders: Only those they approved. For GA/Admin: All.
      if (level === ApprovalLevel.ALL || level === ApprovalLevel.TRACKING) {
        const trackingStatuses = [
          BookingStatus.APPROVED_L1,
          BookingStatus.WAITING_EXTERNAL_APPROVE,
          BookingStatus.ASSIGNED,
          BookingStatus.MERGED,
          BookingStatus.FINISHED,
        ];

        const trackingCondition: Prisma.BookingWhereInput = {
          bookingStatus: { in: trackingStatuses },
        };

        if (isLeader) {
          trackingCondition.approvalHeader = {
            approverL1Id: employeeId,
          };
        }

        orConditions.push(trackingCondition);
      }

      // Apply OR conditions
      if (orConditions.length > 0) {
        where.OR = orConditions;
      } else {
        // If no OR conditions (e.g. Leader only looking for L2), ensure no data returned
        where.id = -1;
      }

      // Search filter (booking number or purpose)
      if (search) {
        const searchCondition: Prisma.BookingWhereInput = {
          OR: [
            { bookingNumber: { contains: search, mode: Prisma.QueryMode.insensitive } },
            { purpose: { contains: search, mode: Prisma.QueryMode.insensitive } },
          ],
        };

        if (where.AND) {
          const existingAnd = Array.isArray(where.AND) ? where.AND : [where.AND];
          where.AND = [...existingAnd, searchCondition];
        } else {
          where.AND = [searchCondition];
        }
      }

      // Order by: Data terbaru di atas (baik setelah create atau update)
      const orderBy: Prisma.BookingOrderByWithRelationInput = { updatedAt: 'desc' };

      // Calculate Pending Count (Actionable tasks)
      const pendingWhere: Prisma.BookingWhereInput = {
        deletedAt: null,
      };

      const pendingOrConditions: Prisma.BookingWhereInput[] = [];

      // Actionable for L1 (Leader)
      if (isLeader) {
        pendingOrConditions.push({
          bookingStatus: BookingStatus.SUBMITTED,
          approvalHeader: {
            is: {
              approverL1Id: employeeId,
              decisionL1: null,
            },
          },
        });

        // External re-approval tasks are also actionable for L1
        pendingOrConditions.push({
          bookingStatus: BookingStatus.WAITING_EXTERNAL_APPROVE,
          approvalHeader: {
            approverL1Id: employeeId,
          },
        });
      }

      // Actionable for L2 (GA/Admin) - Waiting for assignment
      if (isGA || isAdmin) {
        pendingOrConditions.push({
          bookingStatus: BookingStatus.APPROVED_L1,
        });
      }

      if (pendingOrConditions.length > 0) {
        pendingWhere.OR = pendingOrConditions;
      } else {
        pendingWhere.id = -1;
      }

      const [data, total, totalPending] = await Promise.all([
        this.repository.findApprovalList({
          skip,
          take: limit,
          where,
          orderBy,
        }),
        this.repository.countApprovalList(where),
        this.repository.countApprovalList(pendingWhere),
      ]);

      // Transform bookings with presigned URLs
      const dataWithPresignedUrls = await Promise.all(
        data.map(async (booking) => {
          const bookingWithRelations = booking as IBookingWithRelations;
          return transformBookingWithPresignedUrls(bookingWithRelations, this.s3Service);
        }),
      );

      return {
        data: {
          data: dataWithPresignedUrls as IBooking[],
          meta: {
            page,
            limit,
            total,
            totalPending,
          },
        },
      };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findApprovalList',
        error instanceof Error ? error.stack : undefined,
        'ApprovalUseCase.findApprovalList',
      );
      return {
        error: {
          message: error instanceof Error ? error.message : 'Failed to fetch approval list',
          code: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  };
}
