import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { globalLogger as Logger } from './logger';

@Injectable()
export class S3Service {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly region: string;
  private readonly pathToFolder: string;

  constructor() {
    this.region = process.env.AWS_REGION || 'ap-southeast-3';
    this.bucketName = process.env.AWS_S3_BUCKET || '';
    this.pathToFolder = process.env.PATH_AWS || 'uploads';

    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
      useAccelerateEndpoint: false,
    });
  }

  async uploadBase64(base64: string, fileName: string, path?: string): Promise<string> {
    try {
      // Remove data URL prefix if present (e.g., "data:image/jpeg;base64,")
      const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      // Extract file type from base64 or file name
      const fileType = this.extractFileType(base64, fileName);
      const fileExtension = this.getFileExtension(fileName, fileType);

      // Generate unique file name with timestamp
      const timestamp = Date.now();
      const nameWithoutExt = fileName.split('.')[0];
      const uniqueFileName = `${nameWithoutExt}${timestamp}.${fileExtension}`;

      // Determine upload path
      const uploadPath = path ? `${this.pathToFolder}/${path}` : this.pathToFolder;
      const s3Key = `${uploadPath}/${uniqueFileName}`;

      // Upload to S3
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
        Body: buffer,
        ContentType: fileType,
      });

      await this.s3Client.send(command);

      // Return S3 key (not public URL since bucket is private)
      return s3Key;
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in uploadBase64',
        error instanceof Error ? error.stack : undefined,
        'S3Service.uploadBase64',
      );
      throw error;
    }
  }

  private extractFileType(base64: string, fileName: string): string {
    // Try to extract from base64 data URL
    const dataUrlMatch = base64.match(/^data:([^;]+);base64,/);
    if (dataUrlMatch) {
      return dataUrlMatch[1];
    }

    // Fallback to file extension
    return this.getContentType(fileName);
  }

  private getContentType(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const contentTypes: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      pdf: 'application/pdf',
    };
    return contentTypes[ext || ''] || 'application/octet-stream';
  }

  private getFileExtension(fileName: string, fileType: string): string {
    // Try to get extension from file type
    if (fileType.includes('/')) {
      const ext = fileType.split('/')[1];
      if (ext && ['jpeg', 'jpg', 'png', 'gif', 'webp', 'pdf'].includes(ext)) {
        return ext === 'jpeg' ? 'jpg' : ext;
      }
    }

    // Fallback to file name extension
    const ext = fileName.split('.').pop()?.toLowerCase();
    return ext || 'jpg';
  }

  /**
   * Generate a presigned URL for viewing/downloading a file from private S3 bucket
   * @param s3Key - The S3 key (path) of the file
   * @param expiresIn - Expiration time in seconds (default: 3600 = 1 hour)
   * @returns Presigned URL that can be used to access the file
   */
  async getPresignedUrl(s3Key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
      });

      const url = await getSignedUrl(this.s3Client, command, { expiresIn });
      return url;
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in getPresignedUrl',
        error instanceof Error ? error.stack : undefined,
        'S3Service.getPresignedUrl',
      );
      throw error;
    }
  }
}

// TODO: FOR ENV NEWUS
// import { ObjectCannedACL, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
// import { Injectable } from '@nestjs/common';
// import { globalLogger as Logger } from './logger';

// @Injectable()
// export class S3Service {
//   private readonly s3Client: S3Client;
//   private readonly bucketName: string;
//   private readonly region: string;
//   private readonly pathToFolder: string;

//   constructor() {
//     this.region = process.env.AWS_REGION || process.env.S3_REGION || 'ap-southeast-2';
//     this.bucketName = process.env.AWS_S3_BUCKET || process.env.S3_BUCKET_NAME || '';
//     this.pathToFolder = process.env.PATH_AWS || 'uploads';

//     this.s3Client = new S3Client({
//       region: this.region,
//       credentials: {
//         accessKeyId: process.env.AWS_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY || '',
//         secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || process.env.S3_SECRET_KEY || '',
//       },
//       useAccelerateEndpoint: true,
//     });
//   }

//   async uploadBase64(base64: string, fileName: string, path?: string): Promise<string> {
//     try {
//       // Remove data URL prefix if present (e.g., "data:image/jpeg;base64,")
//       const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
//       const buffer = Buffer.from(base64Data, 'base64');

//       // Extract file type from base64 or file name
//       const fileType = this.extractFileType(base64, fileName);
//       const fileExtension = this.getFileExtension(fileName, fileType);

//       // Generate unique file name with timestamp
//       const timestamp = Date.now();
//       const nameWithoutExt = fileName.split('.')[0];
//       const uniqueFileName = `${nameWithoutExt}${timestamp}.${fileExtension}`;

//       // Determine upload path
//       const uploadPath = path ? `${this.pathToFolder}/${path}` : this.pathToFolder;
//       const s3Key = `${uploadPath}/${uniqueFileName}`;

//       // Upload to S3
//       const command = new PutObjectCommand({
//         Bucket: this.bucketName,
//         Key: s3Key,
//         Body: buffer,
//         ACL: ObjectCannedACL.public_read_write,
//         ContentType: fileType,
//       });

//       await this.s3Client.send(command);

//       // Return public URL with path
//       const url = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${s3Key}`;
//       return url;
//     } catch (error) {
//       Logger.error(
//         error instanceof Error ? error.message : 'Error in uploadBase64',
//         error instanceof Error ? error.stack : undefined,
//         'S3Service.uploadBase64',
//       );
//       throw error;
//     }
//   }

//   private extractFileType(base64: string, fileName: string): string {
//     // Try to extract from base64 data URL
//     const dataUrlMatch = base64.match(/^data:([^;]+);base64,/);
//     if (dataUrlMatch) {
//       return dataUrlMatch[1];
//     }

//     // Fallback to file extension
//     return this.getContentType(fileName);
//   }

//   private getContentType(fileName: string): string {
//     const ext = fileName.split('.').pop()?.toLowerCase();
//     const contentTypes: Record<string, string> = {
//       jpg: 'image/jpeg',
//       jpeg: 'image/jpeg',
//       png: 'image/png',
//       gif: 'image/gif',
//       webp: 'image/webp',
//       pdf: 'application/pdf',
//     };
//     return contentTypes[ext || ''] || 'application/octet-stream';
//   }

//   private getFileExtension(fileName: string, fileType: string): string {
//     // Try to get extension from file type
//     if (fileType.includes('/')) {
//       const ext = fileType.split('/')[1];
//       if (ext && ['jpeg', 'jpg', 'png', 'gif', 'webp', 'pdf'].includes(ext)) {
//         return ext === 'jpeg' ? 'jpg' : ext;
//       }
//     }

//     // Fallback to file name extension
//     const ext = fileName.split('.').pop()?.toLowerCase();
//     return ext || 'jpg';
//   }
// }
