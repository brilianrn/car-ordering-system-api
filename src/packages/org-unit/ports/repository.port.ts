import { OrganizationUnit, Prisma } from '@prisma/client';

export interface OrgUnitRepositoryPort {
  findMany(where?: Prisma.OrganizationUnitWhereInput): Promise<OrganizationUnit[]>;
  findAll(): Promise<OrganizationUnit[]>;
  findByCode(code: string): Promise<OrganizationUnit | null>;
  count(where?: Prisma.OrganizationUnitWhereInput): Promise<number>;
}
