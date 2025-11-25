import { Ad, IAd, AdPlacement } from '../models/ad.model';
import { IUser } from '../models/user.model';
import { ApiError } from '../utils/apiResponse';
import { Types } from 'mongoose';

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

/**
 * Service xử lý quản lý quảng cáo cho Admin
 */
class AdService {
  /**
   * Tạo quảng cáo mới
   * @param adData - Dữ liệu quảng cáo
   * @param createdBy - ID của admin tạo
   * @returns Quảng cáo đã được tạo
   */
  async createAd(adData: {
    name: string;
    placement: AdPlacement;
    imageUrl: string;
    title?: string;
    description?: string;
    ctaText?: string;
    ctaUrl?: string;
    priority?: number;
    isActive?: boolean;
    startAt?: Date | null;
    endAt?: Date | null;
  }, createdBy: string): Promise<IAd> {
    // Validation
    if (!adData.name || typeof adData.name !== 'string' || adData.name.trim() === '') {
      throw new ApiError(400, 'Name is required and must be a non-empty string');
    }

    if (!adData.placement || !['feed', 'splash', 'banner'].includes(adData.placement)) {
      throw new ApiError(400, 'Placement is required and must be one of: feed, splash, banner');
    }

    if (!adData.imageUrl || typeof adData.imageUrl !== 'string' || adData.imageUrl.trim() === '') {
      throw new ApiError(400, 'ImageUrl is required and must be a non-empty string');
    }

    // Tạo quảng cáo mới
    const newAd = await Ad.create({
      name: adData.name.trim(),
      placement: adData.placement,
      imageUrl: adData.imageUrl.trim(),
      title: adData.title?.trim(),
      description: adData.description?.trim(),
      ctaText: adData.ctaText?.trim(),
      ctaUrl: adData.ctaUrl?.trim(),
      priority: adData.priority ?? 0,
      isActive: adData.isActive !== undefined ? adData.isActive : true,
      startAt: adData.startAt || null,
      endAt: adData.endAt || null,
      createdBy: new Types.ObjectId(createdBy),
      impressionCount: 0,
      clickCount: 0,
    });

    return newAd;
  }

  /**
   * Cập nhật trạng thái quảng cáo (ACTIVE hoặc PAUSED)
   * @param adId - ID của quảng cáo
   * @param status - Trạng thái mới: 'ACTIVE' hoặc 'PAUSED'
   * @param updatedBy - ID của admin cập nhật
   * @returns Quảng cáo đã được cập nhật
   */
  async updateAdStatus(adId: string, status: 'ACTIVE' | 'PAUSED', updatedBy: string): Promise<IAd> {
    // Tìm quảng cáo
    const ad = await Ad.findById(adId);
    if (!ad) {
      throw new ApiError(404, 'Ad not found');
    }

    // Map status to isActive
    const isActive = status === 'ACTIVE';

    // Cập nhật trạng thái
    ad.isActive = isActive;
    ad.updatedBy = new Types.ObjectId(updatedBy);
    await ad.save();

    return ad;
  }
}

export const adService = new AdService();