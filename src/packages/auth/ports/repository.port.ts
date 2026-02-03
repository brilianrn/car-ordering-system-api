import { Account, Employee } from '@prisma/client';

export interface AuthRepositoryPort {
  findEmployeeByEmail(email: string): Promise<(Employee & { orgUnit: any }) | null>;

  findEmployeeByNik(nik: string): Promise<(Employee & { orgUnit: any }) | null>;

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
}
