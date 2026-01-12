/*
  Warnings:

  - The `status` column on the `category` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `scope` column on the `category` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "CategoryStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "CategoryScope" AS ENUM ('GLOBAL', 'PLANT', 'DIVISI');

-- AlterTable
ALTER TABLE "category" DROP COLUMN "status",
ADD COLUMN     "status" "CategoryStatus" NOT NULL DEFAULT 'ACTIVE',
ALTER COLUMN "display_order" SET DEFAULT 0,
DROP COLUMN "scope",
ADD COLUMN     "scope" "CategoryScope" NOT NULL DEFAULT 'GLOBAL';
