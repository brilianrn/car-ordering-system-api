export interface IOrgUnitResponse {
  id: number;
  code: string;
  name: string;
  type: string;
  parentCode: string | null;
  costCenter: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IOrgUnitTreeNode {
  id: number;
  code: string;
  name: string;
  type: string;
  parentCode: string | null;
  costCenter: string | null;
  children: IOrgUnitTreeNode[];
}

export interface IOrgUnitDetailResponse extends IOrgUnitResponse {
  parent?: {
    code: string;
    name: string;
    type: string;
  } | null;
}

export interface IOrgUnit {
  id: number;
  code: string;
  name: string;
  type: string;
  parentCode: string | null;
  parentName?: string;
  costCenter: string | null;
  description?: string;
}
