-- AlterTable
ALTER TABLE "driver" ADD COLUMN     "photo_asset_id" INTEGER;

-- AddForeignKey
ALTER TABLE "driver" ADD CONSTRAINT "driver_photo_asset_id_fkey" FOREIGN KEY ("photo_asset_id") REFERENCES "asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
