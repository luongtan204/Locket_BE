import { Post, IPost } from '../models/post.model';
import { Friendship } from '../models/friendship.model';
import { Device } from '../models/device.model';
import { Types } from 'mongoose';
import { ApiError } from '../utils/apiResponse';
import { getSocketIOInstance } from './socket.service';

/**
 * Class PostService - Xử lý business logic cho Post
 */
export class PostService {
  /**
   * Tạo bài viết mới (Upload Moment)
   * @param userId - ID của user tạo post
   * @param imageUrl - URL ảnh đã upload lên Cloudinary/S3
   * @param caption - Nội dung caption (optional)
   * @returns Post document đã tạo
   */
  async createPost(userId: string, imageUrl: string, caption?: string): Promise<IPost> {
    // 1. Logic Lưu trữ: Tạo bản ghi mới trong post.model
    const post = await Post.create({
      author: new Types.ObjectId(userId),
      imageUrl,
      caption: caption || undefined,
      visibility: 'friends',
      reactionCount: 0,
      commentCount: 0,
      reactionCounts: {},
    });

    // 2. Logic Cập nhật Widget (Thông báo)
    const postId = typeof post._id === 'string' ? post._id : (post._id as Types.ObjectId).toString();
    await this.sendNotificationsToFriends(userId, postId);

    return post;
  }

  /**
   * Gửi thông báo đến bạn bè khi có post mới
   * @param userId - ID của user tạo post
   * @param postId - ID của post vừa tạo
   */
  private async sendNotificationsToFriends(userId: string, postId: string): Promise<void> {
    // 2.1. Tìm tất cả bạn bè đã chấp nhận (status: 'accepted')
    const friendships = await Friendship.find({
      $or: [
        { userA: new Types.ObjectId(userId), status: 'accepted' },
        { userB: new Types.ObjectId(userId), status: 'accepted' },
      ],
    });

    // 2.2. Lấy danh sách friend IDs
    const friendIds = friendships.map((friendship) => {
      const userAId = friendship.userA.toString();
      const userBId = friendship.userB.toString();
      return userAId === userId ? userBId : userAId;
    });

    if (friendIds.length === 0) {
      return;
    }

    // 2.3. Tìm tất cả FCM tokens của bạn bè từ device.model
    const devices = await Device.find({
      user: { $in: friendIds.map((id) => new Types.ObjectId(id)) },
    });

    const tokens = devices.map((device) => device.fcmToken).filter(Boolean);

    if (tokens.length === 0) {
      return;
    }

    // 2.4. Gọi hàm giả lập mockSendNotification
    this.mockSendNotification(tokens, postId);
  }

  /**
   * Hàm giả lập gửi notification
   * @param tokens - Mảng FCM tokens
   * @param postId - ID của post
   */
  private mockSendNotification(tokens: string[], postId: string): void {
    console.log(`Đã gửi notification đến ${tokens.length} thiết bị để cập nhật Widget.`);
    console.log(`Post ID: ${postId}`);
    console.log(`Tokens: ${tokens.join(', ')}`);

    // TODO: Thực tế sẽ gọi:
    // - Expo Push API: https://docs.expo.dev/push-notifications/sending-notifications/
    // - FCM: https://firebase.google.com/docs/cloud-messaging
  }

  /**
   * Lấy lịch sử posts giữa current user và một friend
   * @param currentUserId - ID của user hiện tại
   * @param friendId - ID của friend
   * @param page - Số trang (default: 1)
   * @param limit - Số lượng posts mỗi trang (default: 20)
   * @param groupByMonth - Có nhóm theo tháng/năm không (default: false)
   * @returns Danh sách posts hoặc posts được nhóm theo tháng/năm
   */
  async getHistoryWithFriend(
    currentUserId: string,
    friendId: string,
    page: number = 1,
    limit: number = 20,
    groupByMonth: boolean = false
  ): Promise<{
    posts: IPost[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
    grouped?: Record<string, IPost[]>;
  }> {
    // 1. Kiểm tra xem hai user có phải là bạn bè không
    const friendship = await Friendship.findOne({
      $or: [
        { userA: new Types.ObjectId(currentUserId), userB: new Types.ObjectId(friendId) },
        { userA: new Types.ObjectId(friendId), userB: new Types.ObjectId(currentUserId) },
      ],
      status: 'accepted',
    });

    if (!friendship) {
      throw new ApiError(403, 'You are not friends with this user');
    }

    // 2. Tính toán pagination
    const skip = (page - 1) * limit;

    // 3. Query posts: (author = me OR author = friend) AND visibility = 'friends' AND not deleted
    const query = {
      $and: [
        {
          $or: [
            { author: new Types.ObjectId(currentUserId) },
            { author: new Types.ObjectId(friendId) },
          ],
        },
        { visibility: 'friends' },
        {
          $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
        },
      ],
    };

    // 4. Lấy tổng số posts
    const total = await Post.countDocuments(query);

    // 5. Lấy posts với pagination và sort
    const posts = await Post.find(query)
      .populate('author', 'username displayName avatarUrl')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // 6. Tính toán pagination info
    const totalPages = Math.ceil(total / limit);

    const result: {
      posts: IPost[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
      grouped?: Record<string, IPost[]>;
    } = {
      posts: posts as unknown as IPost[],
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };

    // 7. Nếu yêu cầu nhóm theo tháng/năm
    if (groupByMonth) {
      const grouped: Record<string, IPost[]> = {};

      posts.forEach((post) => {
        const date = new Date(post.createdAt);
        const monthYear = date.toLocaleDateString('en-US', {
          month: 'long',
          year: 'numeric',
        });

        if (!grouped[monthYear]) {
          grouped[monthYear] = [];
        }
        grouped[monthYear].push(post as unknown as IPost);
      });

      result.grouped = grouped;
    }

    return result as {
      posts: IPost[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
      grouped?: Record<string, IPost[]>;
    };
  }

  /**
   * Lấy thông tin chi tiết một bài viết theo ID
   * @param postId - ID của post
   * @returns Post document với author đã populate
   */
  async getPostById(postId: string): Promise<IPost> {
    const post = await Post.findById(postId)
      .populate('author', 'username displayName avatarUrl')
      .lean();

    if (!post) {
      throw new ApiError(404, 'Post not found');
    }

    // Kiểm tra post đã bị xóa chưa
    if (post.deletedAt) {
      throw new ApiError(404, 'Post not found');
    }

    return post as unknown as IPost;
  }

  /**
   * Cập nhật bài viết (chỉ cho phép sửa caption và location)
   * @param postId - ID của post
   * @param userId - ID của user đang thực hiện update
   * @param updateData - Dữ liệu cập nhật (caption, location)
   * @returns Post document đã cập nhật
   */
  async updatePost(
    postId: string,
    userId: string,
    updateData: { caption?: string; location?: { name?: string; lat?: number; lng?: number } }
  ): Promise<IPost> {
    // 1. Tìm post
    const post = await Post.findById(postId);

    if (!post) {
      throw new ApiError(404, 'Post not found');
    }

    // 2. Kiểm tra post đã bị xóa chưa
    if (post.deletedAt) {
      throw new ApiError(404, 'Post not found');
    }

    // 3. Kiểm tra quyền sở hữu
    const postAuthorId = post.author.toString();
    if (postAuthorId !== userId) {
      throw new ApiError(403, 'You do not have permission to update this post');
    }

    // 4. Chỉ cho phép cập nhật caption và location
    if (updateData.caption !== undefined) {
      post.caption = updateData.caption || undefined;
    }

    if (updateData.location !== undefined) {
      post.location = updateData.location;
    }

    // 5. Lưu và populate author
    await post.save();
    await post.populate('author', 'username displayName avatarUrl');

    return post;
  }

  /**
   * Xóa bài viết (chỉ chủ bài viết mới được xóa)
   * @param postId - ID của post
   * @param userId - ID của user đang thực hiện xóa
   * @returns Post document đã xóa
   */
  async deletePost(postId: string, userId: string): Promise<IPost> {
    // 1. Tìm post
    const post = await Post.findById(postId);

    if (!post) {
      throw new ApiError(404, 'Post not found');
    }

    // 2. Kiểm tra post đã bị xóa chưa
    if (post.deletedAt) {
      throw new ApiError(404, 'Post not found');
    }

    // 3. Kiểm tra quyền sở hữu
    const postAuthorId = post.author.toString();
    if (postAuthorId !== userId) {
      throw new ApiError(403, 'You do not have permission to delete this post');
    }

    // 4. Lấy imageUrl để xóa trên Cloudinary
    const imageUrl = post.imageUrl;

    // 5. Xóa ảnh trên Cloudinary
    const { deleteFromCloudinary, extractPublicIdFromUrl } = await import('../utils/cloudinary');
    const publicId = extractPublicIdFromUrl(imageUrl);
    
    if (publicId) {
      try {
        await deleteFromCloudinary(publicId);
        console.log(`Deleted image from Cloudinary: ${publicId}`);
      } catch (error) {
        console.error('Error deleting image from Cloudinary:', error);
        // Không throw error để vẫn xóa được post trong DB nếu Cloudinary lỗi
      }
    } else {
      console.warn(`Could not extract public_id from URL: ${imageUrl}`);
    }

    // 6. Xóa post trong DB (hard delete)
    await Post.findByIdAndDelete(postId);

    // 7. Xóa các comment và reaction liên quan
    const { Comment } = await import('../models/comment.model');
    const { Reaction } = await import('../models/reaction.model');
    
    await Promise.all([
      Comment.deleteMany({ post: post._id }),
      Reaction.deleteMany({ post: post._id }),
    ]);

    return post;
  }

  /**
   * Đánh dấu bài viết đã được xem (Mark as Seen)
   * @param postId - ID của post
   * @param userId - ID của user đang xem
   * @returns Post document đã cập nhật
   */
  async markPostAsSeen(postId: string, userId: string): Promise<IPost> {
    // 1. Tìm post
    const post = await Post.findById(postId);

    if (!post) {
      throw new ApiError(404, 'Post not found');
    }

    // 2. Kiểm tra post đã bị xóa chưa
    if (post.deletedAt) {
      throw new ApiError(404, 'Post not found');
    }

    // 3. Không cho phép tác giả tự đánh dấu đã xem bài viết của mình
    const postAuthorId = post.author.toString();
    if (postAuthorId === userId) {
      throw new ApiError(400, 'You cannot mark your own post as seen');
    }

    // 4. Kiểm tra xem user đã xem post này chưa
    const userIdObj = new Types.ObjectId(userId);
    const existingViewerIndex = post.viewers.findIndex(
      (viewer) => viewer.userId.toString() === userId
    );

    const seenAt = new Date();

    if (existingViewerIndex >= 0) {
      // Nếu đã xem rồi, cập nhật seenAt
      post.viewers[existingViewerIndex].seenAt = seenAt;
    } else {
      // Nếu chưa xem, thêm vào mảng viewers
      post.viewers.push({
        userId: userIdObj,
        seenAt,
      });
    }

    // 5. Lưu post
    await post.save();

    // 6. Emit socket event cho tác giả bài viết
    const io = getSocketIOInstance();
    if (io) {
      const postIdStr = typeof post._id === 'string' ? post._id : (post._id as Types.ObjectId).toString();
      io.to(`user:${postAuthorId}`).emit('post_seen', {
        postId: postIdStr,
        viewedBy: userId,
        seenAt: seenAt.toISOString(),
      });
      console.log(`[Post Service] Emitted post_seen event to user:${postAuthorId} for post:${postIdStr}`);
    } else {
      console.warn('[Post Service] Socket.io instance not available, cannot emit post_seen event');
    }

    return post;
  }

  /**
   * Kiểm tra quyền xem tường nhà của một user
   * @param currentUserId - ID của user đang xem
   * @param targetUserId - ID của user chủ tường nhà
   * @returns true nếu có quyền xem, false nếu không
   */
  async canViewUserWall(currentUserId: string, targetUserId: string): Promise<boolean> {
    // Case 1: User tự xem tường nhà của mình
    if (currentUserId === targetUserId) {
      return true;
    }

    // Case 2: Kiểm tra xem hai người có phải là bạn bè không
    const friendship = await Friendship.findOne({
      $or: [
        { userA: new Types.ObjectId(currentUserId), userB: new Types.ObjectId(targetUserId) },
        { userA: new Types.ObjectId(targetUserId), userB: new Types.ObjectId(currentUserId) },
      ],
      status: 'accepted', // Chỉ chấp nhận bạn bè đã accepted
    });

    return !!friendship;
  }

  /**
   * Lấy danh sách bài viết của một user (User Profile Feed / Wall) với Cursor Pagination
   * @param currentUserId - ID của user đang xem
   * @param targetUserId - ID của user chủ tường nhà
   * @param limit - Số lượng posts mỗi lần (default: 10)
   * @param cursor - Mốc thời gian (createdAt) của bài viết cuối cùng (optional)
   * @returns Danh sách posts với pagination info
   */
  async getUserWall(
    currentUserId: string,
    targetUserId: string,
    limit: number = 10,
    cursor?: string
  ): Promise<{
    data: IPost[];
    pagination: {
      nextCursor: string | null;
      hasMore: boolean;
    };
  }> {
    // 1. Kiểm tra quyền xem tường nhà
    const canView = await this.canViewUserWall(currentUserId, targetUserId);
    if (!canView) {
      throw new ApiError(403, 'You do not have permission to view this user\'s posts');
    }

    // 2. Xây dựng query
    const query: any = {
      author: new Types.ObjectId(targetUserId),
      deletedAt: null, // Chỉ lấy posts chưa bị xóa
    };

    // 3. Nếu có cursor, thêm điều kiện lọc bài viết cũ hơn cursor
    if (cursor) {
      try {
        const cursorDate = new Date(cursor);
        query.createdAt = { $lt: cursorDate };
      } catch (error) {
        // Nếu cursor không hợp lệ, bỏ qua
        console.warn('Invalid cursor format:', cursor);
      }
    }

    // 4. Lấy posts với cursor pagination (lấy thêm 1 để kiểm tra hasMore)
    const posts = await Post.find(query)
      .select('_id author imageUrl caption location visibility reactionCount commentCount reactionCounts viewers createdAt updatedAt')
      .populate('author', 'username displayName avatarUrl') // Populate thông tin tác giả
      .sort({ createdAt: -1 }) // Sắp xếp giảm dần (mới nhất lên đầu)
      .limit(limit + 1) // Lấy thêm 1 để kiểm tra hasMore
      .lean();

    // 5. Kiểm tra hasMore
    const hasMore = posts.length > limit;
    const postsToReturn = hasMore ? posts.slice(0, limit) : posts;

    // 6. Tính nextCursor
    let nextCursor: string | null = null;
    if (hasMore && postsToReturn.length > 0) {
      const lastPost = postsToReturn[postsToReturn.length - 1];
      if (lastPost.createdAt) {
        nextCursor = new Date(lastPost.createdAt).toISOString();
      }
    }

    return {
      data: postsToReturn as unknown as IPost[],
      pagination: {
        nextCursor,
        hasMore,
      },
    };
  }
}

// Export instance để sử dụng
export const postService = new PostService();

