import { IBookingWithRelations } from '@/packages/bookings/domain/entities';
import { transformBookingWithPresignedUrls } from '@/packages/bookings/domain/helpers/presigned-url.helper';
import { IBooking } from '@/packages/bookings/domain/response';
import { clientDb, NotificationService, S3Service } from '@/shared/utils';
import { globalLogger as Logger } from '@/shared/utils/logger';
import { IUsecaseResponse } from '@/shared/utils/rest-api/types';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ApprovalStatus, BookingStatus, Prisma } from '@prisma/client';
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
      if (booking?.bookingStatus === BookingStatus.APPROVED_L1 || booking?.bookingStatus === BookingStatus.MERGED) {
        const isExternalVehicle = dto.resourceMode === 'DAILY_RENT';

        // 3. Validate vehicle exists (Internal only)
        let vehicle: any = null;
        if (!isExternalVehicle) {
          vehicle = await this.repository.findVehicleById(dto.vehicleChosenId as number);
          if (!vehicle) {
            return {
              error: {
                message: `Vehicle with ID ${dto.vehicleChosenId} not found`,
                code: HttpStatus.NOT_FOUND,
              },
            };
          }
        }

        // 4. Validate driver exists (Internal only)
        let driver: any = null;
        if (!isExternalVehicle) {
          driver = await this.repository.findDriverById(dto.driverChosenId as number);
          if (!driver) {
            return {
              error: {
                message: `Driver with ID ${dto.driverChosenId} not found`,
                code: HttpStatus.NOT_FOUND,
              },
            };
          }
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

        // Calculate total vendor cost if resource mode is DAILY_RENT
        let totalVendorCost = 0;
        if (isExternalVehicle) {
          if (dto.vendorDailyRate === undefined || dto.vendorDailyRate === null) {
            return {
              error: {
                message: 'Vendor daily rate is required for Daily Rent mode',
                code: HttpStatus.BAD_REQUEST,
              },
            };
          }

          // Calculate duration in days (minimum 1 day)
          const durationMs = booking.endAt.getTime() - booking.startAt.getTime();
          const durationDays = Math.max(1, Math.ceil(durationMs / (1000 * 60 * 60 * 24)));
          totalVendorCost = dto.vendorDailyRate * durationDays;

          Logger.info(
            `Calculated total vendor cost: ${totalVendorCost} (${dto.vendorDailyRate} x ${durationDays} days)`,
            'AssignmentUseCase.assignBooking',
          );
        }

        await this.repository.createAssignment({
          booking: { connect: { id } },
          resourceMode: dto.resourceMode,
          ...(dto.vehicleChosenId && { vehicleChosen: { connect: { id: dto.vehicleChosenId } } }),
          ...(dto.driverChosenId && { driverChosen: { connect: { id: dto.driverChosenId } } }),
          ...(dto.vendorChosenId && { vendorChosen: { connect: { id: dto.vendorChosenId } } }),
          ...(dto.estimatedTariff !== undefined && { estimatedTariff: dto.estimatedTariff }),
          ...(dto.vendorDailyRate !== undefined && { vendorDailyRate: dto.vendorDailyRate }),
          ...(totalVendorCost > 0 && { totalVendorCost }),
          externalDriverName: dto.externalDriverName || null,
          externalVehiclePlate: dto.externalVehiclePlate || null,
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
            vehicle: vehicle
              ? {
                  id: vehicle.id,
                  vehicleCode: vehicle.vehicleCode,
                  licensePlate: vehicle.licensePlate,
                  brandModel: vehicle.brandModel,
                }
              : {
                  licensePlate: dto.externalVehiclePlate || 'External',
                },
            driver: driver
              ? {
                  id: driver.id,
                  driverCode: driver.driverCode,
                  fullName: driver.fullName,
                  phoneNumber: driver.phoneNumber,
                }
              : {
                  fullName: dto.externalDriverName || 'Vendor Driver',
                },
            assignedAt: assignedAt.toISOString(),
          } as Prisma.InputJsonValue,
        });

        // 7. Determine new booking status based on resource mode
        if (isExternalVehicle) {
          // 7a. EXTERNAL/SEWA: Put booking in WAITING_EXTERNAL_APPROVE — L1 must confirm the rental cost
          await this.repository.updateBooking(id, {
            bookingStatus: BookingStatus.WAITING_EXTERNAL_APPROVE,
            updatedBy: userId,
          });

          // Update approval header with external approval metadata
          if (booking.approvalHeader) {
            const vendorInfo = dto.vendorChosenId ? `Vendor ID: ${dto.vendorChosenId}` : 'External vendor';
            const vehicleInfo =
              dto.externalVehiclePlate || (vehicle ? `${vehicle.vehicleCode} (${vehicle.licensePlate})` : 'TBD');

            await this.repository.updateApprovalHeader(id, {
              isExternalApproval: true,
              externalApprovalNote: `${vendorInfo} | Vehicle: ${vehicleInfo} | GA has allocated an external/rental vehicle. Please approve the operational cost.`,
              decisionL1External: null,
              updatedBy: userId,
            } as any);
          }

          // Notify the L1 approver about the re-approval needed
          try {
            const approvalHeader = booking.approvalHeader as any;
            if (approvalHeader?.approverL1) {
              const vehicleInfo =
                dto.externalVehiclePlate || (vehicle ? `${vehicle.vehicleCode} - ${vehicle.licensePlate}` : 'TBD');
              const driverInfo = dto.externalDriverName || (driver ? driver.fullName : 'Vendor Driver');

              await this.notificationService.sendEmail({
                to: approvalHeader.approverL1.email,
                subject: `Re-Approval Needed: Booking ${booking.bookingNumber} — External Vehicle Cost`,
                body: `GA has allocated a rental vehicle for booking ${booking.bookingNumber}.\n\nVehicle: ${vehicleInfo}\n\nPlease approve the operational cost in the application.`,
                html: `
                  <h2>Re-Approval: Rental Vehicle Cost</h2>
                  <p>GA has allocated a rental vehicle for the following booking:</p>
                  <ul>
                    <li><strong>Booking Number:</strong> ${booking.bookingNumber}</li>
                    <li><strong>Vehicle:</strong> ${vehicleInfo}</li>
                    <li><strong>Driver:</strong> ${driverInfo}</li>
                  </ul>
                  <p>Please log in to the application and approve the operational cost for this rental vehicle.</p>
                `,
              });
            }
          } catch (notifError) {
            Logger.warn(
              `Failed to send re-approval notification: ${notifError instanceof Error ? notifError.message : 'Unknown'}`,
              'AssignmentUseCase.assignBooking',
            );
          }

          Logger.info(
            `Booking ${booking.bookingNumber} set to WAITING_EXTERNAL_APPROVE (DAILY_RENT vehicle assigned by GA)`,
            'AssignmentUseCase.assignBooking',
          );
        } else {
          // 7b. INTERNAL/PERSONAL: Keep existing direct-assign flow
          await this.repository.updateBooking(id, {
            bookingStatus:
              booking.bookingStatus === BookingStatus.APPROVED_L1 ? BookingStatus.ASSIGNED : BookingStatus.MERGED,
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
                vehicleId: dto.vehicleChosenId || 0,
                driverId: dto.driverChosenId || 0,
                status: 'Draft',
                isHandover: false,
                createdBy: userId,
              },
            });
          }

          // 10. Send notification to driver
          try {
            let driverEmployeeId: string | null = null;
            if (driver && driver.internalNik) {
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

                await this.notificationService.sendPushNotification({
                  userId: employee.employeeId,
                  title: 'New Assignment',
                  message: `You have been assigned to booking ${booking.bookingNumber}`,
                  data: {
                    type: 'booking_assignment',
                    bookingId: id,
                    bookingNumber: booking.bookingNumber,
                    vehicleCode: vehicle ? vehicle.vehicleCode : 'N/A',
                  },
                });

                if (employee.email) {
                  await this.notificationService.sendEmail({
                    to: employee.email,
                    subject: `New Assignment: Booking ${booking.bookingNumber}`,
                    body: `You have been assigned as driver for booking ${booking.bookingNumber}.\n\nVehicle: ${vehicle ? `${vehicle.vehicleCode} - ${vehicle.licensePlate}` : 'N/A'}`,
                    html: `
                      <h2>New Assignment</h2>
                      <p>You have been assigned as driver for the following booking:</p>
                      <ul>
                        <li><strong>Booking Number:</strong> ${booking.bookingNumber}</li>
                        <li><strong>Vehicle:</strong> ${vehicle ? `${vehicle.vehicleCode} - ${vehicle.licensePlate}` : 'N/A'}</li>
                        <li><strong>Booking Date:</strong> ${booking.startAt ? new Date(booking.startAt).toLocaleString() : 'N/A'}</li>
                      </ul>
                      <p>Please check your app for more details.</p>
                    `,
                  });
                }
              }
            }

            if (driver) {
              Logger.info(
                `Assignment notification sent to driver ${driver.driverCode}${driverEmployeeId ? ` (Employee: ${driverEmployeeId})` : ''}`,
                'AssignmentUseCase.assignBooking',
              );
            }
          } catch (notificationError) {
            Logger.error(
              notificationError instanceof Error ? notificationError.message : 'Failed to send assignment notification',
              notificationError instanceof Error ? notificationError.stack : undefined,
              'AssignmentUseCase.assignBooking - Notification',
            );
          }
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
      } else {
        return {
          error: {
            message: `Booking is not in APPROVED_L1 status. Current status: ${booking.bookingStatus}`,
            code: HttpStatus.BAD_REQUEST,
          },
        };
      }
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
