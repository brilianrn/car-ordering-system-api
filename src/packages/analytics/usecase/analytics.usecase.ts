import { Inject, Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import Redis from 'ioredis';
import { QueryAnalyticsDto } from '../dto/query-analytics.dto';
import { AnalyticsRepositoryPort } from '../ports/repository.port';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');

@Injectable()
export class AnalyticsUseCase {
  private redis: Redis;

  constructor(
    @Inject('AnalyticsRepositoryPort')
    private readonly repository: AnalyticsRepositoryPort,
  ) {
    // Initialize Redis (assuming localhost or env vars, fallback to default)
    // In a real app, inject ConfigService
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      lazyConnect: true, // Don't crash if redis is missing
    });
  }

  private generateCacheKey(userId: string, filters: QueryAnalyticsDto): string {
    const filterHash = JSON.stringify(filters || {});
    return `analytics:${userId}:${Buffer.from(filterHash).toString('base64')}`;
  }

  async getDashboard(filters: QueryAnalyticsDto, userId: string): Promise<any> {
    const cacheKey = this.generateCacheKey(userId, filters);

    // 1. Check Cache
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {
      // Redis error, ignore
    }

    // 2. Get User Context
    const user = await this.repository.getUserContext(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // 3. Parallel Fetch
    const [utilization, sla, cost, pipeline] = await Promise.all([
      this.repository.getUtilization(filters, user),
      this.repository.getSLA(filters, user),
      this.repository.getCostPerKm(filters, user),
      this.repository.getPipeline(filters, user),
    ]);

    const result = {
      utilization,
      sla,
      cost,
      pipeline,
      generatedAt: new Date(),
    };

    // 4. Audit
    await this.repository.logAudit(userId, 'VIEW_DASHBOARD', filters);

    // 5. Set Cache (5 minutes)
    try {
      await this.redis.setex(cacheKey, 300, JSON.stringify(result));
    } catch (e) {
      // Ignore
    }

    return result;
  }

  async exportDashboard(filters: QueryAnalyticsDto, userId: string, format: 'pdf' | 'xls'): Promise<Buffer> {
    const data = await this.getDashboard(filters, userId);

    if (format === 'xls') {
      return this.generateXLS(data);
    } else {
      return this.generatePDF(data);
    }
  }

  private async generateXLS(data: any): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Dashboard');

    // Watermark (Excel doesn't support background watermark easily like PDF, so we add text)
    worksheet.getCell('A1').value = 'CONFIDENTIAL - SYSTEM GENERATED';
    worksheet.getCell('A2').value = `Generated At: ${new Date().toISOString()}`;

    // KPI Section
    worksheet.addRow(['KPI Overview']);
    worksheet.addRow(['Metric', 'Value']);
    worksheet.addRow(['Utilization', `${data.utilization.utilizationPercentage.toFixed(2)}%`]);
    worksheet.addRow(['SLA L1', `${data.sla.slaL1.toFixed(2)}%`]);
    worksheet.addRow(['SLA L2', `${data.sla.slaL2.toFixed(2)}%`]);
    worksheet.addRow(['Cost/Km', `IDR ${data.cost.costPerKm.toFixed(2)}`]);

    // Pipeline Section
    worksheet.addRow([]);
    worksheet.addRow(['Financial Pipeline']);
    worksheet.addRow(['Stage', 'Count']);
    worksheet.addRow(['Submitted', data.pipeline.funnel.submitted]);
    worksheet.addRow(['Posted', data.pipeline.funnel.posted]);
    worksheet.addRow(['Paid', data.pipeline.funnel.paid]);
    worksheet.addRow(['Avg Aging (Days)', data.pipeline.agingDays.toFixed(1)]);

    return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
  }

  private async generatePDF(data: any): Promise<Buffer> {
    return new Promise((resolve) => {
      const doc = new PDFDocument();
      const buffers: Buffer[] = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        resolve(Buffer.concat(buffers));
      });

      // Watermark
      doc.save();
      doc.fillColor('grey');
      doc.opacity(0.1);
      doc.fontSize(50);
      doc.text('CONFIDENTIAL', 100, 300, {
        align: 'center',
        angle: 45,
      });
      doc.restore();

      // Content
      doc.fontSize(20).text('Analytics Dashboard', { align: 'center' });
      doc.fontSize(10).text(`Generated: ${new Date().toISOString()}`, { align: 'right' });
      doc.moveDown();

      // KPIs
      doc.fontSize(14).text('KPI Overview');
      doc.fontSize(12).text(`Utilization: ${data.utilization.utilizationPercentage.toFixed(2)}%`);
      doc.text(`SLA L1: ${data.sla.slaL1.toFixed(2)}%`);
      doc.text(`SLA L2: ${data.sla.slaL2.toFixed(2)}%`);
      doc.text(`Cost per Km: IDR ${data.cost.costPerKm.toFixed(2)}`);
      doc.moveDown();

      // Pipeline
      doc.fontSize(14).text('Financial Pipeline');
      doc.fontSize(12).text(`Submitted: ${data.pipeline.funnel.submitted}`);
      doc.text(`Posted: ${data.pipeline.funnel.posted}`);
      doc.text(`Paid: ${data.pipeline.funnel.paid}`);
      doc.text(`Avg Aging: ${data.pipeline.agingDays.toFixed(1)} days`);

      doc.end();
    });
  }
}
