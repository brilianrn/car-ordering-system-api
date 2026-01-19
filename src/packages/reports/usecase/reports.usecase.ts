import { validationMessage } from '@/shared/constants/validation-message';
import { IUsecaseResponse } from '@/shared/utils/rest-api/types';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { endOfMonth, startOfMonth, subMonths } from 'date-fns';
import * as ExcelJS from 'exceljs';
import {
  AuditEvent,
  ChartData,
  DashboardData,
  RecapData,
  ReportFilters,
  ReportSummary,
  UserContext,
} from '../domain/types';
import { ExportReportDto, RecapQueryDto, ReportQueryDto } from '../dto/report-query.dto';
import { ReportsRepositoryPort } from '../ports/repository.port';

@Injectable()
export class ReportsService {
  constructor(
    @Inject('ReportsRepositoryPort')
    private readonly repository: ReportsRepositoryPort,
  ) {}

  async getSummary(query: ReportQueryDto, userId: string): Promise<IUsecaseResponse<ReportSummary>> {
    try {
      const startTime = Date.now();
      const user = await this.repository.getUserContext(userId);
      if (!user) throw new Error('User not found');

      const filters = this.buildFilters(query, user);

      const [utilization, sla, cost, pipeline, dataFreshness] = await Promise.all([
        this.repository.getUtilizationMetrics(filters, user),
        this.repository.getSLAMetrics(filters, user),
        this.repository.getCostMetrics(filters, user),
        this.repository.getFinancialPipeline(filters, user),
        this.repository.getDataFreshness(),
      ]);

      const result: ReportSummary = {
        utilization,
        sla,
        cost,
        pipeline,
        generatedAt: new Date(),
        dataFreshness,
      };

      await this.logAudit(userId, 'GET_SUMMARY', query, Date.now() - startTime);
      return {
        data: {
          utilization: result.utilization,
          sla: result.sla,
          cost: result.cost,
          pipeline: result.pipeline,
          generatedAt: result.generatedAt,
          dataFreshness: result.dataFreshness,
        },
        error: undefined,
      };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in getSummary',
        error instanceof Error ? error.stack : undefined,
        'ReportsService.getSummary',
      );
      return {
        data: undefined,
        error: { message: error?.message || validationMessage()[500]() },
      };
    }
  }

  async getDashboard(query: ReportQueryDto, userId: string): Promise<IUsecaseResponse<DashboardData>> {
    try {
      const startTime = Date.now();
      const user = await this.repository.getUserContext(userId);
      if (!user) throw new Error('User not found');

      const filters = this.buildFilters(query, user);

      const [utilization, sla, cost, pipeline, costPareto, usageHeatmap, dataFreshness] = await Promise.all([
        this.repository.getUtilizationMetrics(filters, user),
        this.repository.getSLAMetrics(filters, user),
        this.repository.getCostMetrics(filters, user),
        this.repository.getFinancialPipeline(filters, user),
        this.repository.getCostPareto(filters, user),
        this.repository.getUsageHeatmap(filters, user),
        this.repository.getDataFreshness(),
      ]);

      const result: DashboardData = {
        kpiCards: {
          vehicleUtilization: Math.round(utilization.vehicleUtilization.percentage * 10) / 10,
          slaCompliance: Math.round(((sla.slaL1.percentage + sla.slaL2.percentage) / 2) * 10) / 10,
          noShowRate: Math.round(sla.noShowRate.percentage * 10) / 10,
          carpoolRate: Math.round(utilization.carpoolRate.percentage * 10) / 10,
          seatFill: Math.round(utilization.seatFillRate.percentage * 10) / 10,
          costPerKm: Math.round(cost.costPerKm.amount / 1000) * 1000, // Round to nearest 1000
        },
        financialFunnel: pipeline,
        costPareto,
        usageHeatmap,
        generatedAt: new Date(),
        dataFreshness,
      };

      await this.logAudit(userId, 'GET_DASHBOARD', query, Date.now() - startTime);
      return {
        data: result,
        error: undefined,
      };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in getDashboard',
        error instanceof Error ? error.stack : undefined,
        'ReportsService.getDashboard',
      );
      return {
        data: undefined,
        error: {
          message: error.message,
          code: error.status,
        },
      };
    }
  }

  async getCharts(query: ReportQueryDto, userId: string): Promise<IUsecaseResponse<ChartData>> {
    try {
      const startTime = Date.now();
      const user = await this.repository.getUserContext(userId);
      if (!user) throw new Error('User not found');

      const filters = this.buildFilters(query, user);

      const [monthlyTrends, costPareto, utilizationHeatmap, usageHeatmap] = await Promise.all([
        this.repository.getMonthlyTrends(filters, user),
        this.repository.getCostPareto(filters, user),
        this.repository.getUtilizationHeatmap(filters, user),
        this.repository.getUsageHeatmap(filters, user),
      ]);

      const result: ChartData = {
        monthlyTrends,
        costPareto,
        utilizationHeatmap,
        usageHeatmap,
      };

      await this.logAudit(userId, 'GET_CHARTS', query, Date.now() - startTime);
      return {
        data: result,
        error: undefined,
      };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in getCharts',
        error instanceof Error ? error.stack : undefined,
        'ReportsService.getCharts',
      );
      return {
        data: undefined,
        error: { message: error?.message || validationMessage()[500]() },
      };
    }
  }

  async getRecap(query: RecapQueryDto, userId: string): Promise<IUsecaseResponse<RecapData>> {
    try {
      const startTime = Date.now();
      const user = await this.repository.getUserContext(userId);
      if (!user) throw new Error('User not found');

      const filters = this.buildFilters(query, user);
      const pagination = {
        page: query.page || 1,
        limit: Math.min(query.limit || 50, 1000), // Max 1000 records
        sortBy: query.sortBy || 'start_at',
        sortOrder: query.sortOrder || 'desc',
        search: query.search,
        drillDownLevel: query.drillDownLevel,
      };

      const result = await this.repository.getRecapData(filters, user, pagination);

      await this.logAudit(userId, 'GET_RECAP', { ...query, pagination }, Date.now() - startTime);
      return {
        data: {
          data: result.data,
          pagination: result.pagination,
        },
        error: undefined,
      };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in getRecap',
        error instanceof Error ? error.stack : undefined,
        'ReportsService.getRecap',
      );

      return {
        data: undefined,
        error: { message: error?.message || validationMessage()[500]() },
      };
    }
  }

  async exportReport(body: ExportReportDto, userId: string): Promise<IUsecaseResponse<Buffer>> {
    try {
      const startTime = Date.now();
      const user = await this.repository.getUserContext(userId);
      if (!user) throw new Error('User not found');

      const filters = this.buildFilters(body, user);

      // Get data for export
      const [summaryResponse, chartsResponse, recapResponse] = await Promise.all([
        this.getSummary(body, userId),
        this.getCharts(body, userId),
        this.getRecap({ ...body, limit: 10000 }, userId), // Export max 10k records
      ]);

      if (summaryResponse.error || chartsResponse.error || recapResponse.error) {
        throw new Error('Failed to fetch data for export');
      }

      let buffer: Buffer;
      if (body.format === 'xls') {
        buffer = await this.generateExcel(
          summaryResponse.data!,
          chartsResponse.data!,
          recapResponse.data!,
          user,
          filters,
        );
      } else {
        buffer = await this.generatePDF(
          summaryResponse.data!,
          chartsResponse.data!,
          recapResponse.data!,
          user,
          filters,
        );
      }

      await this.logAudit(userId, 'EXPORT_REPORT', body, Date.now() - startTime);
      return {
        data: buffer,
        error: undefined,
      };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in exportReport',
        error instanceof Error ? error.stack : undefined,
        'ReportsService.exportReport',
      );
      return {
        data: undefined,
        error: { message: error?.message || validationMessage()[500]() },
      };
    }
  }

  private buildFilters(query: ReportQueryDto, user: UserContext): ReportFilters {
    const now = new Date();
    const defaultStart = startOfMonth(subMonths(now, 12));
    const defaultEnd = endOfMonth(now);

    return {
      startDate: query.startDate ? new Date(query.startDate) : defaultStart,
      endDate: query.endDate ? new Date(query.endDate) : defaultEnd,
      plants: query.plants?.length ? query.plants : user.plant ? [user.plant] : undefined,
      orgUnitCodes: query.orgUnitCodes?.length ? query.orgUnitCodes : user.orgUnitCode ? [user.orgUnitCode] : undefined,
      tripModes: query.tripModes,
      categories: query.categories,
      timezone: query.timezone || 'Asia/Jakarta',
    };
  }

  private async logAudit(userId: string, action: string, filters: any, renderTime: number): Promise<void> {
    const event: AuditEvent = {
      userId,
      action,
      filters,
      datasetVersion: '1.0',
      renderTime,
      timestamp: new Date(),
    };

    await this.repository.logAuditEvent(event);
  }

  private async generateExcel(
    summary: ReportSummary,
    charts: ChartData,
    recap: RecapData,
    user: UserContext,
    filters?: ReportFilters,
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const timestamp = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

    // Summary Sheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.addRow(['Car Ordering System - Dashboard Report']);
    summarySheet.addRow([`Generated: ${timestamp}`]);
    summarySheet.addRow([
      `User: ${user.employeeId} | Plant: ${user.plant || 'N/A'} | Org: ${user.orgUnitCode || 'N/A'}`,
    ]);
    if (filters) {
      summarySheet.addRow([
        `Date Range: ${filters.startDate.toLocaleDateString('id-ID')} - ${filters.endDate.toLocaleDateString('id-ID')}`,
      ]);
    }
    summarySheet.addRow([]);

    // KPI Section
    summarySheet.addRow(['Key Performance Indicators']);
    summarySheet.addRow(['Vehicle Utilization (%)', summary.utilization.vehicleUtilization.percentage.toFixed(1)]);
    summarySheet.addRow(['Seat Fill Rate (%)', summary.utilization.seatFillRate.percentage.toFixed(1)]);
    summarySheet.addRow(['Carpool Rate (%)', summary.utilization.carpoolRate.percentage.toFixed(1)]);
    summarySheet.addRow(['SLA L1 (%)', summary.sla.slaL1.percentage.toFixed(1)]);
    summarySheet.addRow(['SLA L2 (%)', summary.sla.slaL2.percentage.toFixed(1)]);
    summarySheet.addRow(['No-Show Rate (%)', summary.sla.noShowRate.percentage.toFixed(1)]);
    summarySheet.addRow(['Cost per KM (IDR)', Math.round(summary.cost.costPerKm.amount / 1000) * 1000]);

    // Financial Pipeline
    summarySheet.addRow([]);
    summarySheet.addRow(['Financial Pipeline']);
    summarySheet.addRow(['Stage', 'Count', 'Total Amount (IDR)', 'Avg Aging (Days)']);
    summarySheet.addRow([
      'Submitted',
      summary.pipeline.submitted.count,
      Math.round(summary.pipeline.submitted.totalAmount / 1000) * 1000,
      summary.pipeline.submitted.avgAgingDays.toFixed(1),
    ]);
    summarySheet.addRow([
      'Posted',
      summary.pipeline.posted.count,
      Math.round(summary.pipeline.posted.totalAmount / 1000) * 1000,
      summary.pipeline.posted.avgAgingDays.toFixed(1),
    ]);
    summarySheet.addRow([
      'Paid',
      summary.pipeline.paid.count,
      Math.round(summary.pipeline.paid.totalAmount / 1000) * 1000,
      summary.pipeline.paid.avgAgingDays.toFixed(1),
    ]);

    // Recap Sheet
    const recapSheet = workbook.addWorksheet('Detail Data');
    recapSheet.addRow([
      'Booking ID',
      'Doc Number (SAP)',
      'Category',
      'Plant',
      'Org Unit',
      'Trip Mode',
      'Driver Name',
      'Driver Type',
      'License Plate',
      'Start Date',
      'End Date',
      'Distance (KM)',
      'Cost (IDR)',
      'Status',
      'Aging (Days)',
    ]);

    recap.data.forEach((row) => {
      recapSheet.addRow([
        row.bookingId,
        row.docNumber || '',
        row.category,
        row.plant,
        row.orgUnit,
        row.tripMode,
        this.maskPII(row.driverName, user.roles) || '',
        row.driverType || '',
        row.licensePlate || '',
        row.startDate.toLocaleDateString('id-ID'),
        row.endDate.toLocaleDateString('id-ID'),
        row.distance.toFixed(1),
        Math.round(row.cost / 1000) * 1000,
        row.status,
        row.agingDays.toFixed(0),
      ]);
    });

    // Add watermark text in footer
    summarySheet.headerFooter.oddFooter = `&C&8CONFIDENTIAL - Car Ordering System\nGenerated: ${timestamp}`;
    recapSheet.headerFooter.oddFooter = `&C&8CONFIDENTIAL - Car Ordering System\nGenerated: ${timestamp}`;

    // Formatting
    summarySheet.getCell('A1').font = { bold: true, size: 14 };
    recapSheet.getRow(1).font = { bold: true };
    recapSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
  }

  private async generatePDF(
    summary: ReportSummary,
    charts: ChartData,
    recap: RecapData,
    user: UserContext,
    filters?: ReportFilters,
  ): Promise<Buffer> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));

    const timestamp = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

    // Header with watermark
    doc.fontSize(20).text('Car Ordering System - Dashboard Report', 50, 50);
    doc.fontSize(10).text(`Generated: ${timestamp}`, 50, 80);
    doc.text(`User: ${user.employeeId} | Plant: ${user.plant || 'N/A'} | Org: ${user.orgUnitCode || 'N/A'}`, 50, 95);
    if (filters) {
      doc.text(
        `Date Range: ${filters.startDate.toLocaleDateString('id-ID')} - ${filters.endDate.toLocaleDateString('id-ID')}`,
        50,
        110,
      );
    }

    // Watermark
    doc.fontSize(8).fillColor('gray').text('CONFIDENTIAL - Car Ordering System', 400, 750);

    // KPI Summary
    let yPos = 150;
    doc.fontSize(14).fillColor('black').text('Key Performance Indicators', 50, yPos);
    yPos += 30;
    doc.fontSize(10);
    doc.text(`Vehicle Utilization: ${summary.utilization.vehicleUtilization.percentage.toFixed(1)}%`, 50, yPos);
    yPos += 20;
    doc.text(`Seat Fill Rate: ${summary.utilization.seatFillRate.percentage.toFixed(1)}%`, 50, yPos);
    yPos += 20;
    doc.text(`Carpool Rate: ${summary.utilization.carpoolRate.percentage.toFixed(1)}%`, 50, yPos);
    yPos += 20;
    doc.text(`SLA L1: ${summary.sla.slaL1.percentage.toFixed(1)}%`, 50, yPos);
    yPos += 20;
    doc.text(`SLA L2: ${summary.sla.slaL2.percentage.toFixed(1)}%`, 50, yPos);
    yPos += 20;
    doc.text(`No-Show Rate: ${summary.sla.noShowRate.percentage.toFixed(1)}%`, 50, yPos);
    yPos += 20;
    doc.text(`Cost per KM: IDR ${Math.round(summary.cost.costPerKm.amount / 1000) * 1000}`, 50, yPos);

    // Financial Pipeline
    yPos += 40;
    doc.fontSize(14).text('Financial Pipeline', 50, yPos);
    yPos += 30;
    doc.fontSize(10);
    doc.text(
      `Submitted: ${summary.pipeline.submitted.count} docs, IDR ${Math.round(summary.pipeline.submitted.totalAmount / 1000) * 1000}`,
      50,
      yPos,
    );
    yPos += 20;
    doc.text(
      `Posted: ${summary.pipeline.posted.count} docs, IDR ${Math.round(summary.pipeline.posted.totalAmount / 1000) * 1000}`,
      50,
      yPos,
    );
    yPos += 20;
    doc.text(
      `Paid: ${summary.pipeline.paid.count} docs, IDR ${Math.round(summary.pipeline.paid.totalAmount / 1000) * 1000}`,
      50,
      yPos,
    );

    // Footer with watermark and timestamp
    doc.fontSize(8).fillColor('gray').text(`CONFIDENTIAL - Car Ordering System | Generated: ${timestamp}`, 50, 750);

    doc.end();

    return new Promise((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  private maskPII(value: string | undefined, userRoles: string[]): string | undefined {
    if (!value) return undefined;
    // Check if user has permission to see PII (FINANCE, MANAGEMENT, ADMIN, AUDITOR)
    const hasPermission = userRoles.some((role) =>
      ['FINANCE', 'MANAGEMENT', 'ADMIN', 'AUDITOR'].includes(role.toUpperCase()),
    );
    if (hasPermission) return value;
    // Mask PII: show first 2 chars and last 2 chars, mask the rest
    if (value.length <= 4) return '****';
    return value.substring(0, 2) + '***' + value.substring(value.length - 2);
  }
}
