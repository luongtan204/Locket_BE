import { User, IUser } from '../models/user.model';
import { ApiError } from '../utils/apiResponse';
import bcrypt from 'bcryptjs';
import { uploadToCloudinary, deleteFromCloudinary } from '../utils/cloudinary';
import { Types } from 'mongoose';

export class UserService {
  /**
   * Đổi mật khẩu
   * @param userId - ID của user
   * @param currentPassword - Mật khẩu hiện tại
   * @param newPassword - Mật khẩu mới
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<IUser> {
    // Tìm user bao gồm cả passwordHash
    const user = await User.findById(userId).select('+passwordHash');

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    // Kiểm tra mật khẩu hiện tại
    const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);

    if (!isPasswordValid) {
      throw new ApiError(401, 'Current password is incorrect');
    }

    // Hash mật khẩu mới
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Cập nhật mật khẩu mới
    user.passwordHash = newPasswordHash;
    await user.save();

    return user;
  }

  /**
   * Đổi email
   * @param userId - ID của user
   * @param password - Mật khẩu để xác thực
   * @param newEmail - Email mới
   */
  async changeEmail(userId: string, password: string, newEmail: string): Promise<IUser> {
    // Tìm user bao gồm cả passwordHash
    const user = await User.findById(userId).select('+passwordHash');

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new ApiError(401, 'Password is incorrect');
    }

    // Normalize email
    const normalizedEmail = newEmail.toLowerCase().trim();

    // Kiểm tra email đã tồn tại chưa
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser && existingUser._id.toString() !== userId) {
      throw new ApiError(409, 'Email already in use');
    }

    // Cập nhật email mới
    user.email = normalizedEmail;
    await user.save();

    return user;
  }

  /**
   * Cập nhật thông tin cơ bản (displayName, phone)
   * @param userId - ID của user
   * @param updateData - Dữ liệu cập nhật
   */
  async updateBasicInfo(
    userId: string,
    updateData: { displayName?: string; phone?: string }
  ): Promise<IUser> {
    const user = await User.findById(userId);

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    // Cập nhật displayName
    if (updateData.displayName !== undefined) {
      user.displayName = updateData.displayName.trim() || undefined;
    }

    // Cập nhật phone (nếu có)
    if (updateData.phone !== undefined) {
      const normalizedPhone = updateData.phone.trim();

      // Nếu phone không rỗng, kiểm tra duplicate
      if (normalizedPhone) {
        const existingUser = await User.findOne({ phone: normalizedPhone });

        if (existingUser && existingUser._id.toString() !== userId) {
          throw new ApiError(409, 'Phone number already in use');
        }

        user.phone = normalizedPhone;
      } else {
        // Nếu phone rỗng, xóa phone
        user.phone = undefined;
      }
    }

    await user.save();

    return user;
  }

  /**
   * Đổi avatar
   * @param userId - ID của user
   * @param imageBuffer - Buffer của ảnh mới
   */
  async updateAvatar(userId: string, imageBuffer: Buffer): Promise<IUser> {
    const user = await User.findById(userId);

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    // Xóa avatar cũ trên Cloudinary nếu có
    if (user.avatarPublicId) {
      try {
        await deleteFromCloudinary(user.avatarPublicId);
        console.log(`[User Service] Deleted old avatar from Cloudinary: ${user.avatarPublicId}`);
      } catch (error) {
        console.error('[User Service] Error deleting old avatar from Cloudinary:', error);
        // Không throw error, tiếp tục upload avatar mới
      }
    }

    // Upload avatar mới lên Cloudinary
    try {
      const uploadResult = await uploadToCloudinary(imageBuffer, 'locket/avatars', {
        width: 400,
        height: 400,
        crop: 'fill',
        quality: 'auto',
        fetch_format: 'auto',
      });

      user.avatarUrl = uploadResult.secure_url;
      user.avatarPublicId = uploadResult.public_id;

      await user.save();

      return user;
    } catch (error) {
      console.error('[User Service] Error uploading avatar to Cloudinary:', error);
      throw new ApiError(500, 'Failed to upload avatar');
    }
  }

  /**
   * Tìm kiếm người dùng theo keyword
   * @param keyword - Từ khóa tìm kiếm
   * @param currentUserId - ID của user hiện tại (để loại bỏ khỏi kết quả)
   * @returns Danh sách user (chỉ các trường public)
   */
  async searchUsers(keyword: string, currentUserId: string): Promise<Array<{
    _id: string;
    username: string;
    displayName?: string;
    avatarUrl?: string;
  }>> {
    // Validate keyword
    if (!keyword || keyword.trim().length === 0) {
      return [];
    }

    // Escape special regex characters và tạo regex pattern
    const escapedKeyword = keyword.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regexPattern = new RegExp(escapedKeyword, 'i'); // Case-insensitive

    // Tìm kiếm user có username hoặc displayName khớp với keyword
    // Loại bỏ user hiện tại và chỉ lấy user active
    const users = await User.find({
      _id: { $ne: new Types.ObjectId(currentUserId) }, // Loại bỏ user hiện tại
      isActive: true, // Chỉ lấy user active
      $or: [
        { username: { $regex: regexPattern } },
        { displayName: { $regex: regexPattern } },
      ],
    })
      .select('_id username displayName avatarUrl') // Chỉ lấy các trường public
      .limit(20) // Giới hạn 20 kết quả
      .lean();

    // Format kết quả
    return users.map((user) => ({
      _id: user._id.toString(),
      username: user.username,
      displayName: user.displayName || undefined,
      avatarUrl: user.avatarUrl || undefined,
    }));
  }
}

// Export instance để sử dụng
export const userService = new UserService();

