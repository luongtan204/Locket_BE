import { Post, IPost } from '../models/post.model';
import { Friendship } from '../models/friendship.model';
import { Ad, IAd } from '../models/ad.model';
import { Types } from 'mongoose';
import { ApiError } from '../utils/apiResponse';

/**
 * Interface cho FeedItem - mỗi item có thể là post hoặc ad
 */
export interface FeedItem {
  type: 'post' | 'ad';
  data: IPost | IAd;
}

/**
 * Class FeedService - Xử lý business logic cho Feed
 */
export class FeedService {
  /**
   * Lấy feed của user với Cursor Pagination (Infinite Scroll)
   * @param userId - ID của user
   * @param isPremium - Trạng thái premium của user
   * @param limit - Số lượng items mỗi lần (default: 10)
   * @param cursor - Mốc thời gian (createdAt) của bài viết cuối cùng (optional)
   * @returns FeedItems với pagination info
   */
  async getFeedWithCursor(
    userId: string,
    isPremium: boolean,
    limit: number = 10,
    cursor?: string
  ): Promise<{
    data: FeedItem[];
    pagination: {
      nextCursor: string | null;
      hasMore: boolean;
    };
  }> {
    try {
      // 1. Lấy danh sách bạn bè: Truy vấn friendship.model để lấy danh sách ID của bạn bè (chỉ status: 'accepted')
      const friendships = await Friendship.find({
        $or: [
          { userA: new Types.ObjectId(userId), status: 'accepted' },
          { userB: new Types.ObjectId(userId), status: 'accepted' },
        ],
      });

      // Lấy danh sách friend IDs
      const friendIds = friendships.map((friendship) => {
        const userAId = friendship.userA.toString();
        const userBId = friendship.userB.toString();
        return userAId === userId ? userBId : userAId;
      });

      // Thêm chính user vào để xem bài viết của mình
      const authorIds = [...new Set([...friendIds, userId])];

      // 2. Xây dựng query với cursor pagination
      const query: any = {
        author: { $in: authorIds.map((id) => new Types.ObjectId(id)) },
        visibility: { $in: ['friends', 'private'] },
        deletedAt: null,
      };

      // Nếu có cursor, thêm điều kiện lọc bài viết cũ hơn cursor
      if (cursor) {
        try {
          const cursorDate = new Date(cursor);
          query.createdAt = { $lt: cursorDate };
        } catch (error) {
          // Nếu cursor không hợp lệ, bỏ qua
          console.warn('Invalid cursor format:', cursor);
        }
      }

      // 3. Lấy bài viết với cursor pagination
      // Lấy thêm 1 post để kiểm tra hasMore
      const posts = await Post.find(query)
        .select('_id author imageUrl caption location visibility reactionCount commentCount reactionCounts viewers createdAt updatedAt')
        .populate('author', 'username displayName avatarUrl') // Populate thông tin tác giả
        .sort({ createdAt: -1 }) // Sắp xếp giảm dần (mới nhất lên đầu)
        .limit(limit + 1) // Lấy thêm 1 để kiểm tra hasMore
        .lean();

      // 4. Kiểm tra hasMore (nếu lấy được nhiều hơn limit thì còn dữ liệu)
      const hasMore = posts.length > limit;
      const postsToProcess = hasMore ? posts.slice(0, limit) : posts;

      // Nếu không có bài viết nào
      if (postsToProcess.length === 0) {
        return {
          data: [],
          pagination: {
            nextCursor: null,
            hasMore: false,
          },
        };
      }

      // 5. Convert posts thành FeedItem
      let feedItems: FeedItem[] = postsToProcess.map((post) => ({
        type: 'post' as const,
        data: post as unknown as IPost,
      }));

      // 6. Logic chèn Quảng cáo (Monetization)
      if (!isPremium) {
        // Nếu isPremium là false: Query ad.model.ts để lấy một danh sách quảng cáo đang hoạt động
        const activeAds = await this.getActiveAds('feed');

        if (activeAds.length > 0) {
          // Chèn quảng cáo này vào mảng kết quả của Feed: Cứ sau 20 bài viết thì chèn 1 quảng cáo
          const adInterval = 20; // Cứ sau 20 posts thì chèn 1 ad
          const result: FeedItem[] = [];
          let adIndex = 0;

          for (let i = 0; i < feedItems.length; i++) {
            result.push(feedItems[i]);

            // Chèn ad sau mỗi 20 posts (index 19, 39, 59, ...)
            if ((i + 1) % adInterval === 0 && adIndex < activeAds.length) {
              const ad = activeAds[adIndex % activeAds.length];
              result.push({
                type: 'ad' as const,
                data: ad as unknown as IAd,
              });

              // Tăng impression count
              await Ad.findByIdAndUpdate(ad._id, {
                $inc: { impressionCount: 1 },
              });

              adIndex++;
            }
          }

          feedItems = result;
        }
      }

      // 7. Giới hạn số lượng items theo limit (sau khi chèn ads)
      const finalFeedItems = feedItems.slice(0, limit);

      // 8. Tính nextCursor (createdAt của post cuối cùng trong danh sách postsToProcess)
      let nextCursor: string | null = null;
      if (hasMore && postsToProcess.length > 0) {
        // Lấy createdAt của post cuối cùng để làm cursor cho lần gọi sau
        const lastPost = postsToProcess[postsToProcess.length - 1];
        if (lastPost.createdAt) {
          nextCursor = new Date(lastPost.createdAt).toISOString();
        }
      }

      return {
        data: finalFeedItems,
        pagination: {
          nextCursor,
          hasMore: hasMore && finalFeedItems.length >= limit,
        },
      };
    } catch (error) {
      console.error('Error in FeedService.getFeedWithCursor:', error);
      throw new ApiError(500, 'Failed to get feed');
    }
  }

  /**
   * Lấy feed của user (bài viết từ bạn bè + quảng cáo nếu không premium)
   * @deprecated Sử dụng getFeedWithCursor thay thế
   * @param userId - ID của user
   * @param isPremium - Trạng thái premium của user
   * @param page - Số trang (default: 1)
   * @param limit - Số lượng items mỗi trang (default: 20)
   * @returns Mảng FeedItem (post hoặc ad)
   */
  async getFeed(
    userId: string,
    isPremium: boolean,
    page: number = 1,
    limit: number = 20
  ): Promise<FeedItem[]> {
    // Deprecated: Sử dụng getFeedWithCursor thay thế
    // Implementation tạm thời để backward compatibility
    const result = await this.getFeedWithCursor(userId, isPremium, limit);
    return result.data;
  }

  /**
   * Lấy danh sách quảng cáo đang hoạt động cho placement
   * @param placement - Vị trí hiển thị quảng cáo
   * @returns Mảng quảng cáo đang active
   */
  private async getActiveAds(placement: 'feed' | 'splash' | 'banner'): Promise<IAd[]> {
    const now = new Date();

    // Query ads đang active (startAt <= now và endAt >= now hoặc null)
    const ads = await Ad.find({
      placement,
      isActive: true,
      $and: [
        {
          $or: [{ startAt: null }, { startAt: { $lte: now } }],
        },
        {
          $or: [{ endAt: null }, { endAt: { $gte: now } }],
        },
      ],
    })
      .sort({ priority: -1, createdAt: -1 })
      .limit(10)
      .lean();

    return ads as unknown as IAd[];
  }
}

// Export instance để sử dụng
export const feedService = new FeedService();

