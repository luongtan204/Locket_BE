import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { Subscription } from '../models/subscription.model';
import { Types } from 'mongoose';

/**
 * Interface mở rộng AuthRequest để có isPremium với type safety
 */
export interface PremiumRequest extends AuthRequest {
  isPremium: boolean;
}

/**
 * Middleware kiểm tra premium status của user
 * Gán isPremium = true/false vào req.isPremium
 * 
 * @param req - Request object với user đã được authenticate
 * @param res - Response object
 * @param next - Next function
 */
export async function checkPremiumStatus(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const premiumReq = req as PremiumRequest;
    
    // Kiểm tra xem user đã được authenticate chưa
    if (!premiumReq.user || !premiumReq.user._id) {
      premiumReq.isPremium = false;
      return next();
    }

    // Lấy userId từ req.user._id
    const userId = premiumReq.user._id.toString();

    // Query bảng subscription để kiểm tra xem user có subscription đang hoạt động không
    // Điều kiện: status = 'active' và currentPeriodEnd > Date.now()
    const activeSubscription = await Subscription.findOne({
      user: new Types.ObjectId(userId),
      status: 'active',
      currentPeriodEnd: { $gt: new Date() },
    });

    // Gán kết quả vào req.isPremium = boolean
    premiumReq.isPremium = !!activeSubscription;

    // Gọi next() để tiếp tục request
    next();
  } catch (error) {
    // Nếu có lỗi, mặc định là không premium
    const premiumReq = req as PremiumRequest;
    premiumReq.isPremium = false;
    next();
  }
}

