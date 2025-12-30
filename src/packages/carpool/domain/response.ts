import { Booking, CarpoolGroup } from '@prisma/client';

// TODO: Generate Prisma client after schema migration
type CarpoolInvite = any;

export interface ICarpoolCandidate {
  bookingId: number;
  bookingNumber: string;
  requesterId: string;
  requesterName: string;
  startAt: Date;
  endAt: Date;
  passengerCount: number;
  from: string;
  to: string;
  routeSimilarity: number; // Percentage (0-100)
  timeDifference: number; // Minutes difference from host
  totalPassengers: number; // Host + Candidate combined
  canFit: boolean; // Whether total passengers fit in vehicle capacity
}

export interface ICarpoolInviteResponse extends CarpoolInvite {
  joinerBooking: Booking;
  hostBooking: Booking;
  carpoolGroup: CarpoolGroup;
}

export interface ICarpoolGroupResponse extends CarpoolGroup {
  hostBooking: Booking;
  memberBookings: Booking[];
  invites: CarpoolInvite[];
}

export interface ICombinedRoute {
  waypoints: Array<{
    bookingId: number;
    bookingNumber: string;
    type: 'PICKUP' | 'DROP';
    location: string;
    passengerCount: number;
    sequence: number;
    estimatedTime: Date;
  }>;
  totalDistance: number; // km
  totalDuration: number; // minutes
  detourPercentage: number; // Percentage of additional distance/time
  [key: string]: any; // Index signature for JsonValue compatibility
}

export interface ISharedCostSummary {
  totalCost: number;
  costMode: string;
  breakdown: Array<{
    bookingId: number;
    bookingNumber: string;
    requesterId: string;
    distance: number; // km
    costShare: number;
    percentage: number; // Percentage of total cost
  }>;
  [key: string]: any; // Index signature for JsonValue compatibility
}
