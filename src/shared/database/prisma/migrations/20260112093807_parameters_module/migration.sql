/*
  Warnings:

  - The `scope` column on the `param_item` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `param_set` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `status` column on the `param_set` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `environment` column on the `param_set` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `name` on the `param_item` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `group` on the `param_item` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "ParamSetStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'RETIRED');

-- CreateEnum
CREATE TYPE "ParamGroup" AS ENUM ('NO_SHOW', 'PETTY_CASH', 'TRACKING', 'KATEGORI');

-- CreateEnum
CREATE TYPE "ParamName" AS ENUM ('GRACE_NO_SHOW', 'PETTY_CASH_INITIAL', 'TRACKING_INTERVAL', 'ACTIVE_CATEGORIES');

-- CreateEnum
CREATE TYPE "ParamScope" AS ENUM ('GLOBAL', 'PLANT', 'DIVISI');

-- CreateEnum
CREATE TYPE "ParamEnvironment" AS ENUM ('UAT', 'PRODUCTION');

-- DropForeignKey
ALTER TABLE "param_item" DROP CONSTRAINT "param_item_param_set_id_fkey";

-- AlterTable
ALTER TABLE "param_item" ALTER COLUMN "param_set_id" SET DATA TYPE TEXT,
DROP COLUMN "name",
ADD COLUMN     "name" "ParamName" NOT NULL,
DROP COLUMN "group",
ADD COLUMN     "group" "ParamGroup" NOT NULL,
DROP COLUMN "scope",
ADD COLUMN     "scope" "ParamScope" NOT NULL DEFAULT 'GLOBAL';

-- AlterTable
ALTER TABLE "param_set" DROP CONSTRAINT "param_set_pkey",
ADD COLUMN     "effective_to" TIMESTAMP(3),
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "published_at" TIMESTAMP(3),
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
DROP COLUMN "status",
ADD COLUMN     "status" "ParamSetStatus" NOT NULL DEFAULT 'DRAFT',
DROP COLUMN "environment",
ADD COLUMN     "environment" "ParamEnvironment" NOT NULL DEFAULT 'UAT',
ALTER COLUMN "published_by" DROP NOT NULL,
ADD CONSTRAINT "param_set_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "param_set_id_seq";

-- AddForeignKey
ALTER TABLE "param_item" ADD CONSTRAINT "param_item_param_set_id_fkey" FOREIGN KEY ("param_set_id") REFERENCES "param_set"("id") ON DELETE CASCADE ON UPDATE CASCADE;
