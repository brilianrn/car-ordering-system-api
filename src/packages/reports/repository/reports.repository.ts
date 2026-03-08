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
    const employee = await this.db.employee.findUnique({
      where: { employeeId: userId },
      include: { orgUnit: true },
    });

    if (!employee) return null;

    const hasOrgWideAccess = employee.effectiveRoles.some((role) =>
      ['FINANCE', 'MANAGEMENT', 'ADMIN', 'AUDITOR', 'GA'].includes(role.toUpperCase()),
    );

    return {
      userId,
      employeeId: employee.employeeId,
      plant: hasOrgWideAccess ? undefined : employee.orgUnit.code.split('-')[0], // Extract plant from org code
      orgUnitId: employee.orgUnitId,
      orgUnitCode: hasOrgWideAccess ? undefined : employee.orgUnit.code,
      roles: employee.effectiveRoles,
      timezone: 'Asia/Jakarta',
    };
  }

  async getUtilizationMetrics(filters: ReportFilters, user: UserContext): Promise<UtilizationMetrics> {
    const cacheKey = `utilization:${user.userId}:${JSON.stringify(filters)}`;
    const cached = await this.getCachedData(cacheKey);
    if (cached) return cached;

    // Vehicle Utilization Query - Simplified to avoid GROUP BY issues
    const vehicleUtil = (await this.db.$queryRaw`
      SELECT 
        COUNT(DISTINCT v.id) as total_vehicles,
        COALESCE(SUM(CASE WHEN se.check_out_at IS NOT NULL AND se.check_in_at IS NOT NULL 
                          THEN EXTRACT(EPOCH FROM (se.check_out_at - se.check_in_at)) / 3600 
                          ELSE 0 END), 0) as total_used_hours
      FROM vehicle v
      LEFT JOIN assignment a ON v.id = a.vehicle_chosen_id
      LEFT JOIN booking b ON a.booking_id = b.id
      LEFT JOIN booking_segment bs ON b.id = bs.booking_id
      LEFT JOIN segment_execution se ON bs.id = se.segment_id
      WHERE v.status != 'IN_SERVICE'
        AND (${user.plant}::text IS NULL OR v.plant_location = ${user.plant})
        -- Pindahkan filter start_at ke WHERE dan gunakan COALESCE atau pastikan handle null
        AND (b.id IS NULL OR (b.start_at >= ${filters.startDate} AND b.start_at <= ${filters.endDate}))
    `) as any[];

    // Calculate total available hours separately
    const totalVehicles = Number(vehicleUtil[0]?.total_vehicles || 0);
    const daysDiff = Math.ceil((filters.endDate.getTime() - filters.startDate.getTime()) / (1000 * 60 * 60 * 24));
    const totalAvailableHours = totalVehicles * 24 * daysDiff;

    // Seat Fill Rate Query
    const seatFill = (await this.db.$queryRaw`
      SELECT 
        COALESCE(SUM(sub.passenger_count), 0) as total_passengers,
        COALESCE(SUM(sub.seat_capacity), 0) as total_capacity
      FROM (
        SELECT b.passenger_count, v.seat_capacity
        FROM booking b
        JOIN assignment a ON b.id = a.booking_id
        JOIN vehicle v ON a.vehicle_chosen_id = v.id
        JOIN employee e ON b.requester_id = e.employee_id
        JOIN organization_unit ou ON e.org_unit_id = ou.id
        WHERE b.booking_status IN ('APPROVED_L1', 'ASSIGNED')
          AND (${user.plant}::text IS NULL OR v.plant_location = ${user.plant})
          AND (${user.orgUnitCode}::text IS NULL OR ou.code = ${user.orgUnitCode})
          AND b.start_at >= ${filters.startDate}
          AND b.start_at <= ${filters.endDate}
      ) sub
    `) as any[];

    // Carpool Rate Query
    const carpoolData = (await this.db.$queryRaw`
      SELECT 
        COUNT(DISTINCT CASE WHEN sub.carpool_group_id IS NOT NULL THEN sub.id END) as carpool_trips,
        COUNT(DISTINCT sub.id) as total_trips
      FROM (
        SELECT b.id, b.carpool_group_id
        FROM booking b
        JOIN employee e ON b.requester_id = e.employee_id
        JOIN organization_unit ou ON e.org_unit_id = ou.id
        WHERE b.booking_status IN ('APPROVED_L1', 'ASSIGNED', 'MERGED')
          AND (${user.plant}::text IS NULL OR ou.code LIKE ${user.plant + '%'})
          AND (${user.orgUnitCode}::text IS NULL OR ou.code = ${user.orgUnitCode})
          AND b.start_at >= ${filters.startDate}
          AND b.start_at <= ${filters.endDate}
      ) sub
    `) as any[];

    const result: UtilizationMetrics = {
      vehicleUtilization: {
        percentage: (Number(vehicleUtil[0]?.total_used_hours || 0) / (totalAvailableHours || 1)) * 100,
        totalVehicles: totalVehicles,
        totalUsedHours: Number(vehicleUtil[0]?.total_used_hours || 0),
        totalAvailableHours: totalAvailableHours,
      },
      seatFillRate: {
        percentage: (Number(seatFill[0]?.total_passengers || 0) / Number(seatFill[0]?.total_capacity || 1)) * 100,
        totalPassengers: Number(seatFill[0]?.total_passengers || 0),
        totalCapacity: Number(seatFill[0]?.total_capacity || 0),
      },
      carpoolRate: {
        percentage: (Number(carpoolData[0]?.carpool_trips || 0) / Number(carpoolData[0]?.total_trips || 1)) * 100,
        carpoolTrips: Number(carpoolData[0]?.carpool_trips || 0),
        totalTrips: Number(carpoolData[0]?.total_trips || 0),
      },
    };

    await this.setCachedData(cacheKey, result, 300); // 5 minutes
    return result;
  }

  async getSLAMetrics(filters: ReportFilters, user: UserContext): Promise<SLAMetrics> {
    const cacheKey = `sla:${user.userId}:${JSON.stringify(filters)}`;
    const cached = await this.getCachedData(cacheKey);
    if (cached) return cached;

    const slaData = (await this.db.$queryRaw`
      SELECT 
        COUNT(*) FILTER (WHERE sub.diff_l1 <= 8) as sla_l1_compliant,
        COUNT(*) FILTER (WHERE sub.decision_time_l1 IS NOT NULL) as sla_l1_total,
        AVG(sub.diff_l1) FILTER (WHERE sub.decision_time_l1 IS NOT NULL) as avg_l1_hours,
        COUNT(*) FILTER (WHERE sub.diff_l2 <= 8 AND sub.decision_l1 = 'APPROVED') as sla_l2_compliant,
        COUNT(*) FILTER (WHERE sub.assigned_at_l2 IS NOT NULL AND sub.decision_l1 = 'APPROVED') as sla_l2_total,
        AVG(sub.diff_l2) FILTER (WHERE sub.assigned_at_l2 IS NOT NULL AND sub.decision_l1 = 'APPROVED') as avg_l2_hours
      FROM (
        SELECT 
          ah.decision_time_l1, ah.decision_l1, ah.assigned_at,
          a.assigned_at_l2,
          EXTRACT(EPOCH FROM (ah.decision_time_l1 - ah.assigned_at)) / 3600 as diff_l1,
          EXTRACT(EPOCH FROM (a.assigned_at_l2 - ah.decision_time_l1)) / 3600 as diff_l2
        FROM approval_header ah
        JOIN booking b ON ah.booking_id = b.id
        JOIN employee e ON b.requester_id = e.employee_id
        JOIN organization_unit ou ON e.org_unit_id = ou.id
        LEFT JOIN assignment a ON ah.id = a.approval_header_id
        WHERE (${user.plant}::text IS NULL OR ou.code LIKE ${user.plant + '%'})
          AND (${user.orgUnitCode}::text IS NULL OR ou.code = ${user.orgUnitCode})
          AND b.start_at >= ${filters.startDate}
          AND b.start_at <= ${filters.endDate}
      ) sub
    `) as any[];

    const noShowData = (await this.db.$queryRaw`
  SELECT 
    COUNT(*) FILTER (WHERE sub.booking_status = 'CANCELLED' AND sub.cancel_reason LIKE '%NoShow%') as no_show_count,
    COUNT(*) as total_segments
  FROM (
    SELECT b.booking_status, b.cancel_reason
    FROM booking_segment bs
    JOIN booking b ON bs.booking_id = b.id
    JOIN employee e ON b.requester_id = e.employee_id
    JOIN organization_unit ou ON e.org_unit_id = ou.id
    WHERE (${user.plant}::text IS NULL OR ou.code LIKE ${user.plant + '%'})
      AND (${user.orgUnitCode}::text IS NULL OR ou.code = ${user.orgUnitCode})
      AND b.start_at >= ${filters.startDate}
      AND b.start_at <= ${filters.endDate}
  ) sub
`) as any[];

    const result: SLAMetrics = {
      slaL1: {
        percentage: (Number(slaData[0]?.sla_l1_compliant || 0) / Number(slaData[0]?.sla_l1_total || 1)) * 100,
        compliantCount: Number(slaData[0]?.sla_l1_compliant || 0),
        totalCount: Number(slaData[0]?.sla_l1_total || 0),
        avgProcessingHours: Number(slaData[0]?.avg_l1_hours || 0),
      },
      slaL2: {
        percentage: (Number(slaData[0]?.sla_l2_compliant || 0) / Number(slaData[0]?.sla_l2_total || 1)) * 100,
        compliantCount: Number(slaData[0]?.sla_l2_compliant || 0),
        totalCount: Number(slaData[0]?.sla_l2_total || 0),
        avgProcessingHours: Number(slaData[0]?.avg_l2_hours || 0),
      },
      noShowRate: {
        percentage: (Number(noShowData[0]?.no_show_count || 0) / Number(noShowData[0]?.total_segments || 1)) * 100,
        noShowCount: Number(noShowData[0]?.no_show_count || 0),
        totalSegments: Number(noShowData[0]?.total_segments || 0),
      },
    };

    await this.setCachedData(cacheKey, result, 300);
    return result;
  }

  async getCostMetrics(filters: ReportFilters, user: UserContext): Promise<CostMetrics> {
    const cacheKey = `cost:${user.userId}:${JSON.stringify(filters)}`;
    const cached = await this.getCachedData(cacheKey);
    if (cached) return cached;

    // First get all ODO distances to apply spike filter
    const odoData = (await this.db.$queryRaw`
      SELECT 
        se.id,
        se.odo_distance,
        COALESCE(SUM(ri.amount_idr), 0) as segment_cost
      FROM segment_execution se
      JOIN verification_header vh ON se.id = vh.segment_execution_id
      JOIN receipt_item ri ON vh.id = ri.verify_id
      JOIN booking_segment bs ON se.segment_id = bs.id
      JOIN booking b ON bs.booking_id = b.id
      JOIN employee e ON b.requester_id = e.employee_id
      JOIN organization_unit ou ON e.org_unit_id = ou.id
      WHERE vh.verify_status = 'VERIFIED'
        AND se.odo_distance IS NOT NULL
        AND se.odo_distance > 0
        AND (${user.plant}::text IS NULL OR ou.code LIKE ${user.plant + '%'})
        AND (${user.orgUnitCode}::text IS NULL OR ou.code = ${user.orgUnitCode})
        AND b.start_at >= ${filters.startDate}
        AND b.start_at <= ${filters.endDate}
      GROUP BY se.id, se.odo_distance
      ORDER BY se.odo_distance
    `) as any[];

    // Apply spike filter: remove outliers using IQR method
    const distances = odoData.map((d) => Number(d.odo_distance)).filter((d) => d > 0);
    let filteredDistances = distances;
    let filteredCosts = odoData.map((d) => Number(d.segment_cost));

    if (distances.length > 10) {
      // Calculate IQR for spike detection
      const sorted = [...distances].sort((a, b) => a - b);
      const q1Index = Math.floor(sorted.length * 0.25);
      const q3Index = Math.floor(sorted.length * 0.75);
      const q1 = sorted[q1Index];
      const q3 = sorted[q3Index];
      const iqr = q3 - q1;
      const lowerBound = q1 - 1.5 * iqr;
      const upperBound = q3 + 1.5 * iqr;

      // Filter out spikes
      const filtered = odoData.filter((d) => {
        const dist = Number(d.odo_distance);
        return dist >= lowerBound && dist <= upperBound;
      });
      filteredDistances = filtered.map((d) => Number(d.odo_distance));
      filteredCosts = filtered.map((d) => Number(d.segment_cost));
    }

    const totalCost = filteredCosts.reduce((sum, cost) => sum + cost, 0);
    const totalDistance = filteredDistances.reduce((sum, dist) => sum + dist, 0);

    const costPerKm = [{ total_cost: totalCost, total_distance: totalDistance }];

    const costByCategory = (await this.db.$queryRaw`
      SELECT 
        c.name as category_name,
        COALESCE(SUM(ri.amount_idr), 0) as total_cost,
        COUNT(DISTINCT b.id) as trip_count
      FROM category c
      LEFT JOIN booking b ON c.id = b.category_id 
        AND b.start_at >= ${filters.startDate}
        AND b.start_at <= ${filters.endDate}
      LEFT JOIN employee e ON b.requester_id = e.employee_id
      LEFT JOIN organization_unit ou ON e.org_unit_id = ou.id
      LEFT JOIN booking_segment bs ON b.id = bs.booking_id
      LEFT JOIN segment_execution se ON bs.id = se.segment_id
      LEFT JOIN verification_header vh ON se.id = vh.segment_execution_id
      LEFT JOIN receipt_item ri ON vh.id = ri.verify_id
      WHERE (vh.verify_status IS NULL OR vh.verify_status = 'VERIFIED')
        AND (${user.plant}::text IS NULL OR ou.code IS NULL OR ou.code LIKE ${user.plant + '%'})
        AND (${user.orgUnitCode}::text IS NULL OR ou.code IS NULL OR ou.code = ${user.orgUnitCode})
      GROUP BY c.id, c.name
      ORDER BY total_cost DESC
    `) as any[];

    const totalCostSum = costByCategory.reduce((sum, item) => sum + Number(item.total_cost), 0);

    const result: CostMetrics = {
      costPerKm: {
        amount: Number(costPerKm[0]?.total_cost || 0) / Number(costPerKm[0]?.total_distance || 1),
        totalCost: Number(costPerKm[0]?.total_cost || 0),
        totalDistance: Number(costPerKm[0]?.total_distance || 0),
        currency: 'IDR',
      },
      costByCategory: costByCategory.map((item) => ({
        categoryName: item.category_name,
        totalCost: Number(item.total_cost),
        percentage: (Number(item.total_cost) / totalCostSum) * 100,
        tripCount: Number(item.trip_count),
      })),
    };

    await this.setCachedData(cacheKey, result, 300);
    return result;
  }

  async getFinancialPipeline(filters: ReportFilters, user: UserContext): Promise<FinancialPipeline> {
    const cacheKey = `pipeline:${user.userId}:${JSON.stringify(filters)}`;
    const cached = await this.getCachedData(cacheKey);
    if (cached) return cached;

    // Submitted: Bookings with status SUBMITTED
    const submittedData = (await this.db.$queryRaw`
      SELECT 
        COUNT(DISTINCT sub.id) as count,
        COALESCE(SUM(sub.amount), 0) as total_amount,
        COALESCE(AVG(sub.aging), 0) as avg_aging_days
      FROM (
        SELECT 
          b.id, ri.amount_idr as amount,
          EXTRACT(DAY FROM NOW() - b.submitted_at) as aging
        FROM booking b
        JOIN employee e ON b.requester_id = e.employee_id
        JOIN organization_unit ou ON e.org_unit_id = ou.id
        LEFT JOIN booking_segment bs ON b.id = bs.booking_id
        LEFT JOIN segment_execution se ON bs.id = se.segment_id
        LEFT JOIN verification_header vh ON se.id = vh.segment_execution_id
        LEFT JOIN receipt_item ri ON vh.id = ri.verify_id
        WHERE b.booking_status = 'SUBMITTED'
          AND (${user.plant}::text IS NULL OR ou.code LIKE ${user.plant + '%'})
          AND (${user.orgUnitCode}::text IS NULL OR ou.code = ${user.orgUnitCode})
          AND b.start_at >= ${filters.startDate}
          AND b.start_at <= ${filters.endDate}
      ) sub
    `) as any[];

    // Posted: Verification status VERIFIED (but not yet paid)
    const postedData = (await this.db.$queryRaw`
      SELECT 
        COUNT(DISTINCT vh.id) as count,
        COALESCE(SUM(ri.amount_idr), 0) as total_amount,
        AVG(EXTRACT(DAY FROM NOW() - vh.verified_at)) as avg_aging_days
      FROM verification_header vh
      JOIN receipt_item ri ON vh.id = ri.verify_id
      JOIN segment_execution se ON vh.segment_execution_id = se.id
      JOIN booking_segment bs ON se.segment_id = bs.id
      JOIN booking b ON bs.booking_id = b.id
      JOIN employee e ON b.requester_id = e.employee_id
      JOIN organization_unit ou ON e.org_unit_id = ou.id
      WHERE vh.verify_status = 'VERIFIED'
        AND vh.reimburse_ticket IS NULL
        AND (${user.plant}::text IS NULL OR ou.code LIKE ${user.plant + '%'})
        AND (${user.orgUnitCode}::text IS NULL OR ou.code = ${user.orgUnitCode})
        AND b.start_at >= ${filters.startDate}
        AND b.start_at <= ${filters.endDate}
    `) as any[];

    // Paid: Verification status VERIFIED with reimburse_ticket (SAP doc number)
    const paidData = (await this.db.$queryRaw`
      SELECT 
        COUNT(DISTINCT vh.id) as count,
        COALESCE(SUM(ri.amount_idr), 0) as total_amount,
        AVG(EXTRACT(DAY FROM NOW() - vh.verified_at)) as avg_aging_days
      FROM verification_header vh
      JOIN receipt_item ri ON vh.id = ri.verify_id
      JOIN segment_execution se ON vh.segment_execution_id = se.id
      JOIN booking_segment bs ON se.segment_id = bs.id
      JOIN booking b ON bs.booking_id = b.id
      JOIN employee e ON b.requester_id = e.employee_id
      JOIN organization_unit ou ON e.org_unit_id = ou.id
      WHERE vh.verify_status = 'VERIFIED'
        AND vh.reimburse_ticket IS NOT NULL
        AND (${user.plant}::text IS NULL OR ou.code LIKE ${user.plant + '%'})
        AND (${user.orgUnitCode}::text IS NULL OR ou.code = ${user.orgUnitCode})
        AND b.start_at >= ${filters.startDate}
        AND b.start_at <= ${filters.endDate}
    `) as any[];

    const result: FinancialPipeline = {
      submitted: {
        count: Number(submittedData[0]?.count || 0),
        totalAmount: Number(submittedData[0]?.total_amount || 0),
        avgAgingDays: Number(submittedData[0]?.avg_aging_days || 0),
      },
      posted: {
        count: Number(postedData[0]?.count || 0),
        totalAmount: Number(postedData[0]?.total_amount || 0),
        avgAgingDays: Number(postedData[0]?.avg_aging_days || 0),
      },
      paid: {
        count: Number(paidData[0]?.count || 0),
        totalAmount: Number(paidData[0]?.total_amount || 0),
        avgAgingDays: Number(paidData[0]?.avg_aging_days || 0),
      },
    };

    await this.setCachedData(cacheKey, result, 900); // 15 minutes
    return result;
  }

  async getMonthlyTrends(filters: ReportFilters, user: UserContext): Promise<ChartData['monthlyTrends']> {
    const trends = (await this.db.$queryRaw`
      SELECT 
        sub.month,
        AVG(sub.util_calc) as utilization,
        AVG(sub.cost_calc) as cost,
        COUNT(DISTINCT sub.id) as trip_count
      FROM (
        SELECT 
          TO_CHAR(b.start_at, 'YYYY-MM') as month,
          b.id,
          CASE WHEN se.odo_distance > 0 THEN EXTRACT(EPOCH FROM (se.check_out_at - se.check_in_at)) / 3600 / se.odo_distance * 100 ELSE 0 END as util_calc,
          ri.amount_idr / NULLIF(se.odo_distance, 0) as cost_calc
        FROM booking b
        JOIN booking_segment bs ON b.id = bs.booking_id
        JOIN segment_execution se ON bs.id = se.segment_id
        JOIN verification_header vh ON se.id = vh.segment_execution_id
        JOIN receipt_item ri ON vh.id = ri.verify_id
        JOIN employee e ON b.requester_id = e.employee_id
        JOIN organization_unit ou ON e.org_unit_id = ou.id
        WHERE vh.verify_status = 'VERIFIED'
          AND (${user.plant}::text IS NULL OR ou.code LIKE ${user.plant + '%'})
          AND (${user.orgUnitCode}::text IS NULL OR ou.code = ${user.orgUnitCode})
          AND b.start_at >= ${filters.startDate}
          AND b.start_at <= ${filters.endDate}
      ) sub
      GROUP BY sub.month
      ORDER BY sub.month
    `) as any[];

    return trends.map((item) => ({
      month: item.month,
      utilization: Number(item.utilization || 0),
      cost: Number(item.cost || 0),
      tripCount: Number(item.trip_count || 0),
    }));
  }
  async getCostPareto(filters: ReportFilters, user: UserContext): Promise<ChartData['costPareto']> {
    const costData = await this.getCostMetrics(filters, user);
    let cumulativePercentage = 0;

    return costData.costByCategory
      .sort((a, b) => b.totalCost - a.totalCost)
      .map((item) => {
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
    const heatmapData = (await this.db.$queryRaw`
      SELECT 
        sub.org_unit,
        sub.plant,
        AVG(sub.util_calc) as utilization,
        COUNT(DISTINCT sub.id) as trip_count
      FROM (
        SELECT 
          ou.code as org_unit,
          SUBSTRING(ou.code, 1, 3) as plant,
          b.id,
          CASE WHEN se.odo_distance > 0 
               THEN EXTRACT(EPOCH FROM (se.check_out_at - se.check_in_at)) / 3600 / se.odo_distance * 100 
               ELSE 0 END as util_calc
        FROM booking b
        JOIN employee e ON b.requester_id = e.employee_id
        JOIN organization_unit ou ON e.org_unit_id = ou.id
        JOIN booking_segment bs ON b.id = bs.booking_id
        JOIN segment_execution se ON bs.id = se.segment_id
        WHERE (${user.plant}::text IS NULL OR ou.code LIKE ${user.plant + '%'})
          AND (${user.orgUnitCode}::text IS NULL OR ou.code = ${user.orgUnitCode})
          AND b.start_at >= ${filters.startDate}
          AND b.start_at <= ${filters.endDate}
      ) sub
      GROUP BY sub.org_unit, sub.plant
      ORDER BY utilization DESC
    `) as any[];

    return heatmapData.map((item) => ({
      plant: item.plant,
      orgUnit: item.org_unit,
      utilization: Number(item.utilization || 0),
      tripCount: Number(item.trip_count || 0),
    }));
  }

  async getUsageHeatmap(filters: ReportFilters, user: UserContext): Promise<ChartData['usageHeatmap']> {
    // Daily heatmap (grouped by date) menggunakan subquery untuk keamanan GROUP BY
    const dailyData = (await this.db.$queryRaw`
      SELECT 
        sub.date_only as date,
        COUNT(DISTINCT sub.id) as trip_count,
        AVG(sub.utilization) as utilization
      FROM (
        SELECT 
          b.id,
          DATE(b.start_at AT TIME ZONE ${filters.timezone}) as date_only,
          CASE WHEN se.odo_distance > 0 
               THEN EXTRACT(EPOCH FROM (se.check_out_at - se.check_in_at)) / 3600 
               ELSE 0 END as utilization
        FROM booking b
        JOIN employee e ON b.requester_id = e.employee_id
        JOIN organization_unit ou ON e.org_unit_id = ou.id
        LEFT JOIN booking_segment bs ON b.id = bs.booking_id
        LEFT JOIN segment_execution se ON bs.id = se.segment_id
        WHERE (${user.plant}::text IS NULL OR ou.code LIKE ${user.plant + '%'})
          AND (${user.orgUnitCode}::text IS NULL OR ou.code = ${user.orgUnitCode})
          AND b.start_at >= ${filters.startDate}
          AND b.start_at <= ${filters.endDate}
      ) sub
      GROUP BY sub.date_only
      ORDER BY sub.date_only
    `) as any[];

    return dailyData.map((item) => ({
      date: item.date ? new Date(item.date).toISOString().split('T')[0] : '',
      tripCount: Number(item.trip_count || 0),
      utilization: Number(item.utilization || 0),
    }));
  }

  async getRecapData(
    filters: ReportFilters,
    user: UserContext,
    pagination: {
      page: number;
      limit: number;
      sortBy: string;
      sortOrder: string;
      search?: string;
      drillDownLevel?: string;
    },
  ): Promise<RecapData> {
    const offset = (pagination.page - 1) * pagination.limit;

    // Build org-scoping filter safely (undefined means no restriction)
    const orgFilter: any = {
      requester: {
        orgUnit: user.orgUnitCode
          ? { code: user.orgUnitCode }
          : user.plant
            ? { code: { startsWith: user.plant } }
            : undefined,
      },
    };

    // Search filter
    const searchWhere = pagination.search
      ? {
          OR: [
            { bookingNumber: { contains: pagination.search, mode: 'insensitive' as const } },
            { category: { name: { contains: pagination.search, mode: 'insensitive' as const } } },
            {
              assignment: {
                driverChosen: {
                  fullName: { contains: pagination.search, mode: 'insensitive' as const },
                },
              },
            },
            {
              assignment: {
                vehicleChosen: {
                  licensePlate: { contains: pagination.search, mode: 'insensitive' as const },
                },
              },
            },
          ],
        }
      : {};

    const where: any = {
      ...orgFilter,
      ...searchWhere,
      bookingStatus: 'FINISHED',
      startAt: { gte: filters.startDate, lte: filters.endDate },
    };

    const [bookings, total] = await Promise.all([
      this.db.booking.findMany({
        where,
        skip: offset,
        take: pagination.limit,
        orderBy: { startAt: pagination.sortOrder.toLowerCase() === 'asc' ? 'asc' : 'desc' },
        include: {
          category: { select: { name: true } },
          requester: { include: { orgUnit: true } },
          assignment: {
            include: {
              driverChosen: { select: { fullName: true, driverType: true } },
              vehicleChosen: { select: { licensePlate: true } },
            },
          },
          segments: {
            include: {
              execution: {
                include: {
                  verification: {
                    include: { receiptItems: true },
                  },
                },
              },
            },
          },
        },
      }) as Promise<any[]>,
      this.db.booking.count({ where }),
    ]);

    const data = (bookings as any[]).map((b: any) => {
      const orgCode = b.requester?.orgUnit?.code || '';
      const plant = orgCode.substring(0, 3);

      let totalDistance = 0;
      let totalCost = 0;
      let verifyStatus: string | undefined;
      let lastActivityAt: Date | undefined;
      let driverName: string | undefined;
      let driverType: string | undefined;
      let licensePlate: string | undefined;
      let docNumber: string | undefined;
      const costByCategoryMap: Map<string, number> = new Map();

      if (b.assignment) {
        driverName = b.assignment.driverChosen?.fullName;
        driverType = b.assignment.driverChosen?.driverType;
        licensePlate = b.assignment.vehicleChosen?.licensePlate;
      }

      for (const seg of b.segments || []) {
        if (seg.execution) {
          const exec = seg.execution;
          totalDistance += Number(exec.odoDistance || 0);

          const vh = exec.verification || exec.verificationHeader;
          if (vh) {
            verifyStatus = vh.verifyStatus || verifyStatus;
            lastActivityAt = vh.verifiedAt || lastActivityAt;
            docNumber = vh.reimburseTicket || docNumber;

            for (const ri of vh.receiptItems || []) {
              const cost = Number(ri.amountIdr || 0);
              const cat = ri.category || 'OTHER';
              totalCost += cost;
              costByCategoryMap.set(cat, (costByCategoryMap.get(cat) || 0) + cost);
            }
          }
        }
      }

      const agingFrom = lastActivityAt || b.submittedAt || b.createdAt;
      const agingDays = (Date.now() - new Date(agingFrom).getTime()) / (1000 * 60 * 60 * 24);

      return {
        bookingId: b.bookingNumber,
        bookingIdInternal: b.id,
        docNumber,
        category: b.category?.name || '',
        plant,
        orgUnit: orgCode,
        tripMode: b.resourceMode,
        startDate: b.startAt,
        endDate: b.endAt,
        distance: totalDistance,
        cost: totalCost,
        status: verifyStatus || b.bookingStatus,
        agingDays,
        driverName,
        driverType,
        licensePlate,
        costByCategory: Array.from(costByCategoryMap.entries()).map(([category, amount]) => ({
          category,
          amount,
        })),
      };
    });

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
    const [operational, financial] = await Promise.all([
      this.db.segmentExecution.aggregate({
        _max: { updatedAt: true },
      }),
      this.db.verificationHeader.aggregate({
        _max: { updatedAt: true },
      }),
    ]);

    return {
      operationalData: operational._max.updatedAt || new Date(),
      financialData: financial._max.updatedAt || new Date(),
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
