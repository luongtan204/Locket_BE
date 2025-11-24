import { User } from '../models/user.model';
import { ApiError } from '../utils/apiResponse';

class AdminUserService {
  async banUserById(userId: string) {
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: { isActive: false } },
      { new: true }
    );

    if (!updatedUser) {
      throw new ApiError(404, 'User not found');
    }

    return updatedUser;
  }

  async unbanUserById(userId: string) {
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: { isActive: true } },
      { new: true }
    );

    if (!updatedUser) {
      throw new ApiError(404, 'User not found');
    }

    return updatedUser;
  }
}

export const adminUserService = new AdminUserService();

