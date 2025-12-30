import { S3Service } from '@/shared/utils';
import { globalLogger as Logger } from '@/shared/utils/logger';
import {
  IBookingWithRelations,
  IBookingWithPresignedUrls,
  IVehicleImage,
  IVehicleImageWithPresignedUrl,
  IVehicleWithImages,
  IVehicleWithPresignedUrls,
} from '../entities';
import { IAssignmentWithVehicle } from '../entities/booking.entity';
import { Vehicle, Assignment } from '@prisma/client';

/**
 * Transform vehicle image to include presigned URL
 */
async function transformVehicleImage(
  image: IVehicleImage,
  s3Service: S3Service,
): Promise<IVehicleImageWithPresignedUrl> {
  try {
    if (image.asset?.url) {
      const presignedUrl = await s3Service.getPresignedUrl(image.asset.url, 86400); // 1 day expiry
      return {
        ...image,
        asset: {
          ...image.asset,
          url: presignedUrl,
        },
      };
    }
    return image as IVehicleImageWithPresignedUrl;
  } catch (error) {
    Logger.error(
      error instanceof Error ? error.message : 'Error generating presigned URL for vehicle image',
      error instanceof Error ? error.stack : undefined,
      'PresignedUrlHelper.transformVehicleImage',
    );
    // Return original image if presigning fails
    return image as IVehicleImageWithPresignedUrl;
  }
}

/**
 * Transform vehicle images array to include presigned URLs
 */
async function transformVehicleImages(
  images: IVehicleImage[],
  s3Service: S3Service,
): Promise<IVehicleImageWithPresignedUrl[]> {
  return Promise.all(images.map((img) => transformVehicleImage(img, s3Service)));
}

/**
 * Transform vehicle with images to include presigned URLs
 */
export async function transformVehicleWithPresignedUrls(
  vehicle: IVehicleWithImages | null | undefined,
  s3Service: S3Service,
): Promise<IVehicleWithPresignedUrls | null | undefined> {
  if (!vehicle || !vehicle.images) {
    return vehicle as IVehicleWithPresignedUrls | null | undefined;
  }

  const imagesWithUrls = await transformVehicleImages(vehicle.images, s3Service);

  return {
    ...vehicle,
    images: imagesWithUrls,
  };
}

/**
 * Transform assignment vehicle with presigned URLs
 */
export async function transformAssignmentVehicleWithPresignedUrls(
  assignment: IAssignmentWithVehicle | null | undefined,
  s3Service: S3Service,
): Promise<
  | (Omit<IAssignmentWithVehicle, 'vehicleChosen'> & {
      vehicleChosen?:
        | (Vehicle & {
            images: IVehicleImageWithPresignedUrl[];
          })
        | null;
    })
  | null
  | undefined
> {
  if (!assignment || !assignment.vehicleChosen || !assignment.vehicleChosen.images) {
    return assignment as
      | (Omit<IAssignmentWithVehicle, 'vehicleChosen'> & {
          vehicleChosen?:
            | (Vehicle & {
                images: IVehicleImageWithPresignedUrl[];
              })
            | null;
        })
      | null
      | undefined;
  }

  const imagesWithUrls = await transformVehicleImages(assignment.vehicleChosen.images, s3Service);

  return {
    ...assignment,
    vehicleChosen: {
      ...assignment.vehicleChosen,
      images: imagesWithUrls,
    },
  };
}

/**
 * Transform booking with relations to include presigned URLs
 */
export async function transformBookingWithPresignedUrls(
  booking: IBookingWithRelations | null,
  s3Service: S3Service,
): Promise<IBookingWithPresignedUrls | null> {
  if (!booking) {
    return null;
  }

  const vehicleWithUrls = await transformVehicleWithPresignedUrls(booking.vehicle, s3Service);
  const assignmentWithUrls = await transformAssignmentVehicleWithPresignedUrls(booking.assignment, s3Service);

  return {
    ...booking,
    vehicle: vehicleWithUrls,
    assignment: assignmentWithUrls,
  };
}
