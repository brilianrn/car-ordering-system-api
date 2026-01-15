import { QueryAnalyticsDto } from '../dto/query-analytics.dto';
import { Response } from 'express';

export interface AnalyticsControllerPort {
  getDashboard(query: QueryAnalyticsDto, userId: string, res: Response): Promise<any>;
  exportDashboard(query: QueryAnalyticsDto, userId: string, format: string, res: Response): Promise<any>;
}
