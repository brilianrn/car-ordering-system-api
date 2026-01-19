import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { clientDb } from '../../../shared/utils';
import {
  AuditEvent,
  ChartData,
  CostMetrics,
  FinancialPipeline,
  RecapData,
  ReportFilters,
  SLAMetrics,
  UserContext,
  UtilizationMetrics,
} from '../domain/types';
import { ReportsRepositoryPort } from '../ports/repository.port';

@Injectable()
export class ReportsRepository implements ReportsRepositoryPort {
  private readonly db: PrismaClient = clientDb;
  private redis: Redis;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  }

  async getUserContext(userId: string): Promise<UserContext | null> {
    const employee = await this.db.employee.findFirst({
      where: { employeeId: userId },
      include: { orgUnit: true },
    });

    if (!employee) return null;

    return {
      userId,
      employeeId: employee.employeeId,
      plant: employee.orgUnit.code.split('-')[0],
      orgUnitId: employee.orgUnitId,
      orgUnitCode: employee.orgUnit.code,
      roles: employee.effectiveRoles,
      timezone: 'Asia/Jakarta',
    };
  }

  async getUtilizationMetrics(filters: ReportFilters, user: UserContext): Promise<UtilizationMetrics> {
    // Simplified queries without complex JOINs
    const vehicleCount = await this.db.vehicle.count({
      where: {
        status: { not: 'IN_SERVICE' },
        plantLocation: user.plant || undefined,
      },
    });

    const bookings = await this.db.booking.findMany({
      where: {
        startAt: { gte: filters.startDate, lte: filters.endDate },
        requester: {
          orgUnit: {
            code: user.orgUnitCode ? { equals: user.orgUnitCode } : user.plant ? { startsWith: user.plant } : undefined,
          },
        },
      },
      include: {
        segments: {
          include: {
            execution: true,
          },
        },
      },
    });

    let totalUsedHours = 0;
    let totalPassengers = 0;
    let totalCapacity = 0;
    let carpoolTrips = 0;

    for (const booking of bookings) {
      if (booking.carpoolGroupId) carpoolTrips++;
      totalPassengers += booking.passengerCount;
      
      for (const segment of booking.segments) {
        if (segment.execution?.checkInAt && segment.execution?.checkOutAt) {
          const hours = (segment.execution.checkOutAt.getTime() - segment.execution.checkInAt.getTime()) / (1000 * 60 * 60);
          totalUsedHours += hours;
        }
      }
    }

    const daysDiff = Math.ceil((filters.endDate.getTime() - filters.startDate.getTime()) / (1000 * 60 * 60 * 24));
    const totalAvailableHours = vehicleCount * 24 * daysDiff;

    return {
      vehicleUtilization: {
        percentage: (totalUsedHours / (totalAvailableHours || 1)) * 100,
        totalVehicles: vehicleCount,
        totalUsedHours,
        totalAvailableHours,
      },
      seatFillRate: {
        percentage: totalCapacity > 0 ? (totalPassengers / totalCapacity) * 100 : 0,
        totalPassengers,
        totalCapacity,
      },
      carpoolRate: {
        percentage: bookings.length > 0 ? (carpoolTrips / bookings.length) * 100 : 0,
        carpoolTrips,
        totalTrips: bookings.length,
      },
    };
  }

  async getSLAMetrics(filters: ReportFilters, user: UserContext): Promise<SLAMetrics> {
    const approvals = await this.db.approvalHeader.findMany({
      where: {
        booking: {
          startAt: { gte: filters.startDate, lte: filters.endDate },
          requester: {
            orgUnit: {
              code: user.orgUnitCode ? { equals: user.orgUnitCode } : user.plant ? { startsWith: user.plant } : undefined,
            },
          },
        },
      },
      include: {
        assignment: true,
      },
    });

    let slaL1Compliant = 0;
    let slaL1Total = 0;
    let slaL2Compliant = 0;
    let slaL2Total = 0;
    let totalL1Hours = 0;
    let totalL2Hours = 0;

    for (const approval of approvals) {
      if (approval.decisionTimeL1) {
        slaL1Total++;
        const l1Hours = (approval.decisionTimeL1.getTime() - approval.assignedAt.getTime()) / (1000 * 60 * 60);
        totalL1Hours += l1Hours;
        if (l1Hours <= 8) slaL1Compliant++;

        if (approval.assignment?.assignedAtL2 && approval.decisionL1 === 'APPROVED') {
          slaL2Total++;
          const l2Hours = (approval.assignment.assignedAtL2.getTime() - approval.decisionTimeL1.getTime()) / (1000 * 60 * 60);
          totalL2Hours += l2Hours;
          if (l2Hours <= 8) slaL2Compliant++;
        }
      }
    }

    const bookingSegments = await this.db.bookingSegment.count({
      where: {
        booking: {
          startAt: { gte: filters.startDate, lte: filters.endDate },
          bookingStatus: 'CANCELLED',
          cancelReason: { contains: 'NoShow' },
          requester: {
            orgUnit: {
              code: user.orgUnitCode ? { equals: user.orgUnitCode } : user.plant ? { startsWith: user.plant } : undefined,
            },
          },
        },
      },
    });

    const totalSegments = await this.db.bookingSegment.count({
      where: {
        booking: {
          startAt: { gte: filters.startDate, lte: filters.endDate },
          requester: {
            orgUnit: {
              code: user.orgUnitCode ? { equals: user.orgUnitCode } : user.plant ? { startsWith: user.plant } : undefined,
            },
          },
        },
      },
    });

    return {
      slaL1: {
        percentage: slaL1Total > 0 ? (slaL1Compliant / slaL1Total) * 100 : 0,
        compliantCount: slaL1Compliant,
        totalCount: slaL1Total,
        avgProcessingHours: slaL1Total > 0 ? totalL1Hours / slaL1Total : 0,
      },
      slaL2: {
        percentage: slaL2Total > 0 ? (slaL2Compliant / slaL2Total) * 100 : 0,
        compliantCount: slaL2Compliant,
        totalCount: slaL2Total,
        avgProcessingHours: slaL2Total > 0 ? totalL2Hours / slaL2Total : 0,
      },
      noShowRate: {
        percentage: totalSegments > 0 ? (bookingSegments / totalSegments) * 100 : 0,
        noShowCount: bookingSegments,
        totalSegments,
      },
    };
  }

  async getCostMetrics(filters: ReportFilters, user: UserContext): Promise<CostMetrics> {
    const verifications = await this.db.verificationHeader.findMany({
      where: {
        verifyStatus: 'VERIFIED',
        segmentExecution: {
          segment: {
            booking: {
              startAt: { gte: filters.startDate, lte: filters.endDate },
              requester: {
                orgUnit: {
                  code: user.orgUnitCode ? { equals: user.orgUnitCode } : user.plant ? { startsWith: user.plant } : undefined,
                },
              },
            },
          },
        },
      },
      include: {
        receiptItems: true,
        segmentExecution: {
          include: {
            segment: {
              include: {
                booking: {
                  include: {
                    category: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    let totalCost = 0;
    let totalDistance = 0;
    const categoryMap = new Map<string, { cost: number; count: number }>();

    for (const verification of verifications) {
      const itemCost = verification.receiptItems.reduce((sum, item) => sum + item.amountIdr, 0);
      totalCost += itemCost;

      if (verification.segmentExecution?.odoDistance) {
        totalDistance += verification.segmentExecution.odoDistance;
      }

      const categoryName = verification.segmentExecution?.segment?.booking?.category?.name || 'Unknown';
      const existing = categoryMap.get(categoryName) || { cost: 0, count: 0 };
      categoryMap.set(categoryName, {
        cost: existing.cost + itemCost,
        count: existing.count + 1,
      });
    }

    const costByCategory = Array.from(categoryMap.entries()).map(([name, data]) => ({
      categoryName: name,
      totalCost: data.cost,
      percentage: totalCost > 0 ? (data.cost / totalCost) * 100 : 0,
      tripCount: data.count,
    }));

    return {
      costPerKm: {
        amount: totalDistance > 0 ? totalCost / totalDistance : 0,
        totalCost,
        totalDistance,
        currency: 'IDR',
      },
      costByCategory: costByCategory.sort((a, b) => b.totalCost - a.totalCost),
    };
  }

  async getFinancialPipeline(filters: ReportFilters, user: UserContext): Promise<FinancialPipeline> {
    const whereClause = {
      startAt: { gte: filters.startDate, lte: filters.endDate },
      requester: {
        orgUnit: {
          code: user.orgUnitCode ? { equals: user.orgUnitCode } : user.plant ? { startsWith: user.plant } : undefined,
        },
      },
    };

    const submitted = await this.db.booking.count({
      where: { ...whereClause, bookingStatus: 'SUBMITTED' },
    });

    const posted = await this.db.verificationHeader.count({
      where: {
        verifyStatus: 'VERIFIED',
        reimburseTicket: null,
        segmentExecution: {
          segment: {
            booking: whereClause,
          },
        },
      },
    });

    const paid = await this.db.verificationHeader.count({
      where: {
        verifyStatus: 'VERIFIED',
        reimburseTicket: { not: null },
        segmentExecution: {
          segment: {
            booking: whereClause,
          },
        },
      },
    });

    return {
      submitted: { count: submitted, totalAmount: 0, avgAgingDays: 0 },
      posted: { count: posted, totalAmount: 0, avgAgingDays: 0 },
      paid: { count: paid, totalAmount: 0, avgAgingDays: 0 },
    };
  }

  async getMonthlyTrends(filters: ReportFilters, user: UserContext): Promise<ChartData['monthlyTrends']> {
    return [];
  }

  async getCostPareto(filters: ReportFilters, user: UserContext): Promise<ChartData['costPareto']> {
    const costData = await this.getCostMetrics(filters, user);
    let cumulativePercentage = 0;

    return costData.costByCategory.map((item) => {
      cumulativePercentage += item.percentage;
      return {
        category: item.categoryName,
        cost: item.totalCost,
        percentage: item.percentage,
        cumulativePercentage,
      };
    });
  }

  async getUtilizationHeatmap(filters: ReportFilters, user: UserContext): Promise<ChartData['utilizationHeatmap']> {
    return [];
  }

  async getUsageHeatmap(filters: ReportFilters, user: UserContext): Promise<ChartData['usageHeatmap']> {
    return [];
  }

  async getRecapData(
    filters: ReportFilters,
    user: UserContext,
    pagination: any,
  ): Promise<RecapData> {
    const bookings = await this.db.booking.findMany({
      where: {
        startAt: { gte: filters.startDate, lte: filters.endDate },
        requester: {
          orgUnit: {
            code: user.orgUnitCode ? { equals: user.orgUnitCode } : user.plant ? { startsWith: user.plant } : undefined,
          },
        },
      },
      include: {
        category: true,
        requester: { include: { orgUnit: true } },
        assignment: { include: { driverChosen: true, vehicleChosen: true } },
        segments: { include: { execution: { include: { verification: true } } } },
      },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    });

    const total = await this.db.booking.count({
      where: {
        startAt: { gte: filters.startDate, lte: filters.endDate },
        requester: {
          orgUnit: {
            code: user.orgUnitCode ? { equals: user.orgUnitCode } : user.plant ? { startsWith: user.plant } : undefined,
          },
        },
      },
    });

    const data = bookings.map((booking) => ({
      bookingId: booking.bookingNumber,
      bookingIdInternal: booking.id,
      docNumber: undefined,
      category: booking.category.name,
      plant: booking.requester.orgUnit.code.substring(0, 3),
      orgUnit: booking.requester.orgUnit.code,
      tripMode: booking.resourceMode,
      startDate: booking.startAt,
      endDate: booking.endAt,
      distance: 0,
      cost: 0,
      status: 'DRAFT',
      agingDays: 0,
      driverName: booking.assignment?.driverChosen?.fullName,
      driverType: booking.assignment?.driverChosen?.driverType,
      licensePlate: booking.assignment?.vehicleChosen?.licensePlate,
      costByCategory: [],
    }));

    return {
      data,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      },
    };
  }

  async getDataFreshness(): Promise<{ operationalData: Date; financialData: Date }> {
    return {
      operationalData: new Date(),
      financialData: new Date(),
    };
  }

  async logAuditEvent(event: AuditEvent): Promise<void> {
    await this.db.auditLog.create({
      data: {
        userNik: event.userId,
        featureCode: 'REPORTS',
        action: event.action,
        entityType: 'REPORT_QUERY',
        entityId: 0,
        beforeAfter: {
          filters: event.filters,
          datasetVersion: event.datasetVersion,
          renderTime: event.renderTime,
        },
      },
    });
  }

  async getCachedData(key: string): Promise<any> {
    try {
      const data = await this.redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  async setCachedData(key: string, data: any, ttl: number): Promise<void> {
    try {
      await this.redis.setex(key, ttl, JSON.stringify(data));
    } catch {
      // Ignore cache errors
    }
  }

  async invalidateCache(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch {
      // Ignore cache errors
    }
  }
}