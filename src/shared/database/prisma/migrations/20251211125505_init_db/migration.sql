-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'LEADER', 'GA', 'DRIVER', 'FINANCE', 'MANAGEMENT', 'ADMIN', 'AUDITOR');

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'IN_SERVICE');

-- CreateEnum
CREATE TYPE "TransmissionType" AS ENUM ('AUTOMATIC', 'MANUAL', 'ALL');

-- CreateEnum
CREATE TYPE "DriverType" AS ENUM ('INTERNAL', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('DROP', 'PICKUP', 'BOTH');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED_L1', 'ASSIGNED', 'CANCELLED', 'REJECTED', 'RETURNED', 'MERGED');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'RETURNED');

-- CreateEnum
CREATE TYPE "ResourceMode" AS ENUM ('INTERNAL', 'DAILY_RENT', 'PERSONAL');

-- CreateEnum
CREATE TYPE "FundingSource" AS ENUM ('DRIVER_CASH', 'MODE_B', 'VENDOR', 'OPERATIONAL');

-- CreateEnum
CREATE TYPE "VerifyStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'VERIFIED', 'BLOCKED');

-- CreateTable
CREATE TABLE "employee" (
    "id" SERIAL NOT NULL,
    "employee_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "org_unit_code" TEXT NOT NULL,
    "cost_center" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "approver_l1_id" TEXT,
    "effective_roles" "Role"[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,

    CONSTRAINT "employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "contact_pic" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,

    CONSTRAINT "vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle" (
    "id" SERIAL NOT NULL,
    "vehicle_code" TEXT NOT NULL,
    "license_plate" TEXT NOT NULL,
    "vendor_id" INTEGER,
    "brand_model" TEXT NOT NULL,
    "vehicle_type" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "transmission" "TransmissionType" NOT NULL,
    "seat_capacity" INTEGER NOT NULL,
    "fuel_consumption" DOUBLE PRECISION NOT NULL,
    "status" "VehicleStatus" NOT NULL DEFAULT 'ACTIVE',
    "plant_location" TEXT NOT NULL,
    "division_flag" TEXT,
    "is_dedicated" BOOLEAN NOT NULL DEFAULT false,
    "default_driver_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,

    CONSTRAINT "vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "driver" (
    "id" SERIAL NOT NULL,
    "driver_code" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "internal_nik" TEXT,
    "driver_type" "DriverType" NOT NULL DEFAULT 'INTERNAL',
    "vendor_id" INTEGER,
    "sim_number" TEXT NOT NULL,
    "sim_expiry" TIMESTAMP(3) NOT NULL,
    "phone_number" TEXT,
    "transmission_pref" "TransmissionType" NOT NULL DEFAULT 'ALL',
    "plant_location" TEXT NOT NULL,
    "realtime_status" TEXT NOT NULL DEFAULT 'Idle',
    "is_dedicated" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,

    CONSTRAINT "driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "display_order" INTEGER NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'Global',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,

    CONSTRAINT "category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "param_set" (
    "id" SERIAL NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "effective_from" TIMESTAMP(3) NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'UAT',
    "published_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,

    CONSTRAINT "param_set_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "param_item" (
    "id" SERIAL NOT NULL,
    "param_set_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "unit" TEXT,
    "scope" TEXT NOT NULL DEFAULT 'Global',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,

    CONSTRAINT "param_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking" (
    "id" SERIAL NOT NULL,
    "booking_number" TEXT NOT NULL,
    "requester_id" TEXT NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "service_type" "ServiceType" NOT NULL,
    "purpose" TEXT NOT NULL,
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3) NOT NULL,
    "passenger_count" INTEGER NOT NULL,
    "category_id" INTEGER NOT NULL,
    "resource_mode" "ResourceMode" NOT NULL,
    "booking_status" "BookingStatus" NOT NULL DEFAULT 'DRAFT',
    "cancel_reason" TEXT,
    "auto_cancel_at" TIMESTAMP(3),
    "carpool_group_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,

    CONSTRAINT "booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carpool_group" (
    "id" SERIAL NOT NULL,
    "host_booking_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "combined_route" JSONB,
    "shared_cost" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,

    CONSTRAINT "carpool_group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_header" (
    "id" SERIAL NOT NULL,
    "booking_id" INTEGER NOT NULL,
    "approver_l1_id" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL,
    "sla_due_at" TIMESTAMP(3) NOT NULL,
    "decision_l1" "ApprovalStatus",
    "decision_time_l1" TIMESTAMP(3),
    "comment_l1" TEXT,
    "ga_assignee_id" TEXT,
    "decision_l2" "ApprovalStatus",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,

    CONSTRAINT "approval_header_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignment" (
    "id" SERIAL NOT NULL,
    "booking_id" INTEGER NOT NULL,
    "resource_mode" "ResourceMode" NOT NULL,
    "vehicle_chosen_id" INTEGER,
    "driver_chosen_id" INTEGER,
    "vendor_chosen_id" INTEGER,
    "dispatch_note" TEXT,
    "assignment_snapshot" JSONB,
    "assigned_at_l2" TIMESTAMP(3),
    "sla_due_at_l2" TIMESTAMP(3),
    "approval_header_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,

    CONSTRAINT "assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_segment" (
    "id" SERIAL NOT NULL,
    "booking_id" INTEGER NOT NULL,
    "segment_no" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "est_km" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,

    CONSTRAINT "booking_segment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "travel_order" (
    "id" SERIAL NOT NULL,
    "sj_code" TEXT NOT NULL,
    "booking_id" INTEGER NOT NULL,
    "segment_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "vehicle_id" INTEGER NOT NULL,
    "driver_id" INTEGER NOT NULL,
    "stop_list" JSONB,
    "is_handover" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,

    CONSTRAINT "travel_order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "segment_execution" (
    "id" SERIAL NOT NULL,
    "segment_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NotStarted',
    "check_in_at" TIMESTAMP(3),
    "check_out_at" TIMESTAMP(3),
    "odo_start" DOUBLE PRECISION,
    "odo_end" DOUBLE PRECISION,
    "odo_distance" DOUBLE PRECISION,
    "gps_distance" DOUBLE PRECISION,
    "anomaly_flags" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,

    CONSTRAINT "segment_execution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_header" (
    "id" SERIAL NOT NULL,
    "segment_execution_id" INTEGER,
    "verify_status" "VerifyStatus" NOT NULL DEFAULT 'IN_REVIEW',
    "verifier_id" TEXT NOT NULL,
    "verified_at" TIMESTAMP(3),
    "result_snapshot" JSONB,
    "anomaly_handled" BOOLEAN NOT NULL DEFAULT false,
    "reimburse_ticket" TEXT,
    "replenish_ticket" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,

    CONSTRAINT "verification_header_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipt_item" (
    "id" SERIAL NOT NULL,
    "verify_id" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "amount_idr" INTEGER NOT NULL,
    "receipt_date" TIMESTAMP(3) NOT NULL,
    "photo_url" TEXT NOT NULL,
    "funding_source" "FundingSource" NOT NULL,
    "dup_hash" TEXT,
    "ocr_snapshot" JSONB,
    "ga_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,

    CONSTRAINT "receipt_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" SERIAL NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_nik" TEXT NOT NULL,
    "feature_code" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" INTEGER NOT NULL,
    "before_after" JSONB,
    "reason_code" TEXT,
    "notification_job_id" INTEGER,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employee_employee_id_key" ON "employee"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_email_key" ON "employee"("email");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_vehicle_code_key" ON "vehicle"("vehicle_code");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_license_plate_key" ON "vehicle"("license_plate");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_default_driver_id_key" ON "vehicle"("default_driver_id");

-- CreateIndex
CREATE UNIQUE INDEX "driver_driver_code_key" ON "driver"("driver_code");

-- CreateIndex
CREATE UNIQUE INDEX "driver_sim_number_key" ON "driver"("sim_number");

-- CreateIndex
CREATE UNIQUE INDEX "category_code_key" ON "category"("code");

-- CreateIndex
CREATE UNIQUE INDEX "category_name_key" ON "category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "param_set_version_key" ON "param_set"("version");

-- CreateIndex
CREATE UNIQUE INDEX "booking_booking_number_key" ON "booking"("booking_number");

-- CreateIndex
CREATE UNIQUE INDEX "carpool_group_host_booking_id_key" ON "carpool_group"("host_booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "approval_header_booking_id_key" ON "approval_header"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "assignment_booking_id_key" ON "assignment"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "assignment_approval_header_id_key" ON "assignment"("approval_header_id");

-- CreateIndex
CREATE UNIQUE INDEX "booking_segment_booking_id_segment_no_key" ON "booking_segment"("booking_id", "segment_no");

-- CreateIndex
CREATE UNIQUE INDEX "travel_order_sj_code_key" ON "travel_order"("sj_code");

-- CreateIndex
CREATE UNIQUE INDEX "travel_order_segment_id_key" ON "travel_order"("segment_id");

-- CreateIndex
CREATE UNIQUE INDEX "segment_execution_segment_id_key" ON "segment_execution"("segment_id");

-- CreateIndex
CREATE UNIQUE INDEX "verification_header_segment_execution_id_key" ON "verification_header"("segment_execution_id");

-- CreateIndex
CREATE UNIQUE INDEX "verification_header_reimburse_ticket_key" ON "verification_header"("reimburse_ticket");

-- CreateIndex
CREATE UNIQUE INDEX "verification_header_replenish_ticket_key" ON "verification_header"("replenish_ticket");

-- AddForeignKey
ALTER TABLE "employee" ADD CONSTRAINT "employee_approver_l1_id_fkey" FOREIGN KEY ("approver_l1_id") REFERENCES "employee"("employee_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle" ADD CONSTRAINT "vehicle_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle" ADD CONSTRAINT "vehicle_default_driver_id_fkey" FOREIGN KEY ("default_driver_id") REFERENCES "driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver" ADD CONSTRAINT "driver_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "param_item" ADD CONSTRAINT "param_item_param_set_id_fkey" FOREIGN KEY ("param_set_id") REFERENCES "param_set"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking" ADD CONSTRAINT "booking_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "employee"("employee_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking" ADD CONSTRAINT "booking_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking" ADD CONSTRAINT "booking_carpool_group_id_fkey" FOREIGN KEY ("carpool_group_id") REFERENCES "carpool_group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carpool_group" ADD CONSTRAINT "carpool_group_host_booking_id_fkey" FOREIGN KEY ("host_booking_id") REFERENCES "booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_header" ADD CONSTRAINT "approval_header_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_header" ADD CONSTRAINT "approval_header_approver_l1_id_fkey" FOREIGN KEY ("approver_l1_id") REFERENCES "employee"("employee_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment" ADD CONSTRAINT "assignment_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment" ADD CONSTRAINT "assignment_vehicle_chosen_id_fkey" FOREIGN KEY ("vehicle_chosen_id") REFERENCES "vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment" ADD CONSTRAINT "assignment_driver_chosen_id_fkey" FOREIGN KEY ("driver_chosen_id") REFERENCES "driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment" ADD CONSTRAINT "assignment_approval_header_id_fkey" FOREIGN KEY ("approval_header_id") REFERENCES "approval_header"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_segment" ADD CONSTRAINT "booking_segment_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travel_order" ADD CONSTRAINT "travel_order_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travel_order" ADD CONSTRAINT "travel_order_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travel_order" ADD CONSTRAINT "travel_order_segment_id_fkey" FOREIGN KEY ("segment_id") REFERENCES "booking_segment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "segment_execution" ADD CONSTRAINT "segment_execution_segment_id_fkey" FOREIGN KEY ("segment_id") REFERENCES "booking_segment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_header" ADD CONSTRAINT "verification_header_segment_execution_id_fkey" FOREIGN KEY ("segment_execution_id") REFERENCES "segment_execution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt_item" ADD CONSTRAINT "receipt_item_verify_id_fkey" FOREIGN KEY ("verify_id") REFERENCES "verification_header"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
