import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import * as friendshipController from '../controllers/friendship.controller';

const router = Router();

/**
 * GET /friendships
 * Lấy danh sách bạn bè (status = 'accepted')
 */
router.get('/', requireAuth, friendshipController.getFriends);

/**
 * GET /friendships/pending
 * Lấy danh sách lời mời đang pending mà user nhận được
 */
router.get('/pending', requireAuth, friendshipController.getPending);

/**
 * GET /friendships/check/:userId
 * Kiểm tra trạng thái friendship giữa 2 user
 */
router.get('/check/:userId', requireAuth, friendshipController.checkStatus);

/**
 * POST /friendships/request
 * Gửi lời mời kết bạn
 * Body: { toUserId: string }
 */
router.post('/request', requireAuth, friendshipController.sendFriendRequest);

/**
 * POST /friendships/:requestId/accept
 * Chấp nhận lời mời kết bạn
 */
router.post('/:requestId/accept', requireAuth, friendshipController.acceptFriendRequest);

/**
 * POST /friendships/:requestId/reject
 * Từ chối hoặc hủy lời mời kết bạn
 */
router.post('/:requestId/reject', requireAuth, friendshipController.rejectFriendRequest);

/**
 * DELETE /friendships/:friendId
 * Hủy kết bạn (xóa quan hệ bạn bè)
 */
router.delete('/:friendId', requireAuth, friendshipController.unfriendUser);

export default router;

