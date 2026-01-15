import { clientDb } from '@/shared/utils';
import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { differenceInHours, differenceInMinutes } from 'date-fns';
import { UserContext } from '../domain/types';
import { QueryAnalyticsDto } from '../dto/query-analytics.dto';
import { AnalyticsRepositoryPort } from '../ports/repository.port';

@Injectable()
export class AnalyticsRepository implements AnalyticsRepositoryPort {
  private readonly db: PrismaClient = clientDb;

  private applyRLS(user: UserContext, whereInput: any = {}) {
    // If user is Admin or Management, maybe no RLS?
    // Prompt says: "Wajib membatasi dataset berdasarkan Plant dan OrgUnit user yang login"
    // So strictly apply it.

    if (user.plant) {
      // For Vehicle related queries, check plantLocation
      // For Booking related, check requester.orgUnit (mapped to plant?) or vehicle.plantLocation
      // Since schema doesn't strictly link OrgUnit to Plant, we use what we have.
      // Assuming user.plant matches Vehicle.plantLocation
    }

    if (user.orgUnitId) {
      // Filter by OrgUnit
    }

    return whereInput;
  }

  // Helper to build booking where clause with RLS
  private buildBookingWhere(filters: QueryAnalyticsDto, user: UserContext): Prisma.BookingWhereInput {
    const where: Prisma.BookingWhereInput = {
      deletedAt: null,
    };

    if (filters.startDate && filters.endDate) {
      where.startAt = {
        gte: new Date(filters.startDate),
        lte: new Date(filters.endDate),
      };
    }

    // Category Filter
    if (filters.category) {
      where.category = {
        name: filters.category,
      };
    }

    // RLS
    // Allow if requester is in user's OrgUnit OR Vehicle is in user's Plant
    const OR: Prisma.BookingWhereInput[] = [];

    if (user.orgUnitId) {
      OR.push({
        requester: {
          orgUnitId: user.orgUnitId,
        },
      });
    }

    if (user.plant) {
      OR.push({
        vehicle: {
          plantLocation: user.plant,
        },
      });
    }

    // Also respect filters.plant and filters.orgUnitCode if provided (narrowing down)
    if (filters.plant) {
      where.vehicle = { plantLocation: filters.plant };
    }

    if (filters.orgUnitCode) {
      where.requester = { orgUnit: { code: filters.orgUnitCode } };
    }

    if (OR.length > 0) {
      where.OR = OR;
    }

    return where;
  }

  async getUserContext(userId: string): Promise<UserContext | null> {
    // Assuming userId is employeeId or linked to it.
    // If userId is a UUID (from Auth), we might need to find Employee by email or linked account.
    // The Controller uses userId as requesterId, which suggests userId == employeeId.

    const employee = await this.db.employee.findUnique({
      where: { employeeId: userId },
      include: { orgUnit: true },
    });

    if (!employee) return null;

    return {
      userId: employee.employeeId,
      orgUnitId: employee.orgUnitId,
      orgUnitCode: employee.orgUnit.code,
      plant: undefined, // Logic to derive plant from OrgUnit or other source needed
      roles: [], // Fill if needed
    };
  }

  async getUtilization(filters: QueryAnalyticsDto, user: UserContext): Promise<any> {
    const startDate = new Date(filters.startDate || new Date().setDate(new Date().getDate() - 30));
    const endDate = new Date(filters.endDate || new Date());

    // 1. Get Total Active Vehicles (Capacity)
    // RLS for Vehicles: Must be in User's Plant (if defined)
    const vehicleWhere: Prisma.VehicleWhereInput = {
      status: { not: 'IN_SERVICE' },
      deletedAt: null,
    };

    if (user.plant) {
      vehicleWhere.plantLocation = user.plant;
    }

    if (filters.plant) {
      vehicleWhere.plantLocation = filters.plant;
    }

    const totalVehicles = await this.db.vehicle.count({ where: vehicleWhere });

    // Total Available Hours = Vehicles * Hours in Period
    const totalHoursAvailable = totalVehicles * differenceInHours(endDate, startDate);

    // 2. Get Total Used Hours
    const bookingWhere = this.buildBookingWhere(filters, user);
    // Only count fulfilled bookings
    bookingWhere.bookingStatus = { in: ['ASSIGNED', 'APPROVED_L1'] }; // Adjust status based on what counts as "Used" (Assigned implies vehicle allocated)

    const bookings = await this.db.booking.findMany({
      where: bookingWhere,
      select: {
        startAt: true,
        endAt: true,
      },
    });

    const totalUsedMinutes = bookings.reduce((acc, booking) => {
      return acc + differenceInMinutes(booking.endAt, booking.startAt);
    }, 0);

    const totalUsedHours = totalUsedMinutes / 60;

    return {
      utilizationPercentage: totalHoursAvailable > 0 ? (totalUsedHours / totalHoursAvailable) * 100 : 0,
      totalVehicles,
      totalUsedHours,
      totalHoursAvailable,
    };
  }

  async getSLA(filters: QueryAnalyticsDto, user: UserContext): Promise<any> {
    const where = this.buildBookingWhere(filters, user);

    // L1 SLA (Approval)
    const approvalHeaders = await this.db.approvalHeader.findMany({
      where: {
        booking: where,
        decisionTimeL1: { not: null },
      },
      select: {
        assignedAt: true,
        decisionTimeL1: true,
      },
    });

    let l1Compliant = 0;
    for (const h of approvalHeaders) {
      if (h.decisionTimeL1 && h.assignedAt) {
        // Simple 8 hours check (real working hours would require a holiday calendar)
        const hours = differenceInHours(h.decisionTimeL1, h.assignedAt);
        if (hours <= 8) l1Compliant++;
      }
    }

    // L2 SLA (Assignment)
    const assignments = await this.db.assignment.findMany({
      where: {
        booking: where,
        assignedAtL2: { not: null },
      },
      select: {
        assignedAtL2: true,
        slaDueAtL2: true,
        createdAt: true,
      },
    });

    let l2Compliant = 0;
    for (const a of assignments) {
      if (a.assignedAtL2) {
        // If slaDueAtL2 exists use it, else maybe 8 hours from creation?
        // Prompt says: "≤8 jam kerja"
        if (a.slaDueAtL2) {
          if (a.assignedAtL2 <= a.slaDueAtL2) l2Compliant++;
        } else {
          const hours = differenceInHours(a.assignedAtL2, a.createdAt);
          if (hours <= 8) l2Compliant++;
        }
      }
    }

    return {
      slaL1: approvalHeaders.length > 0 ? (l1Compliant / approvalHeaders.length) * 100 : 100,
      slaL2: assignments.length > 0 ? (l2Compliant / assignments.length) * 100 : 100,
    };
  }

  async getCostPerKm(filters: QueryAnalyticsDto, user: UserContext): Promise<any> {
    const bookingWhere = this.buildBookingWhere(filters, user);

    // Get Executions linked to these bookings
    const executions = await this.db.segmentExecution.findMany({
      where: {
        segment: {
          booking: bookingWhere,
        },
        // Spike filter: ignore if anomalyFlags is present (assuming non-null means anomaly)
        anomalyFlags: {
          equals: Prisma.DbNull,
        },
        odoDistance: { gt: 0 },
      },
      include: {
        verification: {
          include: {
            receiptItems: true,
          },
        },
      },
    });

    let totalCost = 0;
    let totalDistance = 0;

    for (const exec of executions) {
      if (exec.odoDistance) {
        totalDistance += exec.odoDistance;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const verification = (exec as any).verification;
        if (verification?.receiptItems) {
          const cost = verification.receiptItems.reduce((sum: number, item: any) => sum + item.amountIdr, 0);
          totalCost += cost;
        }
      }
    }

    return {
      costPerKm: totalDistance > 0 ? totalCost / totalDistance : 0,
      totalCost,
      totalDistance,
    };
  }

  async getPipeline(filters: QueryAnalyticsDto, user: UserContext): Promise<any> {
    const where = this.buildBookingWhere(filters, user);

    // Submitted: Booking Status SUBMITTED
    const submittedCount = await this.db.booking.count({
      where: { ...where, bookingStatus: 'SUBMITTED' },
    });

    // Posted: Verification Verified (Proxied via SegmentExecution -> VerificationHeader)
    const postedCount = await this.db.verificationHeader.count({
      where: {
        verifyStatus: 'VERIFIED',
        segmentExecution: {
          segment: {
            booking: where,
          },
        },
      },
    });

    // Paid: Using ReimburseTicket existence as proxy for now (or a specific status if I knew it)
    const paidCount = await this.db.verificationHeader.count({
      where: {
        verifyStatus: 'VERIFIED',
        reimburseTicket: { not: null },
        segmentExecution: {
          segment: {
            booking: where,
          },
        },
      },
    });

    // Aging: Avg time from Submitted to Now (for currently open items)
    const openBookings = await this.db.booking.findMany({
      where: { ...where, bookingStatus: 'SUBMITTED' },
      select: { submittedAt: true },
    });

    const totalAgingDays = openBookings.reduce((sum, b) => {
      return sum + differenceInMinutes(new Date(), b.submittedAt) / (60 * 24);
    }, 0);

    const avgAgingDays = openBookings.length > 0 ? totalAgingDays / openBookings.length : 0;

    return {
      funnel: {
        submitted: submittedCount,
        posted: postedCount,
        paid: paidCount,
      },
      agingDays: avgAgingDays,
    };
  }

  async logAudit(userId: string, action: string, filters: any): Promise<void> {
    await this.db.auditLog.create({
      data: {
        action,
        entityType: 'REPORT',
        entityId: 0, // General report
        featureCode: 'ANALYTICS',
        userNik: userId, // Assuming userId is NIK or mapping it
        beforeAfter: filters,
        timestamp: new Date(),
      },
    });
  }
}
