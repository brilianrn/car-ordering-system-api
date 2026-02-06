import { clientDb } from '@/shared/utils';
import { verifyActionToken } from '@/shared/utils/action-token.util';
import { globalLogger as Logger } from '@/shared/utils/logger';
import { IUsecaseResponse } from '@/shared/utils/rest-api/types';
import { HttpStatus, Injectable } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { format } from 'date-fns';
import { ExecuteActionDto } from '../dto';
import { ApprovalsUsecasePort, IExecuteActionResponse, IValidateTokenResponse } from '../ports/usecase.port';

@Injectable()
export class ApprovalsUseCase implements ApprovalsUsecasePort {
  private readonly db = clientDb;

  /**
   * Validate action token and return booking details (read-only)
   */
  validateToken = async (token: string): Promise<IUsecaseResponse<IValidateTokenResponse>> => {
    try {
      // 1. Verify and decode token
      const decoded = verifyActionToken(token);

      // 2. Fetch booking details
      const booking = await this.db.booking.findUnique({
        where: { id: decoded.bookingId },
        include: {
          requester: true,
        },
      });

      if (!booking) {
        return {
          error: {
            message: 'Booking not found',
            code: HttpStatus.NOT_FOUND,
          },
        };
      }

      // 3. Check if booking is in valid status for approval
      const validStatuses: BookingStatus[] = [
        BookingStatus.SUBMITTED,
        BookingStatus.APPROVED_L1,
        BookingStatus.REJECTED,
      ];

      if (!validStatuses.includes(booking.bookingStatus)) {
        return {
          error: {
            message: `Booking is in ${booking.bookingStatus} status and cannot be approved/rejected`,
            code: HttpStatus.BAD_REQUEST,
          },
        };
      }

      // 4. Return booking details
      return {
        data: {
          bookingId: booking.id,
          bookingNumber: booking.bookingNumber,
          requesterName: booking.requester?.fullName || 'Unknown',
          destination: 'N/A', // No destination field in schema, using placeholder
          date: format(new Date(booking.startAt), 'dd MMM yyyy HH:mm'),
          purpose: booking.purpose,
          action: decoded.action,
          level: decoded.level,
          approverId: decoded.approverId,
        },
      };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Unknown error during token validation',
        error instanceof Error ? error.stack : undefined,
        'ApprovalsUseCase.validateToken',
      );

      if (error instanceof Error && error.message.includes('token')) {
        return {
          error: {
            message: error.message,
            code: HttpStatus.UNAUTHORIZED,
          },
        };
      }

      return {
        error: {
          message: 'Failed to validate token',
          code: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  };

  /**
   * Execute approval/rejection action
   */
  executeAction = async (
    dto: ExecuteActionDto,
    requesterId: string,
  ): Promise<IUsecaseResponse<IExecuteActionResponse>> => {
    try {
      // 1. Verify and decode token
      const decoded = verifyActionToken(dto.token);

      // 2. Fetch booking with current status
      const booking = await this.db.booking.findUnique({
        where: { id: decoded.bookingId },
        include: {
          requester: true,
        },
      });

      if (!booking) {
        return {
          error: {
            message: 'Booking not found',
            code: HttpStatus.NOT_FOUND,
          },
        };
      }

      // 3. Idempotency check - if already processed in the intended way, return success
      if (decoded.action === 'APPROVE') {
        if (
          (decoded.level === 'L1' && booking.bookingStatus === BookingStatus.APPROVED_L1) ||
          (decoded.level === 'L1' && booking.bookingStatus === BookingStatus.ASSIGNED) ||
          (decoded.level === 'L2' && booking.bookingStatus === BookingStatus.ASSIGNED)
        ) {
          Logger.info(
            `Booking ${booking.bookingNumber} already approved, returning success (idempotent)`,
            'ApprovalsUseCase.executeAction',
          );
          return {
            data: {
              message: 'Booking already approved',
              bookingId: booking.id,
              newStatus: booking.bookingStatus,
            },
          };
        }
      } else if (decoded.action === 'REJECT') {
        if (booking.bookingStatus === BookingStatus.REJECTED) {
          Logger.info(
            `Booking ${booking.bookingNumber} already rejected, returning success (idempotent)`,
            'ApprovalsUseCase.executeAction',
          );
          return {
            data: {
              message: 'Booking already rejected',
              bookingId: booking.id,
              newStatus: booking.bookingStatus,
            },
          };
        }
      }

      // 4. Check if booking is in correct status for this action
      if (decoded.action === 'APPROVE') {
        if (decoded.level === 'L1' && booking.bookingStatus !== BookingStatus.SUBMITTED) {
          return {
            error: {
              message: `Cannot approve L1 - booking is in ${booking.bookingStatus} status`,
              code: HttpStatus.BAD_REQUEST,
            },
          };
        }
        if (decoded.level === 'L2' && booking.bookingStatus !== BookingStatus.APPROVED_L1) {
          return {
            error: {
              message: `Cannot approve L2 - booking is in ${booking.bookingStatus} status`,
              code: HttpStatus.BAD_REQUEST,
            },
          };
        }
      } else if (decoded.action === 'REJECT') {
        if (booking.bookingStatus !== BookingStatus.SUBMITTED && booking.bookingStatus !== BookingStatus.APPROVED_L1) {
          return {
            error: {
              message: `Cannot reject - booking is in ${booking.bookingStatus} status`,
              code: HttpStatus.BAD_REQUEST,
            },
          };
        }

        // Require note for rejection
        if (!dto.note || dto.note.trim().length === 0) {
          return {
            error: {
              message: 'Rejection note is required',
              code: HttpStatus.BAD_REQUEST,
            },
          };
        }
      }

      // 5. Execute the action
      let newStatus: BookingStatus;
      let auditAction: string;

      if (decoded.action === 'APPROVE') {
        if (decoded.level === 'L1') {
          newStatus = BookingStatus.APPROVED_L1;
          auditAction = 'APPROVED_L1';

          // Update to APPROVED_L1 after L1 approval
          await this.db.booking.update({
            where: { id: booking.id },
            data: {
              bookingStatus: BookingStatus.APPROVED_L1,
              updatedBy: requesterId,
            },
          });

          newStatus = BookingStatus.APPROVED_L1;
        } else {
          // L2 approval - move to ASSIGNED status
          newStatus = BookingStatus.ASSIGNED;
          auditAction = 'APPROVED_L2';

          await this.db.booking.update({
            where: { id: booking.id },
            data: {
              bookingStatus: BookingStatus.ASSIGNED,
              updatedBy: requesterId,
            },
          });
        }
      } else {
        // REJECT
        newStatus = BookingStatus.REJECTED;
        auditAction = 'REJECTED';

        await this.db.booking.update({
          where: { id: booking.id },
          data: {
            bookingStatus: BookingStatus.REJECTED,
            cancelReason: dto.note,
            updatedBy: requesterId,
          },
        });
      }

      // 6. Log audit trail
      await this.db.auditLog.create({
        data: {
          entityType: 'BOOKING',
          entityId: booking.id,
          action: auditAction,
          userNik: decoded.approverId,
          featureCode: 'APPROVAL',
          beforeAfter: {
            previousStatus: booking.bookingStatus,
            newStatus: newStatus,
            note: dto.note,
            source: 'EMAIL_LINK',
            token: dto.token.substring(0, 20) + '...', // Log partial token
          },
        },
      });

      Logger.info(
        `Booking ${booking.bookingNumber} ${decoded.action.toLowerCase()}ed via ${decoded.level} by ${decoded.approverId}`,
        'ApprovalsUseCase.executeAction',
      );

      return {
        data: {
          message: `Booking ${decoded.action.toLowerCase()}ed successfully`,
          bookingId: booking.id,
          newStatus: newStatus,
        },
      };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Unknown error during action execution',
        error instanceof Error ? error.stack : undefined,
        'ApprovalsUseCase.executeAction',
      );

      if (error instanceof Error && error.message.includes('token')) {
        return {
          error: {
            message: error.message,
            code: HttpStatus.UNAUTHORIZED,
          },
        };
      }

      return {
        error: {
          message: 'Failed to execute action',
          code: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  };
}
