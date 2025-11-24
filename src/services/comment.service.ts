import { Comment, IComment } from '../models/comment.model';
import { Post } from '../models/post.model';
import { Types } from 'mongoose';
import { ApiError } from '../utils/apiResponse';

/**
 * Class CommentService - Xử lý business logic cho Comments
 */
export class CommentService {
  /**
   * Tạo comment mới trên một post
   * @param userId - ID của user (author)
   * @param postId - ID của post
   * @param content - Nội dung comment
   * @param parentCommentId - ID của parent comment (nếu là reply)
   * @param mentions - Danh sách user IDs được mention
   * @returns Comment document
   */
  async createComment(
    userId: string,
    postId: string,
    content: string,
    parentCommentId?: string,
    mentions?: string[]
  ): Promise<IComment> {
    // Kiểm tra post có tồn tại không
    const post = await Post.findById(postId);
    if (!post) {
      throw new ApiError(404, 'Post not found');
    }

    // Kiểm tra parent comment nếu có
    if (parentCommentId) {
      const parentComment = await Comment.findById(parentCommentId);
      if (!parentComment) {
        throw new ApiError(404, 'Parent comment not found');
      }
      if (parentComment.post.toString() !== postId) {
        throw new ApiError(400, 'Parent comment does not belong to this post');
      }
    }

    // Tạo comment
    const comment = await Comment.create({
      post: new Types.ObjectId(postId),
      author: new Types.ObjectId(userId),
      content: content.trim(),
      parentComment: parentCommentId ? new Types.ObjectId(parentCommentId) : null,
      mentions: mentions ? mentions.map((id) => new Types.ObjectId(id)) : [],
      isDeleted: false,
    });

    // Tăng commentCount trong post
    post.commentCount = (post.commentCount || 0) + 1;
    await post.save();

    return comment;
  }

  /**
   * Xóa comment (soft delete)
   * @param userId - ID của user
   * @param commentId - ID của comment
   */
  async deleteComment(userId: string, commentId: string): Promise<void> {
    const comment = await Comment.findById(commentId);
    if (!comment) {
      throw new ApiError(404, 'Comment not found');
    }

    // Kiểm tra quyền (chỉ author mới xóa được)
    if (comment.author.toString() !== userId) {
      throw new ApiError(403, 'You are not authorized to delete this comment');
    }

    // Soft delete
    comment.isDeleted = true;
    await comment.save();

    // Giảm commentCount trong post
    const post = await Post.findById(comment.post);
    if (post) {
      post.commentCount = Math.max(0, (post.commentCount || 0) - 1);
      await post.save();
    }
  }

  /**
   * Lấy danh sách comments của một post
   * @param postId - ID của post
   * @param page - Số trang
   * @param limit - Số lượng comments mỗi trang
   * @returns Danh sách comments
   */
  async getPostComments(
    postId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<IComment[]> {
    const skip = (page - 1) * limit;

    return await Comment.find({
      post: new Types.ObjectId(postId),
      isDeleted: false,
      parentComment: null, // Chỉ lấy top-level comments
    })
      .populate('author', 'username displayName avatarUrl')
      .populate('mentions', 'username displayName')
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit)
      .lean();
  }

  /**
   * Lấy danh sách replies của một comment
   * @param commentId - ID của parent comment
   * @param page - Số trang
   * @param limit - Số lượng replies mỗi trang
   * @returns Danh sách replies
   */
  async getCommentReplies(
    commentId: string,
    page: number = 1,
    limit: number = 10
  ): Promise<IComment[]> {
    const skip = (page - 1) * limit;

    return await Comment.find({
      parentComment: new Types.ObjectId(commentId),
      isDeleted: false,
    })
      .populate('author', 'username displayName avatarUrl')
      .populate('mentions', 'username displayName')
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit)
      .lean();
  }
}

// Export instance để sử dụng
export const commentService = new CommentService();

