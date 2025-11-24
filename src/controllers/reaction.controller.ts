import { Request, Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { reactionService } from '../services/reaction.service';
import { ok, ApiError } from '../utils/apiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { ReactionType } from '../models/reaction.model';

/**
 * Thêm hoặc cập nhật reaction cho một post
 * POST /api/posts/:id/react
 * Body: { type: ReactionType }
 */
export const addReaction = asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as unknown as AuthRequest;
  
  if (!authReq.userId) {
    throw new ApiError(401, 'Unauthorized');
  }

  const { id: postId } = req.params;
  const { type } = req.body as { type: ReactionType };

  if (!type) {
    throw new ApiError(400, 'Reaction type is required');
  }

  const validTypes: ReactionType[] = ['heart', 'smile', 'laugh', 'shock', 'sad', 'thumbsup'];
  if (!validTypes.includes(type)) {
    throw new ApiError(400, 'Invalid reaction type');
  }

  const reaction = await reactionService.addOrUpdateReaction(authReq.userId, postId, type);

  return res.status(200).json(ok(reaction, 'Reaction added successfully'));
});

/**
 * Xóa reaction của user trên một post
 * DELETE /api/posts/:id/react
 */
export const removeReaction = asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as unknown as AuthRequest;
  
  if (!authReq.userId) {
    throw new ApiError(401, 'Unauthorized');
  }

  const { id: postId } = req.params;

  await reactionService.removeReaction(authReq.userId, postId);

  return res.status(200).json(ok(null, 'Reaction removed successfully'));
});

/**
 * Lấy reaction của user trên một post
 * GET /api/posts/:id/react
 */
export const getUserReaction = asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as unknown as AuthRequest;
  
  if (!authReq.userId) {
    throw new ApiError(401, 'Unauthorized');
  }

  const { id: postId } = req.params;

  const reaction = await reactionService.getUserReaction(authReq.userId, postId);

  return res.status(200).json(ok(reaction, 'Reaction retrieved successfully'));
});
