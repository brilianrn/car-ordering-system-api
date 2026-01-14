-- AlterTable
ALTER TABLE "driver" ADD COLUMN     "dedicated_vehicle_id" INTEGER;

-- AddForeignKey
ALTER TABLE "driver" ADD CONSTRAINT "driver_dedicated_vehicle_id_fkey" FOREIGN KEY ("dedicated_vehicle_id") REFERENCES "vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
