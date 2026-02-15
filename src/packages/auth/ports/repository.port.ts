import { Account, Driver, Employee, Role } from '@prisma/client';

export interface AuthRepositoryPort {
  findEmployeeByEmail(email: string): Promise<(Employee & { orgUnit: any }) | null>;

  findEmployeeByNik(
    nik: string,
  ): Promise<(Employee & { orgUnit: any; account: Account | null; driverProfile: Driver | null }) | null>;

  findAccountByEmail(email: string): Promise<
    | (Account & {
        employee: Employee & { orgUnit: any };
      })
    | null
  >;

  createAccount(data: {
    email: string;
    password: string;
    employeeId: string;
    isVerified?: boolean;
    verificationToken?: string;
  }): Promise<Account>;

  createPlaceholderEmployee(data: { employeeId: string; email: string; fullName: string }): Promise<Employee>;

  findAccountByToken(token: string): Promise<Account | null>;

  updateAccountVerification(id: number): Promise<Account>;

  searchUsers(params: {
    query?: string;
    employeeId?: string;
    email?: string;
    fullName?: string;
    roles?: string[];
    limit?: number;
  }): Promise<
    Array<{
      employeeId: string;
      fullName: string;
      email: string;
      orgUnit: {
        id: number;
        code: string;
        name: string;
      } | null;
    }>
  >;

  createSsoAccount(data: { email: string; employeeId: string }): Promise<Account>;

  findOrgUnitByName(name: string): Promise<{ id: number; code: string } | null>;

  upsertSSOUser(data: {
    employeeId: string;
    fullName: string;
    email: string;
    passwordHash: string;
    department?: string;
    division?: string;
    userType?: 'Internal' | 'External';
    roleName?: string;
    position?: string;
    phoneNumber?: string;
    photoUrl?: string;
    vendorName?: string;
  }): Promise<Employee & { account: Account | null; driverProfile: Driver | null; effectiveRoles: Role[] }>;

  createEmployee(data: { employeeId: string; fullName: string; email: string; orgUnitId: number }): Promise<Employee>;
  /**
   * Validate SSO token with external provider
   */
  validateSSOToken(token: string): Promise<any>;
}
