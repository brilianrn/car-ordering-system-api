/**
 * Booking Domain Response Types
 * Response interfaces for API endpoints
 */

import { IBookingWithPresignedUrls } from './entities';
import {
  IBookingCategory as BookingCategoryEntity,
  IBookingSegment as BookingSegmentEntity,
  IApprovalHeaderWithApprover,
} from './entities/booking.entity';

/**
 * Booking Response Interface
 * Used for API responses (with presigned URLs for vehicle images)
 */
export type IBooking = IBookingWithPresignedUrls;

/**
 * Booking Category (for backward compatibility)
 */
export type IBookingCategory = BookingCategoryEntity;

/**
 * Booking Segment (for backward compatibility)
 */
export type IBookingSegment = BookingSegmentEntity;

/**
 * Approval Header (for backward compatibility)
 */
export type IApprovalHeader = IApprovalHeaderWithApprover;

/**
 * Booking List Response
 */
export interface IBookingListResponse {
  data: IBooking[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
}

/**
 * Available Vehicle Response
 * Used for LOV (List of Values) endpoint
 */
export interface IAvailableVehicle {
  id: number;
  vehicleCode: string;
  licensePlate: string;
  brandModel: string;
  vehicleType: string;
  seatCapacity: number;
  year: number;
  status: string;
  dedicatedOrgId: number | null;
}

/**
 * Trip Detail Response
 * Complete trip information including booking, surat jalan, assignment, and execution details
 */
export interface ITripDetail {
  booking: IBooking;
  suratJalan?: {
    id: number;
    sjCode: string;
    status: string;
    isHandover: boolean;
    stopList?: any;
    createdAt: Date;
    updatedAt: Date;
    driver: {
      id: number;
      driverCode: string;
      fullName: string;
      phoneNumber: string | null;
      photoUrl?: string;
    };
    vehicle: {
      id: number;
      vehicleCode: string;
      licensePlate: string;
      brandModel: string;
    };
  } | null;
  execution?: {
    id: number;
    status: string;
    checkInAt?: Date | null;
    checkOutAt?: Date | null;
    odoStart?: number | null;
    odoEnd?: number | null;
    odoDistance?: number | null;
    gpsDistance?: number | null;
    anomalyFlags?: any;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  verification?: {
    id: number;
    verifyStatus: string;
    verifierId: string;
    verifiedAt?: Date | null;
    anomalyHandled: boolean;
    reimburseTicket?: string | null;
    replenishTicket?: string | null;
  } | null;
}
