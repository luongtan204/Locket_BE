import { Response } from 'express';
import { User } from '../models/user.model';
import { buildCrud } from '../utils/crudFactory';
import { AuthRequest } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError, ok } from '../utils/apiResponse';
import { userService } from '../services/user.service';

// Định nghĩa type cho Multer file
interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

// Extend AuthRequest để có file type cho avatar upload
interface AvatarRequest extends Omit<AuthRequest, 'file'> {
  file?: MulterFile;
}

/**
 * Đổi mật khẩu
 * POST /api/users/change-password
 * Body: { currentPassword: string, newPassword: string }
 */
export const changePassword = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.userId) {
    throw new ApiError(401, 'Unauthorized');
  }

  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new ApiError(400, 'currentPassword and newPassword are required');
  }

  if (newPassword.length < 6) {
    throw new ApiError(400, 'New password must be at least 6 characters');
  }

  const user = await userService.changePassword(req.userId, currentPassword, newPassword);

  // Trả về user đã cập nhật (loại bỏ passwordHash)
  const userObj = user.toObject();
  delete (userObj as any).passwordHash;

  return res.status(200).json(ok(userObj, 'Password changed successfully'));
});

/**
 * Đổi email
 * POST /api/users/change-email
 * Body: { password: string, newEmail: string }
 */
export const changeEmail = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.userId) {
    throw new ApiError(401, 'Unauthorized');
  }

  const { password, newEmail } = req.body;

  if (!password || !newEmail) {
    throw new ApiError(400, 'password and newEmail are required');
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(newEmail)) {
    throw new ApiError(400, 'Invalid email format');
  }

  const user = await userService.changeEmail(req.userId, password, newEmail);

  // Trả về user đã cập nhật (loại bỏ passwordHash)
  const userObj = user.toObject();
  delete (userObj as any).passwordHash;

  return res.status(200).json(ok(userObj, 'Email changed successfully'));
});

/**
 * Cập nhật thông tin cơ bản (displayName, phone)
 * PUT /api/users/profile
 * Body: { displayName?: string, phone?: string }
 */
export const updateProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.userId) {
    throw new ApiError(401, 'Unauthorized');
  }

  const { displayName, phone } = req.body;

  const updateData: { displayName?: string; phone?: string } = {};

  if (displayName !== undefined) {
    updateData.displayName = displayName;
  }

  if (phone !== undefined) {
    updateData.phone = phone;
  }

  // Kiểm tra có ít nhất một field để update
  if (Object.keys(updateData).length === 0) {
    throw new ApiError(400, 'At least one field (displayName or phone) must be provided');
  }

  const user = await userService.updateBasicInfo(req.userId, updateData);

  // Trả về user đã cập nhật (loại bỏ passwordHash)
  const userObj = user.toObject();
  delete (userObj as any).passwordHash;

  return res.status(200).json(ok(userObj, 'Profile updated successfully'));
});

/**
 * Đổi avatar
 * PATCH /api/users/avatar
 * Body: multipart/form-data với file (avatar)
 */
export const updateAvatar = asyncHandler(async (req: AvatarRequest, res: Response) => {
  if (!req.userId) {
    throw new ApiError(401, 'Unauthorized');
  }

  const avatarFile = req.file;

  if (!avatarFile || !avatarFile.buffer) {
    throw new ApiError(400, 'Avatar image is required');
  }

  const user = await userService.updateAvatar(req.userId, avatarFile.buffer);

  // Trả về user đã cập nhật (loại bỏ passwordHash)
  const userObj = user.toObject();
  delete (userObj as any).passwordHash;

  return res.status(200).json(ok(userObj, 'Avatar updated successfully'));
});

/**
 * Tìm kiếm người dùng
 * GET /api/users/search?keyword=abc
 * Query params: keyword (required)
 */
export const searchUsers = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.userId) {
    throw new ApiError(401, 'Unauthorized');
  }

  const keyword = req.query.keyword as string;

  if (!keyword || keyword.trim().length === 0) {
    return res.status(200).json(ok([], 'Search results'));
  }

  // Validate keyword length (tối thiểu 1 ký tự)
  if (keyword.trim().length < 1) {
    throw new ApiError(400, 'Keyword must be at least 1 character');
  }

  const users = await userService.searchUsers(keyword, req.userId);

  return res.status(200).json(ok(users, 'Search results'));
});

export const { list, getById, create, updateById, removeById } = buildCrud(User);
