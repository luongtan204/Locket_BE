import { Ad, IAd, AdPlacement } from '../models/ad.model';
import { IUser } from '../models/user.model';

/**
 * Kiểm tra user có xem quảng cáo không.
 * Mặc định: premium đang hiệu lực thì không hiển thị quảng cáo.
 */
export function shouldShowAdsForUser(user?: Pick<IUser, 'premium'>): boolean {
  if (!user?.premium) return true;
  const now = new Date();
  const activePremium =
    ['trialing', 'active', 'grace'].includes(user.premium.status || 'none') &&
    !!user.premium.expiresAt &&
    user.premium.expiresAt > now;
  return !activePremium;
}

/**
 * Lấy danh sách quảng cáo đang hoạt động theo placement, ưu tiên theo priority.
 * Đã sửa:
 * - Loại bỏ .lean() để trả về đúng kiểu IAd (Document), tránh mismatch kiểu.
 * - Bổ sung $exists để chắc chắn nhận cả trường không tồn tại.
 * - Thêm excludeIds để tránh lặp quảng cáo nếu cần.
 * - Cập nhật updatedAt khi tăng impression/click.
 */
export async function listActiveAds(params: {
  placement: AdPlacement;
  limit?: number;
  now?: Date;
  excludeIds?: string[];
}): Promise<IAd[]> {
  const { placement, limit = 5, now = new Date(), excludeIds = [] } = params;

  const query: any = {
    placement,
    isActive: true,
    $and: [
      { $or: [{ startAt: null }, { startAt: { $lte: now } }, { startAt: { $exists: false } }] },
      { $or: [{ endAt: null }, { endAt: { $gte: now } }, { endAt: { $exists: false } }] },
    ],
  };

  if (excludeIds.length) {
    query._id = { $nin: excludeIds };
  }

  const ads = await Ad.find(query)
    .sort({ priority: -1, createdAt: -1 })
    .limit(limit * 3); // lấy dư một chút để random

  // Trộn ngẫu nhiên nhẹ nhàng để tránh lặp một mẫu duy nhất
  for (let i = ads.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ads[i], ads[j]] = [ads[j], ads[i]];
  }

  return ads.slice(0, limit);
}

/**
 * Lấy quảng cáo cho feed: nếu user đủ điều kiện xem ads thì trả về danh sách; không thì trả mảng rỗng.
 */
export async function getFeedAdsForUser(
  user: Pick<IUser, 'premium'> | undefined,
  limit = 2,
  excludeIds: string[] = []
) {
  if (!shouldShowAdsForUser(user)) return [];
  return listActiveAds({ placement: 'feed', limit, excludeIds });
}

/**
 * Ghi nhận click (đơn giản, tăng counter) và cập nhật updatedAt.
 */
export async function trackAdClick(adId: string) {
  await Ad.updateOne(
    { _id: adId },
    { $inc: { clickCount: 1 }, $currentDate: { updatedAt: true } }
  ).exec();
}

/**
 * Ghi nhận impression (đơn giản, tăng counter) và cập nhật updatedAt.
 */
export async function trackAdImpression(adId: string) {
  await Ad.updateOne(
    { _id: adId },
    { $inc: { impressionCount: 1 }, $currentDate: { updatedAt: true } }
  ).exec();
}