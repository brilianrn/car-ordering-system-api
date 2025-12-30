import { ApprovalHeader, Booking, BookingSegment, Category, Employee, Vehicle, Assignment } from '@prisma/client';
import { IVehicleWithImages, IVehicleWithPresignedUrls } from './vehicle.entity';
import { IVehicleImage } from './vehicle-image.entity';

/**
 * Booking Category Entity
 */
export interface IBookingCategory extends Category {}

/**
 * Booking Segment Entity
 */
export interface IBookingSegment extends BookingSegment {}

/**
 * Employee Info (Partial)
 * Used for requester and approver information
 */
export interface IEmployeeInfo {
  employeeId: string;
  fullName: string;
  email: string;
}

/**
 * Approval Header Entity with Approver Info
 */
export interface IApprovalHeaderWithApprover extends ApprovalHeader {
  approverL1?: IEmployeeInfo | null;
}

/**
 * Assignment Entity with Vehicle
 */
export interface IAssignmentWithVehicle extends Assignment {
  vehicleChosen?:
    | (Vehicle & {
        images: IVehicleImage[];
      })
    | null;
}

/**
 * Booking Entity with Relations
 * Complete booking entity with all possible relations
 */
export interface IBookingWithRelations extends Booking {
  category?: IBookingCategory | null;
  segments?: IBookingSegment[];
  approvalHeader?: IApprovalHeaderWithApprover | null;
  requester?: IEmployeeInfo | null;
  vehicle?: IVehicleWithImages | null;
  assignment?: IAssignmentWithVehicle | null;
}

/**
 * Booking Entity with Presigned URLs
 * Used when returning bookings to client with presigned URLs for vehicle images
 */
export interface IBookingWithPresignedUrls extends Omit<IBookingWithRelations, 'vehicle' | 'assignment'> {
  vehicle?: IVehicleWithPresignedUrls | null;
  assignment?:
    | (Omit<IAssignmentWithVehicle, 'vehicleChosen'> & {
        vehicleChosen?:
          | (Vehicle & {
              images: IVehicleImage[];
            })
          | null;
      })
    | null;
}
