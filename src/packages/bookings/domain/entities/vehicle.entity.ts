import { Vehicle } from '@prisma/client';
import { IVehicleImage, IVehicleImageWithPresignedUrl } from './vehicle-image.entity';

/**
 * Vehicle Entity with Images
 * Represents a vehicle with its images
 */
export interface IVehicleWithImages extends Vehicle {
  images: IVehicleImage[];
}

/**
 * Vehicle Entity with Presigned URLs
 * Used when returning vehicles to client with presigned URLs for images
 */
export interface IVehicleWithPresignedUrls extends Omit<IVehicleWithImages, 'images'> {
  images: IVehicleImageWithPresignedUrl[];
}
