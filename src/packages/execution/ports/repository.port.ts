import { Prisma } from '@prisma/client';

export interface ExecutionRepositoryPort {
  findSegmentById(segmentId: number): Promise<any | null>;

  findBookingById(id: number): Promise<any | null>;

  createSegmentExecution(data: Prisma.SegmentExecutionCreateInput): Promise<any>;

  findSegmentExecutionBySegmentId(segmentId: number): Promise<any | null>;

  updateSegmentExecution(segmentId: number, data: Prisma.SegmentExecutionUpdateInput): Promise<void>;

  createVerificationHeader(data: Prisma.VerificationHeaderCreateInput): Promise<any>;

  findVerificationHeaderByExecutionId(executionId: number): Promise<any | null>;

  updateVerificationHeader(executionId: number, data: Prisma.VerificationHeaderUpdateInput): Promise<void>;

  createReceiptItem(data: Prisma.ReceiptItemCreateInput): Promise<any>;

  findSegmentExecutionById(executionId: number): Promise<any | null>;
}
