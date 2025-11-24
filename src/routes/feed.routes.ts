import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import { checkPremiumStatus } from '../middlewares/subscription.middleware';
import * as feedController from '../controllers/feed.controller';

const router = Router();

/**
 * GET /feed
 * Lấy feed của user với Cursor Pagination (Infinite Scroll)
 * Query params:
 *   - limit: number (optional, default: 10, max: 50) - Số lượng items mỗi lần
 *   - cursor: string (optional) - Mốc thời gian (createdAt ISO string) của bài viết cuối cùng
 * 
 * Response:
 *   {
 *     "success": true,
 *     "data": {
 *       "data": [...feedItems...],
 *       "pagination": {
 *         "nextCursor": "2023-10-25T10:00:00.000Z" | null,
 *         "hasMore": true | false
 *       }
 *     }
 *   }
 * 
 * Cách sử dụng:
 *   - Lần đầu: GET /api/feed?limit=10 (không có cursor)
 *   - Lần sau: GET /api/feed?limit=10&cursor=2023-10-25T10:00:00.000Z
 *   - Tiếp tục cho đến khi hasMore = false
 */
router.get('/', requireAuth, checkPremiumStatus, feedController.getFeed);

export default router;

