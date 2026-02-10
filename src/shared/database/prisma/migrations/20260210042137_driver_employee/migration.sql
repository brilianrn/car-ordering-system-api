/*
  Warnings:

  - A unique constraint covering the columns `[employee_id]` on the table `driver` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "driver" ADD COLUMN     "employee_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "driver_employee_id_key" ON "driver"("employee_id");

-- AddForeignKey
ALTER TABLE "driver" ADD CONSTRAINT "driver_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee"("employee_id") ON DELETE SET NULL ON UPDATE CASCADE;
