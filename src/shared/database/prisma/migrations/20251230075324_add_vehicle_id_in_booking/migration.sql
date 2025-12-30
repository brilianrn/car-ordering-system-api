-- AlterTable
ALTER TABLE "booking" ADD COLUMN     "vehicle_id" INTEGER;

-- AddForeignKey
ALTER TABLE "booking" ADD CONSTRAINT "booking_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
