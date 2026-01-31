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
export const BASE_BOOKING_INCLUDE: Prisma.BookingInclude = {
  category: true,
  segments: {
    where: { deletedAt: null },
    orderBy: { segmentNo: 'asc' },
    include: {
      travelOrder: {
        include: {
          driver: {
            include: {
              photoAsset: true,
            },
          },
          vehicle: {
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
      execution: {
        include: {
          verification: {
            include: {
              receiptItems: true,
            },
          },
        },
      },
    },
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
          driverChosen: {
            include: {
              photoAsset: true,
              ktpAsset: true,
              simAsset: true,
            },
          },
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
      driverChosen: {
        include: {
          photoAsset: true,
        },
      },
    },
  },
};
