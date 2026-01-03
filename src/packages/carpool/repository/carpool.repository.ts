import { clientDb } from '@/shared/utils';
import { globalLogger as Logger } from '@/shared/utils/logger';
import { Injectable } from '@nestjs/common';
import { CarpoolGroup, Prisma, PrismaClient } from '@prisma/client';

// TODO: Generate Prisma client after schema migration
type CarpoolInvite = any;

@Injectable()
export class CarpoolRepository {
  private readonly db: PrismaClient = clientDb;

  /**
   * Find carpool group by ID with relations
   */
  async findCarpoolGroupById(id: number): Promise<any> {
    try {
      return await this.db.carpoolGroup.findUnique({
        where: { id },
        include: {
          hostBooking: {
            include: {
              segments: {
                where: { deletedAt: null },
                orderBy: { segmentNo: 'asc' },
              },
              requester: {
                select: {
                  employeeId: true,
                  fullName: true,
                  email: true,
                },
              },
            },
          },
          memberBookings: {
            include: {
              segments: {
                where: { deletedAt: null },
                orderBy: { segmentNo: 'asc' },
              },
              requester: {
                select: {
                  employeeId: true,
                  fullName: true,
                  email: true,
                },
              },
            },
          },
          // invites: {
          //   where: { deletedAt: null },
          //   include: {
          //     joinerBooking: {
          //       include: {
          //         segments: {
          //           where: { deletedAt: null },
          //           orderBy: { segmentNo: 'asc' },
          //         },
          //         requester: {
          //           select: {
          //             employeeId: true,
          //             fullName: true,
          //             email: true,
          //           },
          //         },
          //       },
          //     },
          //   },
          // },
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error finding carpool group',
        error instanceof Error ? error.stack : undefined,
        'CarpoolRepository.findCarpoolGroupById',
      );
      throw error;
    }
  }

  /**
   * Create carpool group
   */
  async createCarpoolGroup(data: Prisma.CarpoolGroupCreateInput): Promise<CarpoolGroup> {
    try {
      return await this.db.carpoolGroup.create({
        data,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error creating carpool group',
        error instanceof Error ? error.stack : undefined,
        'CarpoolRepository.createCarpoolGroup',
      );
      throw error;
    }
  }

  /**
   * Create carpool invite
   */
  async createInvite(data: any): Promise<CarpoolInvite> {
    try {
      return await (this.db as any).carpoolInvite.create({
        data,
        include: {
          joinerBooking: true,
          hostBooking: true,
          carpoolGroup: true,
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error creating carpool invite',
        error instanceof Error ? error.stack : undefined,
        'CarpoolRepository.createInvite',
      );
      throw error;
    }
  }

  /**
   * Update carpool invite
   */
  async updateInvite(id: number, data: any): Promise<CarpoolInvite> {
    try {
      return await (this.db as any).carpoolInvite.update({
        where: { id },
        data,
        include: {
          joinerBooking: true,
          hostBooking: true,
          carpoolGroup: true,
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error updating carpool invite',
        error instanceof Error ? error.stack : undefined,
        'CarpoolRepository.updateInvite',
      );
      throw error;
    }
  }

  /**
   * Find invite by ID
   */
  async findInviteById(id: number): Promise<CarpoolInvite | null> {
    try {
      return await (this.db as any).carpoolInvite.findUnique({
        where: { id },
        include: {
          joinerBooking: true,
          hostBooking: true,
          carpoolGroup: true,
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error finding invite',
        error instanceof Error ? error.stack : undefined,
        'CarpoolRepository.findInviteById',
      );
      throw error;
    }
  }

  /**
   * Find booking by ID
   */
  async findBookingById(id: number): Promise<any> {
    try {
      return await this.db.booking.findUnique({
        where: { id },
        include: {
          segments: {
            where: { deletedAt: null },
            orderBy: { segmentNo: 'asc' },
          },
          requester: {
            select: {
              employeeId: true,
              fullName: true,
              email: true,
            },
          },
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error finding booking',
        error instanceof Error ? error.stack : undefined,
        'CarpoolRepository.findBookingById',
      );
      throw error;
    }
  }

  /**
   * Update carpool group
   */
  async updateCarpoolGroup(id: number, data: Prisma.CarpoolGroupUpdateInput): Promise<CarpoolGroup> {
    try {
      return await this.db.carpoolGroup.update({
        where: { id },
        data,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error updating carpool group',
        error instanceof Error ? error.stack : undefined,
        'CarpoolRepository.updateCarpoolGroup',
      );
      throw error;
    }
  }
}
