-- CreateEnum
CREATE TYPE "CarpoolConsentStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "CarpoolActionType" AS ENUM ('MATCHED', 'INVITE', 'APPROVE', 'DECLINE', 'MERGE', 'UNMERGE', 'COST_RECALCULATED');

-- AlterTable
ALTER TABLE "carpool_group" ADD COLUMN     "cost_mode" TEXT;

-- CreateTable
CREATE TABLE "carpool_invite" (
    "id" SERIAL NOT NULL,
    "carpool_group_id" INTEGER NOT NULL,
    "joiner_booking_id" INTEGER NOT NULL,
    "host_booking_id" INTEGER NOT NULL,
    "consent_status" "CarpoolConsentStatus" NOT NULL DEFAULT 'PENDING',
    "invited_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,

    CONSTRAINT "carpool_invite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carpool_audit_log" (
    "id" SERIAL NOT NULL,
    "carpool_group_id" INTEGER,
    "host_booking_id" INTEGER,
    "joiner_booking_id" INTEGER,
    "action_type" "CarpoolActionType" NOT NULL,
    "user_id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "old_value" JSONB,
    "new_value" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "carpool_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "carpool_invite_joiner_booking_id_key" ON "carpool_invite"("joiner_booking_id");

-- AddForeignKey
ALTER TABLE "carpool_invite" ADD CONSTRAINT "carpool_invite_carpool_group_id_fkey" FOREIGN KEY ("carpool_group_id") REFERENCES "carpool_group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carpool_invite" ADD CONSTRAINT "carpool_invite_joiner_booking_id_fkey" FOREIGN KEY ("joiner_booking_id") REFERENCES "booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carpool_invite" ADD CONSTRAINT "carpool_invite_host_booking_id_fkey" FOREIGN KEY ("host_booking_id") REFERENCES "booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
