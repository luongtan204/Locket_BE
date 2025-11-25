import { User } from '../models/user.model';
import { ApiError } from '../utils/apiResponse';

class AdminUserService {
  async getUsers(params: { page?: number; limit?: number; search?: string }) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;
    const search = params.search?.trim() || '';

    // Build query
    const query: any = {};
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { displayName: { $regex: search, $options: 'i' } },
      ];
    }

    // Get total count
    const total = await User.countDocuments(query);

    // Get users (exclude passwordHash)
    const users = await User.find(query)
      .select('-passwordHash')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return {
      items: users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

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

