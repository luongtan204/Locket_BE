import { Post } from '../models/post.model';
import { Comment } from '../models/comment.model';
import { Reaction } from '../models/reaction.model';
import { ApiError } from '../utils/apiResponse';

class AdminPostService {
  async getPosts(params: { page?: number; limit?: number }) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    // Get total count
    const total = await Post.countDocuments({});

    // Get posts with author info
    const posts = await Post.find({})
      .populate('author', 'username displayName avatarUrl')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return {
      items: posts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async deletePostById(postId: string) {
    const deletedPost = await Post.findByIdAndDelete(postId);

    if (!deletedPost) {
      throw new ApiError(404, 'Post not found');
    }

    await Promise.all([
      Comment.deleteMany({ post: deletedPost._id }),
      Reaction.deleteMany({ post: deletedPost._id }),
    ]);

    return deletedPost;
  }
}

export const adminPostService = new AdminPostService();

