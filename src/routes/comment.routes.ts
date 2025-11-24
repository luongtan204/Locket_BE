import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import * as commentController from '../controllers/comment.controller';

const router = Router();

/**
 * DELETE /comments/:id
 * Xóa comment
 */
router.delete('/:id', requireAuth, commentController.deleteComment);

/**
 * GET /comments/:id/replies
 * Lấy danh sách replies của một comment
 * Query params: page, limit
 */
router.get('/:id/replies', commentController.getCommentReplies);

export default router;

