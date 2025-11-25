import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { mediaService } from '../services/media.service';
import { ok, ApiError } from '../utils/apiResponse';
import { asyncHandler } from '../utils/asyncHandler';

// Định nghĩa type cho Multer file
interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
  location?: string;
  path?: string;
  filename?: string;
}

// Extend AuthRequest để có file type
interface MediaRequest extends Omit<AuthRequest, 'file'> {
  file?: MulterFile;
}

class AdminMediaController {
  /**
   * Upload ảnh quảng cáo lên Cloudinary
   * POST /api/v1/admin/upload/ad-image
   * Body: multipart/form-data với field 'image' (file)
   * Response: { success: true, data: { imageUrl: string } }
   */
  handleAdImageUpload = asyncHandler(async (req: MediaRequest, res: Response, next: NextFunction) => {
    // Kiểm tra authentication (đã được xử lý bởi middleware requireAuth)
    if (!req.user || !req.user._id) {
      throw new ApiError(401, 'Unauthorized');
    }

    // Lấy file từ multer (sẽ được thêm vào req.file)
    const file = req.file;
    if (!file) {
      throw new ApiError(400, 'Image file is required');
    }

    // Upload file lên Cloudinary
    const imageUrl = await mediaService.uploadImageToCloudinary(file, 'locket/ads');

    // Trả về URL ảnh
    return res.status(200).json(ok({ imageUrl }, 'Image uploaded successfully'));
  });
}

export const adminMediaController = new AdminMediaController();

