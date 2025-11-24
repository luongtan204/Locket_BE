import { RecapVideo, IRecapVideo } from '../models/recap_video.model';
import { Post } from '../models/post.model';
import { User } from '../models/user.model';
import { Types } from 'mongoose';
import { ApiError } from '../utils/apiResponse';

/**
 * Class RecapService - Xử lý logic tạo video tổng kết (Recap Video)
 */
export class RecapService {
  /**
   * Tạo video tổng kết cho tháng trước của một user
   * @param userId - ID của user
   * @param targetMonth - Tháng cần tạo recap (default: tháng trước)
   * @param targetYear - Năm cần tạo recap (default: năm hiện tại hoặc năm trước)
   */
  async generateRecapVideo(
    userId: string,
    targetMonth?: number,
    targetYear?: number
  ): Promise<IRecapVideo> {
    const now = new Date();
    // Tính tháng trước (getMonth() trả về 0-11)
    const lastMonth = now.getMonth() === 0 ? 12 : now.getMonth();
    const lastYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    
    const month = targetMonth || lastMonth;
    const year = targetYear || lastYear;

    // Kiểm tra xem đã có recap video cho tháng này chưa
    const existingRecap = await RecapVideo.findOne({
      user: new Types.ObjectId(userId),
      month,
      year,
    });

    if (existingRecap) {
      // Nếu đã có nhưng chưa processed, trả về để xử lý lại
      if (!existingRecap.isProcessed) {
        return existingRecap;
      }
      throw new ApiError(409, `Recap video for ${month}/${year} already exists`);
    }

    // Tính toán khoảng thời gian của tháng trước
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    // Tìm tất cả posts của user trong tháng đó
    const posts = await Post.find({
      author: new Types.ObjectId(userId),
      createdAt: {
        $gte: startDate,
        $lte: endDate,
      },
      deletedAt: null,
    })
      .sort({ createdAt: -1 })
      .limit(30) // Giới hạn 30 posts để tạo video
      .select('_id imageUrl createdAt')
      .lean();

    if (posts.length === 0) {
      throw new ApiError(404, `No posts found for ${month}/${year}`);
    }

    // Tạo recap video record (chưa processed)
    const recapVideo = await RecapVideo.create({
      user: new Types.ObjectId(userId),
      month,
      year,
      postIds: posts.map((post) => post._id),
      isProcessed: false,
      processedAt: null,
    });

    // Giả lập xử lý video (background job sẽ xử lý sau)
    // Ở đây ta chỉ tạo record, video sẽ được tạo bởi background job
    console.log(`[RecapService] Created recap video record for user ${userId}, ${month}/${year} with ${posts.length} posts`);

    return recapVideo;
  }

  /**
   * Xử lý tạo video (giả lập)
   * Background job sẽ gọi hàm này để tạo video thực tế
   * @param recapVideoId - ID của recap video cần xử lý
   */
  async processRecapVideo(recapVideoId: string): Promise<IRecapVideo> {
    const recapVideo = await RecapVideo.findById(recapVideoId).populate('postIds');

    if (!recapVideo) {
      throw new ApiError(404, 'Recap video not found');
    }

    if (recapVideo.isProcessed) {
      return recapVideo;
    }

    // Giả lập tạo video từ các posts
    // Trong thực tế, đây sẽ gọi service tạo video (FFmpeg, video processing service, etc.)
    console.log(`[RecapService] Processing video for recap ${recapVideoId}...`);
    console.log(`  User: ${recapVideo.user}`);
    console.log(`  Posts: ${recapVideo.postIds.length}`);

    // Giả lập URL video và thumbnail (trong thực tế sẽ upload lên Cloudinary/S3)
    const videoUrl = `https://example.com/recaps/${recapVideoId}.mp4`;
    const thumbnailUrl = `https://example.com/recaps/${recapVideoId}_thumb.jpg`;

    // Cập nhật trạng thái
    recapVideo.videoUrl = videoUrl;
    recapVideo.thumbnailUrl = thumbnailUrl;
    recapVideo.isProcessed = true;
    recapVideo.processedAt = new Date();
    await recapVideo.save();

    console.log(`[RecapService] Video processed successfully: ${videoUrl}`);

    return recapVideo;
  }

  /**
   * Tìm tất cả recap videos chưa được xử lý
   * Background job sẽ query này để xử lý
   */
  async getUnprocessedRecapVideos(limit: number = 10): Promise<IRecapVideo[]> {
    const videos = await RecapVideo.find({
      isProcessed: false,
      createdAt: { $lte: new Date() }, // Chỉ lấy những video đã được tạo
    })
      .sort({ createdAt: 1 }) // Xử lý theo thứ tự tạo
      .limit(limit)
      .lean();
    
    return videos as unknown as IRecapVideo[];
  }

  /**
   * Tạo recap video cho tất cả users có posts trong tháng trước
   * Background job sẽ gọi hàm này định kỳ
   */
  async generateRecapVideosForAllUsers(): Promise<{ processed: number; errors: number }> {
    const now = new Date();
    const lastMonth = now.getMonth() === 0 ? 12 : now.getMonth();
    const lastYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

    const startDate = new Date(lastYear, lastMonth - 1, 1);
    const endDate = new Date(lastYear, lastMonth, 0, 23, 59, 59, 999);

    // Tìm tất cả users có posts trong tháng trước
    const usersWithPosts = await Post.distinct('author', {
      createdAt: {
        $gte: startDate,
        $lte: endDate,
      },
      deletedAt: null,
    });

    let processed = 0;
    let errors = 0;

    for (const userId of usersWithPosts) {
      try {
        await this.generateRecapVideo(userId.toString(), lastMonth, lastYear);
        processed++;
      } catch (error: any) {
        // Bỏ qua lỗi nếu đã tồn tại
        if (error.statusCode !== 409) {
          console.error(`[RecapService] Error generating recap for user ${userId}:`, error.message);
          errors++;
        }
      }
    }

    console.log(`[RecapService] Generated ${processed} recap videos, ${errors} errors`);

    return { processed, errors };
  }
}

// Export instance để sử dụng
export const recapService = new RecapService();

