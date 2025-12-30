import { Asset } from '@prisma/client';

/**
 * Asset Entity
 * Represents a file asset stored in S3
 */
export interface IAsset extends Asset {}

/**
 * Asset with Presigned URL
 * Used when returning assets to client with presigned URLs for private bucket access
 */
export interface IAssetWithPresignedUrl extends Omit<IAsset, 'url'> {
  url: string; // Presigned URL instead of S3 key
}
