import { NotificationService } from '@/shared/utils/notification.service';
import { globalLogger as Logger } from '@/shared/utils/logger';
import { IUsecaseResponse } from '@/shared/utils/rest-api/types';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ApprovalStatus, BookingStatus, Prisma } from '@prisma/client';
import { IBooking, IBookingListResponse } from '@/packages/bookings/domain/response';
import { transformBookingWithPresignedUrls } from '@/packages/bookings/domain/helpers/presigned-url.helper';
import { IBookingWithRelations } from '@/packages/bookings/domain/entities';
import { S3Service } from '@/shared/utils';
import { ApproveBookingDto } from '../dto/approve-booking.dto';
import { QueryApprovalListDto, ApprovalLevel } from '../dto/query-approval-list.dto';
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

  approveBooking = async (id: number, dto: ApproveBookingDto, userId: string): Promise<IUsecaseResponse<IBooking>> => {
    try {
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

      // 2. Validate booking status
      if (booking.bookingStatus !== BookingStatus.SUBMITTED) {
        return {
          error: {
            message: `Booking is not in SUBMITTED status. Current status: ${booking.bookingStatus}`,
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

      // 4. Update approval header
      const decisionTime = new Date();
      await this.repository.updateApprovalHeader(id, {
        decisionL1: dto.decision as ApprovalStatus,
        decisionTimeL1: decisionTime,
        commentL1: dto.comment || null,
        updatedBy: userId,
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

      await this.repository.updateBooking(id, {
        bookingStatus: newStatus,
        updatedBy: userId,
      });

      // 6. Send notification
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

      // 7. If approved, notify GA for assignment
      if (dto.decision === ApprovalStatus.APPROVED) {
        // TODO: Get GA users and send notification
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
    userId: string,
  ): Promise<IUsecaseResponse<IBookingListResponse>> => {
    try {
      // Set default values if not provided
      const page = query.page ?? 1;
      const limit = query.limit ?? 10;
      const level = query.level ?? ApprovalLevel.ALL;
      const { search, approverId } = query;
      const skip = (page - 1) * limit;

      const where: Prisma.BookingWhereInput = {
        deletedAt: null,
      };

      // Build OR conditions for L1 and L2 approvals
      const orConditions: Prisma.BookingWhereInput[] = [];

      // L1 Approval: Booking dengan status SUBMITTED yang memiliki ApprovalHeader dengan decisionL1 = null
      if (level === ApprovalLevel.ALL || level === ApprovalLevel.L1) {
        const l1Condition: Prisma.BookingWhereInput = {
          bookingStatus: BookingStatus.SUBMITTED,
          approvalHeader: {
            isNot: null,
          },
        };

        // Add approvalHeader conditions separately
        const approvalHeaderConditions: Prisma.ApprovalHeaderWhereInput = {
          decisionL1: null, // PENDING approval
        };

        // Filter by approver L1 ID if provided
        if (approverId) {
          approvalHeaderConditions.approverL1Id = approverId;
        }

        // Combine conditions using AND
        l1Condition.AND = [{ approvalHeader: { isNot: null } }, { approvalHeader: approvalHeaderConditions }];

        orConditions.push(l1Condition);
      }

      // L2 Approval: Booking dengan status APPROVED_L1 yang belum memiliki Assignment
      if (level === ApprovalLevel.ALL || level === ApprovalLevel.L2) {
        orConditions.push({
          bookingStatus: BookingStatus.APPROVED_L1,
          assignment: null, // Belum ada assignment
        });
      }

      // Apply OR conditions
      if (orConditions.length > 0) {
        where.OR = orConditions;
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

      // Order by: Priority untuk yang lebih urgent (SLA due date untuk L1, created date untuk L2)
      // Use createdAt desc as default, then sort by SLA in application logic if needed
      const orderBy: Prisma.BookingOrderByWithRelationInput = { createdAt: 'desc' };

      const [data, total] = await Promise.all([
        this.repository.findApprovalList({
          skip,
          take: limit,
          where,
          orderBy,
        }),
        this.repository.countApprovalList(where),
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
