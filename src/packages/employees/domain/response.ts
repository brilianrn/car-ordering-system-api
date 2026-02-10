export interface IEmployeeSearchResponse {
  employeeId: string;
  fullName: string;
  email: string | null;
  orgUnit: {
    id: number;
    code: string;
    name: string;
  };
}
