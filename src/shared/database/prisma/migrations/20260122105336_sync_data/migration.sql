-- AlterTable
ALTER TABLE "employee" ADD COLUMN     "immediate_manager" TEXT,
ADD COLUMN     "immediate_supervisor" TEXT,
ADD COLUMN     "job_family" TEXT,
ADD COLUMN     "position" TEXT,
ALTER COLUMN "email" DROP NOT NULL;
