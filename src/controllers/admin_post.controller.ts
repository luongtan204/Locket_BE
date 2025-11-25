import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { adminPostService } from '../services/admin_post.service';
import { auditService } from '../services/audit.service';
import { ApiError, ok } from '../utils/apiResponse';

class AdminPostController {
  async getPosts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit } = req.query;
      const result = await adminPostService.getPosts({
        page: page ? parseInt(page as string, 10) : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
      });
      res.json(ok(result, 'Posts retrieved successfully'));
    } catch (error) {
      next(error);
    }
  }

  async deletePost(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { postId } = req.params;
      const actingUserId = req.user?._id?.toString();

      if (!actingUserId) {
        return next(new ApiError(401, 'Missing admin context'));
      }

      const deletedPost = await adminPostService.deletePostById(postId);

      await auditService.logAdminAction(
        actingUserId,
        'DELETE',
        'POST',
        deletedPost._id.toString(),
        {
          description: `Delete post ${postId} by admin`,
          postData: {
            author: deletedPost.author.toString(),
            caption: deletedPost.caption,
            imageUrl: deletedPost.imageUrl,
          },
        }
      );

      res.json(ok({ post: deletedPost }, 'Post deleted successfully'));
    } catch (error) {
      next(error);
    }
  }
}

export const adminPostController = new AdminPostController();

