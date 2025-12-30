import { VehicleImage } from '@prisma/client';
import { IAsset, IAssetWithPresignedUrl } from './asset.entity';

/**
 * Vehicle Image Entity
 * Represents a vehicle image with asset relation
 */
export interface IVehicleImage extends VehicleImage {
  asset: IAsset;
}

/**
 * Vehicle Image with Presigned URL
 * Used when returning vehicle images to client with presigned URLs
 */
export interface IVehicleImageWithPresignedUrl extends Omit<IVehicleImage, 'asset'> {
  asset: IAssetWithPresignedUrl;
}
