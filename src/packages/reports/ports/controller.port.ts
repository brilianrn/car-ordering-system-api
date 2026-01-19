import { ResponseREST } from '@/shared/utils/rest-api/types';
import { Response } from 'express';
import { ChartData, DashboardData, RecapData, ReportSummary } from '../domain/types';
import { ExportReportDto, RecapQueryDto, ReportQueryDto } from '../dto/report-query.dto';

export interface ReportsControllerPort {
  getDashboard(query: ReportQueryDto, userId: string, res: Response): Promise<Response<ResponseREST<DashboardData>>>;
  getSummary(query: ReportQueryDto, userId: string, res: Response): Promise<Response<ResponseREST<ReportSummary>>>;
  getCharts(query: ReportQueryDto, userId: string, res: Response): Promise<Response<ResponseREST<ChartData>>>;
  getRecap(query: RecapQueryDto, userId: string, res: Response): Promise<Response<ResponseREST<RecapData>>>;
  exportReport(body: ExportReportDto, userId: string, res: Response): Promise<Response<ResponseREST<Buffer>>>;
}
