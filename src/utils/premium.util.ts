import { IUser } from '../models/user.model';
import { Subscription } from '../models/subscription.model';

export async function isUserPremium(user: IUser): Promise<boolean> {
  // Ưu tiên snapshot nhanh
  if (user.premium?.status && user.premium.expiresAt) {
    const now = new Date();
    if (['trialing', 'active', 'grace'].includes(user.premium.status) && user.premium.expiresAt > now) {
      return true;
    }
  }
  // Fallback: kiểm subscription đang hiệu lực trong DB
  const now = new Date();
  const sub = await Subscription.findOne({
    user: user._id,
    status: { $in: ['trialing', 'active'] },
    currentPeriodEnd: { $gt: now },
  }).lean();
  return !!sub;
}