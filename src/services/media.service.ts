import { uploadToCloudinary } from '../utils/cloudinary';
import { ApiError } from '../utils/apiResponse';

/**
 * Service xử lý upload media (ảnh, video)
 */
class MediaService {
  /**
   * Upload ảnh lên Cloudinary
   * @param file - File buffer từ multer
   * @param folder - Thư mục lưu trữ trên Cloudinary (default: 'locket/ads')
   * @returns URL bảo mật (secure_url) của ảnh đã upload
   */
  async uploadImageToCloudinary(
    file: Express.Multer.File | { buffer: Buffer; mimetype: string; size: number },
    folder: string = 'locket/ads'
  ): Promise<string> {
    // Validate file
    if (!file) {
      throw new ApiError(400, 'File is required');
    }

    if (!file.buffer) {
      throw new ApiError(400, 'File buffer is required');
    }

    // Validate file type
    if (!file.mimetype.startsWith('image/')) {
      throw new ApiError(400, 'Only image files are allowed');
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new ApiError(400, 'File size must be less than 10MB');
    }

    try {
      // Upload lên Cloudinary
      const uploadResult = await uploadToCloudinary(file.buffer, folder, {
        quality: 'auto',
        fetch_format: 'auto',
        transformation: [
          {
            width: 1200,
            height: 630,
            crop: 'limit', // Giữ tỷ lệ, không cắt
          },
        ],
      });

      // Trả về secure_url
      return uploadResult.secure_url;
    } catch (error) {
      console.error('Cloudinary upload error:', error);
      throw new ApiError(500, 'Failed to upload image to cloud storage');
    }
  }
}

export const mediaService = new MediaService();

