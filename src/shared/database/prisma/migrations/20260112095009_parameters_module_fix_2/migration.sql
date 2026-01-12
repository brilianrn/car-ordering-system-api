-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ParamName" ADD VALUE 'TIME_WINDOW_MINUTES';
ALTER TYPE "ParamName" ADD VALUE 'ROUTE_SIMILARITY_THRESHOLD';
ALTER TYPE "ParamName" ADD VALUE 'MAX_DETOUR_PERCENTAGE';
ALTER TYPE "ParamName" ADD VALUE 'DEFAULT_INVITE_EXPIRY_MINUTES';
ALTER TYPE "ParamName" ADD VALUE 'MAX_VEHICLE_SEAT_CAPACITY';
