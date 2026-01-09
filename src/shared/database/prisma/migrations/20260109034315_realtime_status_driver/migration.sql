/*
  Warnings:

  - The `realtime_status` column on the `driver` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "RealtimeStatus" AS ENUM ('Idle', 'OnDuty', 'OnLeave', 'Inactive');

-- AlterTable
ALTER TABLE "driver" DROP COLUMN "realtime_status",
ADD COLUMN     "realtime_status" "RealtimeStatus" NOT NULL DEFAULT 'Idle';
