import {
  UserContext,
  ReportFilters,
  UtilizationMetrics,
  SLAMetrics,
  CostMetrics,
  FinancialPipeline,
  ChartData,
  RecapData,
  AuditEvent,
} from '../domain/types';

export interface ReportsRepositoryPort {
  // User Context
  getUserContext(userId: string): Promise<UserContext | null>;

  // KPI Calculations
  getUtilizationMetrics(filters: ReportFilters, user: UserContext): Promise<UtilizationMetrics>;
  getSLAMetrics(filters: ReportFilters, user: UserContext): Promise<SLAMetrics>;
  getCostMetrics(filters: ReportFilters, user: UserContext): Promise<CostMetrics>;
  getFinancialPipeline(filters: ReportFilters, user: UserContext): Promise<FinancialPipeline>;

  // Charts Data
  getMonthlyTrends(filters: ReportFilters, user: UserContext): Promise<ChartData['monthlyTrends']>;
  getCostPareto(filters: ReportFilters, user: UserContext): Promise<ChartData['costPareto']>;
  getUtilizationHeatmap(filters: ReportFilters, user: UserContext): Promise<ChartData['utilizationHeatmap']>;
  getUsageHeatmap(filters: ReportFilters, user: UserContext): Promise<ChartData['usageHeatmap']>;

  // Recap Data
  getRecapData(
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
  ): Promise<RecapData>;

  // Data Freshness
  getDataFreshness(): Promise<{ operationalData: Date; financialData: Date }>;

  // Audit
  logAuditEvent(event: AuditEvent): Promise<void>;

  // Cache Management
  getCachedData(key: string): Promise<any>;
  setCachedData(key: string, data: any, ttl: number): Promise<void>;
  invalidateCache(pattern: string): Promise<void>;
}
