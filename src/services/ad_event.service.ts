import { AdEvent } from '../models/ad_event.model';
import { Ad } from '../models/ad.model';
import { ApiError } from '../utils/apiResponse';
import { Types } from 'mongoose';

/**
 * Service xử lý báo cáo hiệu suất quảng cáo
 */
class AdEventService {
  /**
   * Lấy báo cáo hiệu suất quảng cáo
   * @param adId - ID của quảng cáo
   * @param startDate - Ngày bắt đầu
   * @param endDate - Ngày kết thúc
   * @returns Báo cáo hiệu suất với impression, click, CTR
   */
  async getAdPerformanceReport(adId: string, startDate: Date, endDate: Date) {
    // Validate dates
    if (startDate > endDate) {
      throw new ApiError(400, 'Start date must be before or equal to end date');
    }

    // Kiểm tra ad có tồn tại không
    const ad = await Ad.findById(adId);
    if (!ad) {
      throw new ApiError(404, 'Ad not found');
    }

    // Set time to start and end of day
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // Truy vấn tổng số impression
    const impressionCount = await AdEvent.countDocuments({
      ad: new Types.ObjectId(adId),
      type: 'impression',
      at: {
        $gte: start,
        $lte: end,
      },
    });

    // Truy vấn tổng số click
    const clickCount = await AdEvent.countDocuments({
      ad: new Types.ObjectId(adId),
      type: 'click',
      at: {
        $gte: start,
        $lte: end,
      },
    });

    // Tính CTR (Click-Through Rate) = (Clicks / Impressions) * 100
    const ctr = impressionCount > 0 ? (clickCount / impressionCount) * 100 : 0;

    // Lấy chi tiết theo ngày
    const dailyStats = await AdEvent.aggregate([
      {
        $match: {
          ad: new Types.ObjectId(adId),
          at: {
            $gte: start,
            $lte: end,
          },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$at' },
          },
          impressions: {
            $sum: { $cond: [{ $eq: ['$type', 'impression'] }, 1, 0] },
          },
          clicks: {
            $sum: { $cond: [{ $eq: ['$type', 'click'] }, 1, 0] },
          },
        },
      },
      {
        $project: {
          _id: 0,
          day: '$_id',
          impressions: 1,
          clicks: 1,
          ctr: {
            $cond: [
              { $gt: ['$impressions', 0] },
              { $multiply: [{ $divide: ['$clicks', '$impressions'] }, 100] },
              0,
            ],
          },
        },
      },
      {
        $sort: { day: 1 },
      },
    ]);

    return {
      ad: {
        _id: ad._id.toString(),
        name: ad.name,
        placement: ad.placement,
        imageUrl: ad.imageUrl,
      },
      period: {
        startDate: start.toISOString().slice(0, 10),
        endDate: end.toISOString().slice(0, 10),
        days: Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1,
      },
      summary: {
        totalImpressions: impressionCount,
        totalClicks: clickCount,
        ctr: Number(ctr.toFixed(2)), // Làm tròn 2 chữ số thập phân
      },
      dailyDetails: dailyStats,
    };
  }
}

export const adEventService = new AdEventService();

