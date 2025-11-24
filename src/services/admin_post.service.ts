import { Post } from '../models/post.model';
import { Comment } from '../models/comment.model';
import { Reaction } from '../models/reaction.model';
import { ApiError } from '../utils/apiResponse';

class AdminPostService {
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

