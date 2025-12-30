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
