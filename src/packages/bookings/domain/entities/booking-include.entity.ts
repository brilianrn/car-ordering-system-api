import { Prisma } from '@prisma/client';

/**
 * Booking Include Relations
 * Defines the structure for Prisma include relations when fetching bookings
 * This type is used to ensure type safety for include statements
 */
export interface IBookingIncludeRelations {
  category?: boolean;
  segments?:
    | boolean
    | {
        where?: Prisma.BookingSegmentWhereInput;
        orderBy?: Prisma.BookingSegmentOrderByWithRelationInput | Prisma.BookingSegmentOrderByWithRelationInput[];
      };
  approvalHeader?:
    | boolean
    | {
        include?: {
          approverL1?:
            | boolean
            | {
                select?: {
                  employeeId?: boolean;
                  fullName?: boolean;
                  email?: boolean;
                };
              };
        };
      };
  requester?:
    | boolean
    | {
        select?: {
          employeeId?: boolean;
          fullName?: boolean;
          email?: boolean;
        };
      };
  vehicle?:
    | boolean
    | {
        include?: {
          images?:
            | boolean
            | {
                select?: {
                  asset?: boolean;
                };
              };
        };
      };
  assignment?:
    | boolean
    | {
        include?: {
          vehicleChosen?:
            | boolean
            | {
                include?: {
                  images?:
                    | boolean
                    | {
                        select?: {
                          asset?: boolean;
                        };
                      };
                };
              };
        };
      };
}

/**
 * Base Booking Include Relations (without vehicle/assignment)
 * Used as fallback when Prisma client doesn't support vehicle relation yet
 */
export const BASE_BOOKING_INCLUDE: IBookingIncludeRelations = {
  category: true,
  segments: {
    where: { deletedAt: null },
    orderBy: { segmentNo: 'asc' },
  },
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
};

/**
 * Default Booking Include Relations
 * Standard relations to include when fetching booking details
 * Includes vehicle and assignment relations (requires Prisma client to be generated)
 */
export const DEFAULT_BOOKING_INCLUDE: IBookingIncludeRelations = {
  ...BASE_BOOKING_INCLUDE,
  vehicle: {
    include: {
      images: {
        select: {
          asset: true,
        },
      },
    },
  },
  assignment: {
    include: {
      vehicleChosen: {
        include: {
          images: {
            select: {
              asset: true,
            },
          },
        },
      },
    },
  },
};
