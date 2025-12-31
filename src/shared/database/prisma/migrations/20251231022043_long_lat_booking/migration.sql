-- AlterTable
ALTER TABLE "booking_segment" ADD COLUMN     "destination_lat_long" TEXT,
ADD COLUMN     "geocode_accuracy" DOUBLE PRECISION,
ADD COLUMN     "geocode_validated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "origin_lat_long" TEXT,
ADD COLUMN     "route_geohash" TEXT,
ADD COLUMN     "route_polyline" TEXT;

-- AlterTable
ALTER TABLE "carpool_group" ADD COLUMN     "detour_percentage" DOUBLE PRECISION,
ADD COLUMN     "post_merge_distance" DOUBLE PRECISION,
ADD COLUMN     "pre_merge_distance" DOUBLE PRECISION;
