export interface UserContext {
  userId: string;
  employeeId: string;
  plant?: string;
  orgUnitId?: number;
  orgUnitCode?: string;
  roles: string[];
  timezone: string;
}

export interface ReportFilters {
  startDate: Date;
  endDate: Date;
  plants?: string[];
  orgUnitCodes?: string[];
  tripModes?: string[];
  categories?: string[];
  timezone: string;
}

// KPI Interfaces
export interface UtilizationMetrics {
  vehicleUtilization: {
    percentage: number;
    totalVehicles: number;
    totalUsedHours: number;
    totalAvailableHours: number;
  };
  seatFillRate: {
    percentage: number;
    totalPassengers: number;
    totalCapacity: number;
  };
  carpoolRate: {
    percentage: number;
    carpoolTrips: number;
    totalTrips: number;
  };
}

export interface SLAMetrics {
  slaL1: {
    percentage: number;
    compliantCount: number;
    totalCount: number;
    avgProcessingHours: number;
  };
  slaL2: {
    percentage: number;
    compliantCount: number;
    totalCount: number;
    avgProcessingHours: number;
  };
  noShowRate: {
    percentage: number;
    noShowCount: number;
    totalSegments: number;
  };
}

export interface CostMetrics {
  costPerKm: {
    amount: number;
    totalCost: number;
    totalDistance: number;
    currency: string;
  };
  costByCategory: Array<{
    categoryName: string;
    totalCost: number;
    percentage: number;
    tripCount: number;
  }>;
}

export interface FinancialPipeline {
  submitted: {
    count: number;
    totalAmount: number;
    avgAgingDays: number;
  };
  posted: {
    count: number;
    totalAmount: number;
    avgAgingDays: number;
  };
  paid: {
    count: number;
    totalAmount: number;
    avgAgingDays: number;
  };
}

// Summary Response
export interface ReportSummary {
  utilization: UtilizationMetrics;
  sla: SLAMetrics;
  cost: CostMetrics;
  pipeline: FinancialPipeline;
  generatedAt: Date;
  dataFreshness: {
    operationalData: Date;
    financialData: Date;
  };
}

// Dashboard Response (combines Summary + Charts)
export interface DashboardData {
  kpiCards: {
    vehicleUtilization: number;
    slaCompliance: number;
    noShowRate: number;
    carpoolRate: number;
    seatFill: number;
    costPerKm: number;
  };
  financialFunnel: FinancialPipeline;
  costPareto: ChartData['costPareto'];
  usageHeatmap: ChartData['usageHeatmap'];
  generatedAt: Date;
  dataFreshness: {
    operationalData: Date;
    financialData: Date;
  };
}

// Charts Response
export interface ChartData {
  monthlyTrends: Array<{
    month: string;
    utilization: number;
    cost: number;
    tripCount: number;
  }>;
  costPareto: Array<{
    category: string;
    cost: number;
    percentage: number;
    cumulativePercentage: number;
  }>;
  utilizationHeatmap: Array<{
    plant: string;
    orgUnit: string;
    utilization: number;
    tripCount: number;
  }>;
  usageHeatmap: Array<{
    date: string;
    hour?: number;
    tripCount: number;
    utilization: number;
  }>;
}

// Recap Response
export interface RecapData {
  data: Array<{
    bookingId: string;
    bookingIdInternal: number;
    docNumber?: string;
    category: string;
    plant: string;
    orgUnit: string;
    tripMode: string;
    startDate: Date;
    endDate: Date;
    distance: number;
    cost: number;
    status: string;
    agingDays: number;
    driverName?: string;
    driverType?: string;
    licensePlate?: string;
    costByCategory?: Array<{
      category: string;
      amount: number;
    }>;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Audit Event
export interface AuditEvent {
  userId: string;
  action: string;
  filters: any;
  datasetVersion: string;
  renderTime: number;
  timestamp: Date;
}

// Cache Key Interface
export interface CacheMetadata {
  key: string;
  ttl: number;
  version: string;
  generatedAt: Date;
}
