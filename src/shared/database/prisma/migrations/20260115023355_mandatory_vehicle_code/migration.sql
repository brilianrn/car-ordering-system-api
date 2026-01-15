/*
  Warnings:

  - Made the column `vehicle_code` on table `vehicle` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "vehicle" ALTER COLUMN "vehicle_code" SET NOT NULL;
