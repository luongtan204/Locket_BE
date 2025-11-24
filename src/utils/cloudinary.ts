import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env';

// Cấu hình Cloudinary
cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

/**
 * Upload file lên Cloudinary từ buffer
 */
export async function uploadToCloudinary(
  buffer: Buffer,
  folder: string = 'locket/posts',
  options?: {
    width?: number;
    height?: number;
    crop?: string;
    quality?: string | number;
    format?: string;
    fetch_format?: string;
    [key: string]: any; // Cho phép các options khác của Cloudinary
  }
): Promise<{ url: string; public_id: string; secure_url: string }> {
  return new Promise((resolve, reject) => {
    const uploadOptions: any = {
      folder,
      resource_type: 'image',
      ...options,
    };

    const uploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          reject(error);
        } else if (result) {
          resolve({
            url: result.url,
            public_id: result.public_id,
            secure_url: result.secure_url,
          });
        } else {
          reject(new Error('Upload failed: No result returned'));
        }
      }
    );

    uploadStream.end(buffer);
  });
}

/**
 * Xóa file từ Cloudinary
 */
export async function deleteFromCloudinary(publicId: string): Promise<void> {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
    throw error;
  }
}

/**
 * Extract public_id từ Cloudinary URL
 * Format: https://res.cloudinary.com/{cloud_name}/image/upload/{version}/{public_id}.{format}
 * hoặc: https://res.cloudinary.com/{cloud_name}/image/upload/{public_id}.{format}
 */
export function extractPublicIdFromUrl(url: string): string | null {
  try {
    // Pattern để match Cloudinary URL
    const pattern = /\/image\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/;
    const match = url.match(pattern);
    
    if (match && match[1]) {
      // Remove extension nếu có
      return match[1].replace(/\.[^.]+$/, '');
    }
    
    return null;
  } catch (error) {
    console.error('Error extracting public_id from URL:', error);
    return null;
  }
}

export { cloudinary };

