import { User } from '../models/user.model';
import { ApiError } from '../utils/apiResponse';

/**
 * Lấy thông tin user theo username để hiển thị trên invite page
 * @param username - Username cần tìm
 * @returns User info (id, username, displayName, avatarUrl)
 */
export async function getUserByUsername(username: string) {
  const normalizedUsername = username.toLowerCase().trim();
  
  const user = await User.findOne({ username: normalizedUsername })
    .select('_id username displayName avatarUrl isActive')
    .lean();

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  if (!user.isActive) {
    throw new ApiError(404, 'User not found');
  }

  return {
    id: user._id.toString(),
    username: user.username,
    displayName: user.displayName || user.username,
    avatarUrl: user.avatarUrl || null,
  };
}

/**
 * Resolve username thành user info (cho mobile app)
 * @param username - Username cần resolve
 * @returns User info để hiển thị popup kết bạn
 */
export async function resolveInvite(username: string) {
  const normalizedUsername = username.toLowerCase().trim();
  
  const user = await User.findOne({ username: normalizedUsername })
    .select('_id username displayName avatarUrl isActive')
    .lean();

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  if (!user.isActive) {
    throw new ApiError(404, 'User not found');
  }

  return {
    id: user._id.toString(),
    username: user.username,
    displayName: user.displayName || user.username,
    avatarUrl: user.avatarUrl || null,
  };
}

