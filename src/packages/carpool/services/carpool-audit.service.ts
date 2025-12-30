import { Injectable } from '@nestjs/common';
import { clientDb } from '@/shared/utils';
import { globalLogger as Logger } from '@/shared/utils/logger';
import { Prisma } from '@prisma/client';

// TODO: Generate Prisma client after schema migration
type CarpoolActionType = 'MATCHED' | 'INVITE' | 'APPROVE' | 'DECLINE' | 'MERGE' | 'UNMERGE' | 'COST_RECALCULATED';

export interface AuditLogData {
  carpoolGroupId?: number;
  hostBookingId?: number;
  joinerBookingId?: number;
  actionType: CarpoolActionType;
  userId: string;
  oldValue?: any;
  newValue?: any;
  metadata?: any;
}

@Injectable()
export class CarpoolAuditService {
  private readonly db = clientDb;

  /**
   * Log carpool action to audit trail
   */
  async logAction(data: AuditLogData): Promise<void> {
    try {
      await (this.db as any).carpoolAuditLog.create({
        data: {
          carpoolGroupId: data.carpoolGroupId,
          hostBookingId: data.hostBookingId,
          joinerBookingId: data.joinerBookingId,
          actionType: data.actionType,
          userId: data.userId,
          oldValue: data.oldValue ? (data.oldValue as Prisma.JsonValue) : null,
          newValue: data.newValue ? (data.newValue as Prisma.JsonValue) : null,
          metadata: data.metadata ? (data.metadata as Prisma.JsonValue) : null,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      // Don't throw error - audit failure shouldn't block operations
      Logger.error(
        error instanceof Error ? error.message : 'Error logging carpool action',
        error instanceof Error ? error.stack : undefined,
        'CarpoolAuditService.logAction',
      );
    }
  }

  /**
   * Get audit logs for a carpool group
   */
  async getAuditLogs(carpoolGroupId: number): Promise<any[]> {
    try {
      return await (this.db as any).carpoolAuditLog.findMany({
        where: {
          carpoolGroupId,
        },
        orderBy: {
          timestamp: 'desc',
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error fetching audit logs',
        error instanceof Error ? error.stack : undefined,
        'CarpoolAuditService.getAuditLogs',
      );
      return [];
    }
  }
}
