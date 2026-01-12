import { ParamEnvironment, ParamSetStatus, Prisma } from '@prisma/client';

export interface ParamSetRepositoryPort {
  create(data: Prisma.ParamSetCreateInput): Promise<any>;

  findById(id: string): Promise<any | null>;

  findByVersion(version: number): Promise<any | null>;

  findMany(params: {
    skip?: number;
    take?: number;
    where?: Prisma.ParamSetWhereInput;
    orderBy?: Prisma.ParamSetOrderByWithRelationInput | Prisma.ParamSetOrderByWithRelationInput[];
  }): Promise<any[]>;

  count(where?: Prisma.ParamSetWhereInput): Promise<number>;

  findActive(environment: ParamEnvironment, date?: Date): Promise<any | null>;

  findLatestPublished(environment: ParamEnvironment): Promise<any | null>;

  update(id: string, data: Prisma.ParamSetUpdateInput): Promise<any>;

  updateStatus(id: string, status: ParamSetStatus, publishedBy?: string, publishedAt?: Date): Promise<any>;

  retirePreviousVersions(currentVersion: number, environment: ParamEnvironment): Promise<void>;

  getNextVersion(): Promise<number>;
}
