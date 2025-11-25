import { Router, Request } from 'express';
import multer, { FileFilterCallback } from 'multer';
import { requireAuth } from '../middlewares/auth.middleware';
import * as userController from '../controllers/user.controller';

const router = Router();

// Type cho multer file
type MulterFile = {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

// Cấu hình multer để lưu file vào memory (buffer) để upload lên Cloudinary
const storage = multer.memoryStorage();

// Chỉ chấp nhận file ảnh
const fileFilter = (_req: Request, file: MulterFile, cb: FileFilterCallback) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

/**
 * POST /api/users/change-password
 * Đổi mật khẩu
 * Body: { currentPassword: string, newPassword: string }
 */
router.post('/change-password', requireAuth, userController.changePassword);

/**
 * POST /api/users/change-email
 * Đổi email (yêu cầu verify password)
 * Body: { password: string, newEmail: string }
 */
router.post('/change-email', requireAuth, userController.changeEmail);

/**
 * PUT /api/users/profile
 * Cập nhật thông tin cơ bản (displayName, phone)
 * Body: { displayName?: string, phone?: string }
 */
router.put('/profile', requireAuth, userController.updateProfile);

/**
 * PATCH /api/users/avatar
 * Đổi avatar
 * Body: multipart/form-data với file (avatar)
 */
router.patch('/avatar', requireAuth, upload.single('avatar'), userController.updateAvatar);

/**
 * GET /api/users/me
 * Lấy thông tin user hiện tại
 * Headers: Authorization: Bearer <token>
 * 
 * Response: {
 *   success: true,
 *   message: "User retrieved successfully",
 *   data: {
 *     _id: string,
 *     username: string,
 *     displayName?: string,
 *     email?: string,
 *     phone?: string,
 *     avatarUrl?: string,
 *     ...
 *   }
 * }
 */
router.get('/me', requireAuth, userController.getCurrentUser);

/**
 * GET /api/users/search?keyword=abc
 * Tìm kiếm người dùng theo keyword
 * Query params: keyword (required) - Từ khóa tìm kiếm
 * 
 * Tìm kiếm các user có username hoặc displayName khớp với keyword
 * - Sử dụng regex case-insensitive (không phân biệt hoa thường)
 * - Loại bỏ user hiện tại khỏi kết quả
 * - Chỉ trả về tối đa 20 kết quả
 * - Chỉ lấy các trường public: _id, username, displayName, avatarUrl
 * 
 * Response: {
 *   success: true,
 *   message: "Search results",
 *   data: [
 *     {
 *       _id: string,
 *       username: string,
 *       displayName?: string,
 *       avatarUrl?: string
 *     }
 *   ]
 * }
 */
router.get('/search', requireAuth, userController.searchUsers);

export default router;

