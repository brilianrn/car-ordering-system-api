/*
  Warnings:

  - You are about to drop the column `effective_roles` on the `employee` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "RBACStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'RETIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "TempRoleStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "PolicyChangeAction" AS ENUM ('CREATE', 'UPDATE', 'PUBLISH', 'RETIRE', 'REVOKE');

-- AlterTable
ALTER TABLE "employee" DROP COLUMN "effective_roles",
ADD COLUMN     "effectiveRoles" "Role"[];

-- CreateTable
CREATE TABLE "permission" (
    "id" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,

    CONSTRAINT "permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rbac_role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "description" TEXT,
    "level" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,

    CONSTRAINT "rbac_role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permission" (
    "id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,

    CONSTRAINT "role_permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_matrix" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "RBACStatus" NOT NULL DEFAULT 'DRAFT',
    "permission_hash" TEXT NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,
    "editor_id" TEXT,
    "reviewer_id" TEXT,
    "reviewed_at" TIMESTAMP(3),

    CONSTRAINT "role_matrix_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_matrix_mapping" (
    "id" TEXT NOT NULL,
    "role_matrix_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "org_unit_code" TEXT,
    "org_unit_pattern" TEXT,
    "division" TEXT,
    "department" TEXT,
    "cost_center" TEXT,
    "position" TEXT,
    "position_pattern" TEXT,
    "job_family" TEXT,
    "job_family_pattern" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,

    CONSTRAINT "role_matrix_mapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sod_rule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "role_id" TEXT NOT NULL,
    "conflicting_role_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,

    CONSTRAINT "sod_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_role" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "assigned_by" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "reason" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deactivated_at" TIMESTAMP(3),
    "deactivated_by" TEXT,

    CONSTRAINT "user_role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "temp_role" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "temp_role_end" TIMESTAMP(3) NOT NULL,
    "assigned_by" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "TempRoleStatus" NOT NULL DEFAULT 'ACTIVE',
    "revoked_at" TIMESTAMP(3),
    "revoked_by" TEXT,
    "revoke_reason" TEXT,

    CONSTRAINT "temp_role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rls_filter" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "filter_type" TEXT NOT NULL,
    "filter_key" TEXT NOT NULL,
    "filter_value" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,

    CONSTRAINT "rls_filter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rbac_snapshot" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "snapshot_type" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "roles_before" JSONB,
    "roles_after" JSONB,
    "permissions_before" JSONB,
    "permissions_after" JSONB,
    "change_reason" TEXT,
    "changed_by" TEXT NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "policy_version" TEXT,
    "policy_change_action" "PolicyChangeAction",
    "retain_until" TIMESTAMP(3) NOT NULL,
    "roleMatrixId" TEXT,

    CONSTRAINT "rbac_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "permission_module_action_resource_key" ON "permission"("module", "action", "resource");

-- CreateIndex
CREATE UNIQUE INDEX "rbac_role_name_key" ON "rbac_role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "role_permission_role_id_permission_id_key" ON "role_permission"("role_id", "permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_matrix_version_key" ON "role_matrix"("version");

-- CreateIndex
CREATE UNIQUE INDEX "sod_rule_name_key" ON "sod_rule"("name");

-- CreateIndex
CREATE UNIQUE INDEX "sod_rule_role_id_conflicting_role_id_key" ON "sod_rule"("role_id", "conflicting_role_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_role_employee_id_role_id_key" ON "user_role"("employee_id", "role_id");

-- AddForeignKey
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "rbac_role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_matrix_mapping" ADD CONSTRAINT "role_matrix_mapping_role_matrix_id_fkey" FOREIGN KEY ("role_matrix_id") REFERENCES "role_matrix"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_matrix_mapping" ADD CONSTRAINT "role_matrix_mapping_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "rbac_role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sod_rule" ADD CONSTRAINT "sod_rule_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "rbac_role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sod_rule" ADD CONSTRAINT "sod_rule_conflicting_role_id_fkey" FOREIGN KEY ("conflicting_role_id") REFERENCES "rbac_role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee"("employee_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "rbac_role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "temp_role" ADD CONSTRAINT "temp_role_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee"("employee_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "temp_role" ADD CONSTRAINT "temp_role_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "rbac_role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rls_filter" ADD CONSTRAINT "rls_filter_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee"("employee_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rbac_snapshot" ADD CONSTRAINT "rbac_snapshot_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee"("employee_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rbac_snapshot" ADD CONSTRAINT "rbac_snapshot_roleMatrixId_fkey" FOREIGN KEY ("roleMatrixId") REFERENCES "role_matrix"("id") ON DELETE SET NULL ON UPDATE CASCADE;
