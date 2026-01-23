-- CreateEnum
CREATE TYPE "SyncRunType" AS ENUM ('FULL', 'DELTA', 'MANUAL');

-- CreateEnum
CREATE TYPE "SyncBatchStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAIL', 'ROLLBACK');

-- CreateEnum
CREATE TYPE "AuditEntityType" AS ENUM ('ORGANIZATION_UNIT', 'EMPLOYEE', 'APPROVER_MAPPING');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('INSERT', 'UPDATE', 'DEACTIVATE', 'REACTIVATE', 'ERROR');

-- CreateTable
CREATE TABLE "sync_batch" (
    "id" TEXT NOT NULL,
    "run_type" "SyncRunType" NOT NULL DEFAULT 'DELTA',
    "start_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "end_time" TIMESTAMP(3),
    "status" "SyncBatchStatus" NOT NULL DEFAULT 'PENDING',
    "total_records" INTEGER NOT NULL DEFAULT 0,
    "processed_records" INTEGER NOT NULL DEFAULT 0,
    "inserted_records" INTEGER NOT NULL DEFAULT 0,
    "updated_records" INTEGER NOT NULL DEFAULT 0,
    "deactivated_records" INTEGER NOT NULL DEFAULT 0,
    "error_records" INTEGER NOT NULL DEFAULT 0,
    "error_details" TEXT[],
    "created_by" TEXT NOT NULL,
    "updated_by" TEXT,
    "rollback_reason" TEXT,

    CONSTRAINT "sync_batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_sync" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "entity_type" "AuditEntityType" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "old_value" JSONB,
    "new_value" JSONB,
    "error_message" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,

    CONSTRAINT "audit_sync_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sync_batch_status_idx" ON "sync_batch"("status");

-- CreateIndex
CREATE INDEX "sync_batch_start_time_idx" ON "sync_batch"("start_time");

-- CreateIndex
CREATE INDEX "audit_sync_batch_id_idx" ON "audit_sync"("batch_id");

-- CreateIndex
CREATE INDEX "audit_sync_entity_type_idx" ON "audit_sync"("entity_type");

-- CreateIndex
CREATE INDEX "audit_sync_timestamp_idx" ON "audit_sync"("timestamp");

-- AddForeignKey
ALTER TABLE "audit_sync" ADD CONSTRAINT "audit_sync_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "sync_batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;