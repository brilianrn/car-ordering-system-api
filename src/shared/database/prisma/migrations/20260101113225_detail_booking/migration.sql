-- AlterTable
ALTER TABLE "booking" ADD COLUMN     "destination_note" TEXT,
ADD COLUMN     "distance" DOUBLE PRECISION,
ADD COLUMN     "origin_note" TEXT,
ADD COLUMN     "travel_time" INTEGER;
