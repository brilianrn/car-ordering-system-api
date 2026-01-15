import { QueryAnalyticsDto } from '../dto/query-analytics.dto';
import { UserContext } from '../domain/types';

export interface AnalyticsRepositoryPort {
  getUserContext(userId: string): Promise<UserContext | null>;
  getUtilization(filters: QueryAnalyticsDto, user: UserContext): Promise<any>;
  getSLA(filters: QueryAnalyticsDto, user: UserContext): Promise<any>;
  getCostPerKm(filters: QueryAnalyticsDto, user: UserContext): Promise<any>;
  getPipeline(filters: QueryAnalyticsDto, user: UserContext): Promise<any>;
  logAudit(userId: string, action: string, filters: any): Promise<void>;
}
