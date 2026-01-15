export interface UserContext {
  userId: string;
  plant?: string;
  orgUnitId?: number;
  orgUnitCode?: string;
  roles: string[];
}

export interface AnalyticsFilters {
  startDate: Date;
  endDate: Date;
  plant?: string;
  orgUnitCode?: string;
  category?: string;
}
