/*
  Warnings:

  - You are about to drop the column `org_unit_code` on the `employee` table. All the data in the column will be lost.
  - Added the required column `org_unit_id` to the `employee` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "employee" DROP COLUMN "org_unit_code",
ADD COLUMN     "org_unit_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "vehicle" ADD COLUMN     "dedicated_org_id" INTEGER;

-- CreateTable
CREATE TABLE "organization_unit" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "parent_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,

    CONSTRAINT "organization_unit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_unit_code_key" ON "organization_unit"("code");

-- AddForeignKey
ALTER TABLE "organization_unit" ADD CONSTRAINT "organization_unit_parent_code_fkey" FOREIGN KEY ("parent_code") REFERENCES "organization_unit"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee" ADD CONSTRAINT "employee_org_unit_id_fkey" FOREIGN KEY ("org_unit_id") REFERENCES "organization_unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle" ADD CONSTRAINT "vehicle_dedicated_org_id_fkey" FOREIGN KEY ("dedicated_org_id") REFERENCES "organization_unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
