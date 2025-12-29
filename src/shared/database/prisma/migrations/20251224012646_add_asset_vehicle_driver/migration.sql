-- AlterTable
ALTER TABLE "driver" ADD COLUMN     "ktp_asset_id" INTEGER,
ADD COLUMN     "sim_asset_id" INTEGER;

-- CreateTable
CREATE TABLE "vehicle_image" (
    "id" SERIAL NOT NULL,
    "vehicle_id" INTEGER NOT NULL,
    "asset_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,

    CONSTRAINT "vehicle_image_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "driver" ADD CONSTRAINT "driver_ktp_asset_id_fkey" FOREIGN KEY ("ktp_asset_id") REFERENCES "asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver" ADD CONSTRAINT "driver_sim_asset_id_fkey" FOREIGN KEY ("sim_asset_id") REFERENCES "asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_image" ADD CONSTRAINT "vehicle_image_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_image" ADD CONSTRAINT "vehicle_image_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
