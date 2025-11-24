import { Response, Request } from 'express';
import { PremiumRequest } from '../middlewares/subscription.middleware';
import { feedService } from '../services/feed.service';
import { ok, ApiError } from '../utils/apiResponse';
import { asyncHandler } from '../utils/asyncHandler';

/**
 * Lấy feed của user với Cursor Pagination (Infinite Scroll)
 * GET /api/feed?limit=10&cursor=2023-10-25T10:00:00.000Z
 * 
 * Query params:
 *   - limit: Số lượng items mỗi lần (default: 10, max: 50)
 *   - cursor: Mốc thời gian (createdAt) của bài viết cuối cùng (optional)
 * 
 * Response:
 *   {
 *     "success": true,
 *     "data": [...feedItems...],
 *     "pagination": {
 *       "nextCursor": "2023-10-25T10:00:00.000Z" | null,
 *       "hasMore": true | false
 *     }
 *   }
 */
export const getFeed = asyncHandler(async (req: Request, res: Response) => {
  const premiumReq = req as unknown as PremiumRequest;
  
  // Kiểm tra authentication
  if (!premiumReq.userId || !premiumReq.user) {
    throw new ApiError(401, 'Unauthorized');
  }

  // Lấy limit từ query params (default: 10, max: 50)
  const limit = Math.min(Math.max(parseInt((premiumReq.query?.limit as string) || '10'), 1), 50);
  
  // Lấy cursor từ query params (optional)
  const cursor = (premiumReq.query?.cursor as string) || undefined;
  
  // Lấy isPremium từ req (đã được set bởi checkPremiumStatus middleware)
  const isPremium = premiumReq.isPremium || false;

  // Gọi FeedService.getFeedWithCursor với các tham số
  const result = await feedService.getFeedWithCursor(premiumReq.userId, isPremium, limit, cursor);

  return res.status(200).json(ok(result, 'Feed retrieved successfully'));
});

