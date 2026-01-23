-- DropIndex
DROP INDEX "audit_sync_batch_id_idx";

-- DropIndex
DROP INDEX "audit_sync_entity_type_idx";

-- DropIndex
DROP INDEX "audit_sync_timestamp_idx";

-- DropIndex
DROP INDEX "sync_batch_start_time_idx";

-- DropIndex
DROP INDEX "sync_batch_status_idx";

-- AlterTable
ALTER TABLE "sync_batch" ALTER COLUMN "run_type" DROP DEFAULT;
