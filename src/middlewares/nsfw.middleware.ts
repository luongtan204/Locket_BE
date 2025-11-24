import { Request, Response, NextFunction } from 'express';
import { checkImage, isModelLoaded } from '../services/moderation.service';
import { ApiError } from '../utils/apiResponse';

// Type cho multer file
interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

// Extend Request để có file type (override file property)
interface RequestWithFile extends Omit<Request, 'file'> {
  file?: MulterFile;
}

/**
 * Middleware kiểm tra ảnh NSFW
 * Middleware này nên được đặt SAU multer middleware để có thể truy cập req.file
 * 
 * @example
 * router.post('/', requireAuth, upload.single('image'), checkNSFW, postController.create);
 */
export async function checkNSFW(req: RequestWithFile, res: Response, next: NextFunction) {
  try {
    // Kiểm tra xem model đã được load chưa
    if (!isModelLoaded()) {
      console.warn('[NSFW Middleware] Model not loaded, skipping NSFW check');
      // Nếu model chưa load, có thể:
      // 1. Cho phép (fail-safe) - không an toàn nhưng server vẫn chạy
      // 2. Từ chối (fail-secure) - an toàn hơn
      // Ở đây tôi chọn fail-safe để server vẫn hoạt động khi model không load được
      return next();
    }

    // Kiểm tra xem có file không
    if (!req.file) {
      return next(new ApiError(400, 'No image file provided'));
    }

    // Kiểm tra xem file có phải là ảnh không
    if (!req.file.mimetype.startsWith('image/')) {
      return next(new ApiError(400, 'File must be an image'));
    }

    // Kiểm tra NSFW
    const isSafe = await checkImage(req.file.buffer);

    if (!isSafe) {
      return next(new ApiError(400, 'Hình ảnh chứa nội dung nhạy cảm'));
    }

    // Ảnh an toàn, tiếp tục
    next();
  } catch (error) {
    console.error('[NSFW Middleware] Error:', error);
    // Nếu có lỗi khi check, có thể:
    // 1. Cho phép (fail-safe) - không an toàn
    // 2. Từ chối (fail-secure) - an toàn hơn nhưng có thể block nhầm
    // Ở đây tôi chọn fail-secure: từ chối nếu có lỗi
    return next(new ApiError(500, 'Không thể kiểm tra hình ảnh. Vui lòng thử lại sau.'));
  }
}

