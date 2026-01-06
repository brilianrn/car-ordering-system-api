import { clientDb } from '@/shared/utils';
import { NotificationService, S3Service } from '@/shared/utils';
import { globalLogger as Logger } from '@/shared/utils/logger';
import { IUsecaseResponse } from '@/shared/utils/rest-api/types';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ApprovalStatus, BookingStatus, Prisma } from '@prisma/client';
import { IBooking } from '@/packages/bookings/domain/response';
import { transformBookingWithPresignedUrls } from '@/packages/bookings/domain/helpers/presigned-url.helper';
import { IBookingWithRelations } from '@/packages/bookings/domain/entities';
import { AssignBookingDto } from '../dto/assign-booking.dto';
import { AssignmentRepositoryPort } from '../ports/repository.port';
import { AssignmentUsecasePort } from '../ports/usecase.port';

@Injectable()
export class AssignmentUseCase implements AssignmentUsecasePort {
  private readonly db = clientDb;

  constructor(
    @Inject('AssignmentRepositoryPort')
    private readonly repository: AssignmentRepositoryPort,
    private readonly s3Service: S3Service,
    private readonly notificationService: NotificationService,
  ) {}

  assignBooking = async (id: number, dto: AssignBookingDto, userId: string): Promise<IUsecaseResponse<IBooking>> => {
    try {
      // 1. Get booking
      const booking = await this.repository.findBookingById(id, {
        approvalHeader: true,
        assignment: true,
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
      if (booking.bookingStatus !== BookingStatus.APPROVED_L1) {
        return {
          error: {
            message: `Booking is not in APPROVED_L1 status. Current status: ${booking.bookingStatus}`,
            code: HttpStatus.BAD_REQUEST,
          },
        };
      }

      // 3. Validate vehicle exists
      const vehicle = await this.repository.findVehicleById(dto.vehicleChosenId);
      if (!vehicle) {
        return {
          error: {
            message: `Vehicle with ID ${dto.vehicleChosenId} not found`,
            code: HttpStatus.NOT_FOUND,
          },
        };
      }

      // 4. Validate driver exists
      const driver = await this.repository.findDriverById(dto.driverChosenId);
      if (!driver) {
        return {
          error: {
            message: `Driver with ID ${dto.driverChosenId} not found`,
            code: HttpStatus.NOT_FOUND,
          },
        };
      }

      // 5. Check if assignment already exists
      const existingAssignment = await this.repository.findAssignmentByBookingId(id);
      if (existingAssignment) {
        return {
          error: {
            message: 'Assignment already exists for this booking',
            code: HttpStatus.BAD_REQUEST,
          },
        };
      }

      // 6. Create assignment
      const assignedAt = new Date();
      const slaDueAt = booking.endAt;

      await this.repository.createAssignment({
        booking: { connect: { id } },
        resourceMode: dto.resourceMode,
        vehicleChosen: { connect: { id: dto.vehicleChosenId } },
        driverChosen: { connect: { id: dto.driverChosenId } },
        ...(dto.vendorChosenId && { vendorChosen: { connect: { id: dto.vendorChosenId } } }),
        dispatchNote: dto.dispatchNote || null,
        assignedAtL2: assignedAt,
        slaDueAtL2: slaDueAt,
        approvalHeader: booking.approvalHeader
          ? {
              connect: { id: booking.approvalHeader.id },
            }
          : undefined,
        createdBy: userId,
        assignmentSnapshot: {
          vehicle: {
            id: vehicle.id,
            vehicleCode: vehicle.vehicleCode,
            licensePlate: vehicle.licensePlate,
            brandModel: vehicle.brandModel,
          },
          driver: {
            id: driver.id,
            driverCode: driver.driverCode,
            fullName: driver.fullName,
            phoneNumber: driver.phoneNumber,
          },
          assignedAt: assignedAt.toISOString(),
        } as Prisma.InputJsonValue,
      });

      // 7. Update booking status
      await this.repository.updateBooking(id, {
        bookingStatus: BookingStatus.ASSIGNED,
        updatedBy: userId,
      });

      // 8. Update approval header
      if (booking.approvalHeader) {
        await this.repository.updateApprovalHeader(id, {
          gaAssigneeId: userId,
          decisionL2: ApprovalStatus.APPROVED,
          updatedBy: userId,
        });
      }

      // 9. Create SuratJalan (Travel Order)
      if (booking.segments && booking.segments.length > 0) {
        const segment = booking.segments[0];
        const sjCode = `SJ-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(id).padStart(3, '0')}`;

        await this.db.suratJalan.create({
          data: {
            sjCode,
            bookingId: id,
            segmentId: segment.id,
            vehicleId: dto.vehicleChosenId,
            driverId: dto.driverChosenId,
            status: 'Draft',
            isHandover: false,
            createdBy: userId,
          },
        });
      }

      // 10. Send notification to driver
      try {
        // Try to find employee if driver is internal (has internalNik)
        let driverEmployeeId: string | null = null;
        if (driver.internalNik) {
          const employee = await this.db.employee.findFirst({
            where: {
              employeeId: driver.internalNik,
              deletedAt: null,
            },
            select: {
              employeeId: true,
              email: true,
            },
          });
          if (employee) {
            driverEmployeeId = employee.employeeId;

            // Send push notification to driver
            await this.notificationService.sendPushNotification({
              userId: employee.employeeId,
              title: 'New Assignment',
              message: `You have been assigned to booking ${booking.bookingNumber}`,
              data: {
                type: 'booking_assignment',
                bookingId: id,
                bookingNumber: booking.bookingNumber,
                vehicleCode: vehicle.vehicleCode,
              },
            });

            // Send email notification if email exists
            if (employee.email) {
              await this.notificationService.sendEmail({
                to: employee.email,
                subject: `New Assignment: Booking ${booking.bookingNumber}`,
                body: `You have been assigned as driver for booking ${booking.bookingNumber}.\n\nVehicle: ${vehicle.vehicleCode} - ${vehicle.licensePlate}\nBooking Date: ${booking.startAt ? new Date(booking.startAt).toLocaleString() : 'N/A'}\n\nPlease check your app for more details.`,
                html: `
                  <h2>New Assignment</h2>
                  <p>You have been assigned as driver for the following booking:</p>
                  <ul>
                    <li><strong>Booking Number:</strong> ${booking.bookingNumber}</li>
                    <li><strong>Vehicle:</strong> ${vehicle.vehicleCode} - ${vehicle.licensePlate}</li>
                    <li><strong>Booking Date:</strong> ${booking.startAt ? new Date(booking.startAt).toLocaleString() : 'N/A'}</li>
                  </ul>
                  <p>Please check your app for more details.</p>
                `,
              });
            }
          }
        }

        // Log notification
        Logger.info(
          `Assignment notification sent to driver ${driver.driverCode}${driverEmployeeId ? ` (Employee: ${driverEmployeeId})` : ''}`,
          'AssignmentUseCase.assignBooking',
        );
      } catch (notificationError) {
        // Log error but don't fail the assignment
        Logger.error(
          notificationError instanceof Error ? notificationError.message : 'Failed to send assignment notification',
          notificationError instanceof Error ? notificationError.stack : undefined,
          'AssignmentUseCase.assignBooking - Notification',
        );
      }

      // 11. Get updated booking
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
        error instanceof Error ? error.message : 'Error in assignBooking',
        error instanceof Error ? error.stack : undefined,
        'AssignmentUseCase.assignBooking',
      );
      return {
        error: {
          message: error instanceof Error ? error.message : 'Failed to assign booking',
          code: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  };
}
