-- CreateEnum
CREATE TYPE "CostSetStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'RETIRED');

-- CreateEnum
CREATE TYPE "CostItemCategory" AS ENUM ('FUEL_PERTALITE', 'FUEL_SOLAR', 'TOLL_PER_KM', 'PARKING_HOURLY', 'PARKING_CAP', 'FALLBACK_KM_PER_L', 'MARKUP_PERCENT', 'ROUNDING');

-- CreateEnum
CREATE TYPE "CostItemUnit" AS ENUM ('IDR_PER_L', 'IDR_PER_KM', 'IDR_PER_HOUR', 'PERCENT', 'KM_PER_L', 'IDR');

-- CreateEnum
CREATE TYPE "CostSetScope" AS ENUM ('GLOBAL', 'PLANT', 'DIVISI');

-- CreateEnum
CREATE TYPE "CostSetEnvironment" AS ENUM ('UAT', 'PRODUCTION');

-- CreateTable
CREATE TABLE "cost_set" (
    "id" SERIAL NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "CostSetStatus" NOT NULL DEFAULT 'DRAFT',
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "environment" "CostSetEnvironment" NOT NULL DEFAULT 'UAT',
    "scope" "CostSetScope" NOT NULL DEFAULT 'GLOBAL',
    "created_by" TEXT NOT NULL,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,

    CONSTRAINT "cost_set_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_item" (
    "id" SERIAL NOT NULL,
    "cost_set_id" INTEGER NOT NULL,
    "category" "CostItemCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" "CostItemUnit" NOT NULL,
    "scope" "CostSetScope",
    "vehicle_type" TEXT,
    "rounding_step" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,

    CONSTRAINT "cost_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cost_set_version_key" ON "cost_set"("version");

-- AddForeignKey
ALTER TABLE "cost_item" ADD CONSTRAINT "cost_item_cost_set_id_fkey" FOREIGN KEY ("cost_set_id") REFERENCES "cost_set"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
