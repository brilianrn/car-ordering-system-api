import { IPaginationResponse } from '@/shared/utils/rest-api/types';
import { OrganizationUnit, Prisma } from '@prisma/client';
import { GetOrgUnitsDto } from '../dto';

export interface OrgUnitRepositoryPort {
  findMany(where?: Prisma.OrganizationUnitWhereInput): Promise<OrganizationUnit[]>;
  findAll(): Promise<OrganizationUnit[]>;
  findAllPaginated(
    query: GetOrgUnitsDto,
  ): Promise<IPaginationResponse<OrganizationUnit & { parent: OrganizationUnit | null }>>;
  findByCode(code: string): Promise<OrganizationUnit | null>;
  count(where?: Prisma.OrganizationUnitWhereInput): Promise<number>;
}
