import { Reaction, IReaction, ReactionType } from '../models/reaction.model';
import { Post } from '../models/post.model';
import { Types } from 'mongoose';
import { ApiError } from '../utils/apiResponse';

/**
 * Class ReactionService - Xử lý business logic cho Reactions
 */
export class ReactionService {
  /**
   * Thêm hoặc cập nhật reaction cho một post
   * @param userId - ID của user
   * @param postId - ID của post
   * @param type - Loại reaction
   * @returns Reaction document
   */
  async addOrUpdateReaction(
    userId: string,
    postId: string,
    type: ReactionType
  ): Promise<IReaction> {
    // Kiểm tra post có tồn tại không
    const post = await Post.findById(postId);
    if (!post) {
      throw new ApiError(404, 'Post not found');
    }

    // Tìm reaction hiện tại
    let reaction = await Reaction.findOne({
      post: new Types.ObjectId(postId),
      user: new Types.ObjectId(userId),
    });

    if (reaction) {
      // Nếu đã có reaction, cập nhật type
      const oldType = reaction.type;
      reaction.type = type;
      await reaction.save();

      // Cập nhật reactionCounts trong post
      if (oldType !== type) {
        // Giảm count của type cũ
        const oldCount = post.reactionCounts[oldType] || 0;
        post.reactionCounts[oldType] = Math.max(0, oldCount - 1);

        // Tăng count của type mới
        const newCount = post.reactionCounts[type] || 0;
        post.reactionCounts[type] = newCount + 1;
        await post.save();
      }
    } else {
      // Tạo reaction mới
      reaction = await Reaction.create({
        post: new Types.ObjectId(postId),
        user: new Types.ObjectId(userId),
        type,
      });

      // Tăng reactionCount và reactionCounts trong post
      post.reactionCount = (post.reactionCount || 0) + 1;
      const typeCount = post.reactionCounts[type] || 0;
      post.reactionCounts[type] = typeCount + 1;
      await post.save();
    }

    return reaction;
  }

  /**
   * Xóa reaction của user trên một post
   * @param userId - ID của user
   * @param postId - ID của post
   */
  async removeReaction(userId: string, postId: string): Promise<void> {
    const reaction = await Reaction.findOne({
      post: new Types.ObjectId(postId),
      user: new Types.ObjectId(userId),
    });

    if (!reaction) {
      throw new ApiError(404, 'Reaction not found');
    }

    const post = await Post.findById(postId);
    if (!post) {
      throw new ApiError(404, 'Post not found');
    }

    // Giảm reactionCount và reactionCounts trong post
    post.reactionCount = Math.max(0, (post.reactionCount || 0) - 1);
    const typeCount = post.reactionCounts[reaction.type] || 0;
    post.reactionCounts[reaction.type] = Math.max(0, typeCount - 1);
    await post.save();

    // Xóa reaction
    await Reaction.findByIdAndDelete(reaction._id);
  }

  /**
   * Lấy reaction của user trên một post
   * @param userId - ID của user
   * @param postId - ID của post
   * @returns Reaction hoặc null
   */
  async getUserReaction(userId: string, postId: string): Promise<IReaction | null> {
    return await Reaction.findOne({
      post: new Types.ObjectId(postId),
      user: new Types.ObjectId(userId),
    });
  }
}

// Export instance để sử dụng
export const reactionService = new ReactionService();

