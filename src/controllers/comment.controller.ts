import { Request, Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { commentService } from '../services/comment.service';
import { ok, ApiError } from '../utils/apiResponse';
import { asyncHandler } from '../utils/asyncHandler';

/**
 * Tạo comment mới trên một post
 * POST /api/posts/:id/comment
 * Body: { content: string, parentCommentId?: string, mentions?: string[] }
 */
export const createComment = asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as unknown as AuthRequest;
  
  if (!authReq.userId) {
    throw new ApiError(401, 'Unauthorized');
  }

  const { id: postId } = req.params;
  const { content, parentCommentId, mentions } = req.body as {
    content: string;
    parentCommentId?: string;
    mentions?: string[];
  };

  if (!content || !content.trim()) {
    throw new ApiError(400, 'Comment content is required');
  }

  if (content.length > 1000) {
    throw new ApiError(400, 'Comment content must be less than 1000 characters');
  }

  const comment = await commentService.createComment(
    authReq.userId,
    postId,
    content,
    parentCommentId,
    mentions
  );

  return res.status(201).json(ok(comment, 'Comment created successfully'));
});

/**
 * Xóa comment
 * DELETE /api/comments/:id
 */
export const deleteComment = asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as unknown as AuthRequest;
  
  if (!authReq.userId) {
    throw new ApiError(401, 'Unauthorized');
  }

  const { id: commentId } = req.params;

  await commentService.deleteComment(authReq.userId, commentId);

  return res.status(200).json(ok(null, 'Comment deleted successfully'));
});

/**
 * Lấy danh sách comments của một post
 * GET /api/posts/:id/comments?page=1&limit=20
 */
export const getPostComments = asyncHandler(async (req: Request, res: Response) => {
  const { id: postId } = req.params;
  const page = Math.max(parseInt((req.query.page as string) || '1'), 1);
  const limit = Math.min(Math.max(parseInt((req.query.limit as string) || '20'), 1), 100);

  const comments = await commentService.getPostComments(postId, page, limit);

  return res.status(200).json(ok(comments, 'Comments retrieved successfully'));
});

/**
 * Lấy danh sách replies của một comment
 * GET /api/comments/:id/replies?page=1&limit=10
 */
export const getCommentReplies = asyncHandler(async (req: Request, res: Response) => {
  const { id: commentId } = req.params;
  const page = Math.max(parseInt((req.query.page as string) || '1'), 1);
  const limit = Math.min(Math.max(parseInt((req.query.limit as string) || '10'), 1), 50);

  const replies = await commentService.getCommentReplies(commentId, page, limit);

  return res.status(200).json(ok(replies, 'Replies retrieved successfully'));
});
