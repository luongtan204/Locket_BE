import { User } from '../models/user.model';
import { Post } from '../models/post.model';
import { Refund } from '../models/refund.model';
import { Ad } from '../models/ad.model';
import { Invoice } from '../models/invoice.model';
import { RevenueSnapshotDaily } from '../models/revenue_snapshot_daily.model';

/**
 * Service xử lý dashboard summary cho Admin
 */
class DashboardService {
  /**
   * Lấy tổng hợp các chỉ số KPI cho dashboard
   * @returns Object chứa các KPI metrics
   */
  async getDashboardSummary() {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);

    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    const twentyFourHoursAgo = new Date(now);
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    // 1. Tổng số người dùng
    const totalUsers = await User.countDocuments({});

    // 2. Người dùng mới trong 7 ngày
    const newUsersLast7Days = await User.countDocuments({
      createdAt: { $gte: sevenDaysAgo },
    });

    // 3. Doanh thu tháng này (từ invoices paid, trừ refunds)
    const monthInvoices = await Invoice.find({
      status: 'paid',
      paidAt: { $gte: startOfMonth, $lte: endOfMonth },
    }).lean();

    const monthRevenue = monthInvoices.reduce((sum, inv) => {
      return sum + (inv.netAmount || inv.grossAmount || inv.amount || 0);
    }, 0);

    // Tổng refunds trong tháng
    const monthRefunds = await Refund.find({
      status: 'APPROVED',
      refundedAt: { $gte: startOfMonth, $lte: endOfMonth },
    }).lean();

    const totalRefunds = monthRefunds.reduce((sum, rf) => sum + (rf.amount || 0), 0);
    const netRevenue = Math.max(0, monthRevenue - totalRefunds);

    // 4. Số bài đăng mới trong 24h và tổng số bài đăng
    const postsLast24h = await Post.countDocuments({
      createdAt: { $gte: twentyFourHoursAgo },
      deletedAt: null,
    });

    const totalPosts = await Post.countDocuments({
      deletedAt: null,
    });

    // 5. Yêu cầu hoàn tiền đang chờ
    const pendingRefunds = await Refund.countDocuments({
      status: 'PENDING',
    });

    // 6. Quảng cáo đang chạy (ACTIVE và chưa hết hạn)
    const activeAds = await Ad.countDocuments({
      isActive: true,
      $and: [
        {
          $or: [
            { endAt: null },
            { endAt: { $gte: now } },
          ],
        },
        {
          $or: [
            { startAt: null },
            { startAt: { $lte: now } },
          ],
        },
      ],
    });

    // Tính toán thay đổi (nếu có thể)
    const previous7DaysStart = new Date(sevenDaysAgo);
    previous7DaysStart.setDate(previous7DaysStart.getDate() - 7);
    
    const previous7DaysUsers = await User.countDocuments({
      createdAt: { $gte: previous7DaysStart, $lt: sevenDaysAgo },
    });

    const userGrowthRate = previous7DaysUsers > 0
      ? ((newUsersLast7Days - previous7DaysUsers) / previous7DaysUsers) * 100
      : newUsersLast7Days > 0 ? 100 : 0;

    return {
      users: {
        total: totalUsers,
        newLast7Days: newUsersLast7Days,
        growthRate: Number(userGrowthRate.toFixed(2)),
      },
      revenue: {
        thisMonth: netRevenue,
        refundsThisMonth: totalRefunds,
        currency: 'VND',
      },
      posts: {
        last24h: postsLast24h,
        total: totalPosts,
      },
      refunds: {
        pending: pendingRefunds,
      },
      ads: {
        active: activeAds,
      },
    };
  }

  /**
   * Lấy doanh thu hàng ngày trong N ngày gần nhất
   * @param days - Số ngày (default: 30)
   * @returns Array chứa doanh thu theo ngày
   */
  async getDailyRevenue(days: number = 30) {
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // Lấy tất cả snapshots trong khoảng thời gian
    const snapshots = await RevenueSnapshotDaily.find({
      day: {
        $gte: startDate.toISOString().slice(0, 10),
        $lte: endDate.toISOString().slice(0, 10),
      },
    })
      .sort({ day: 1 })
      .lean();

    // Lấy daily post count cho mỗi ngày
    const dailyPosts = await Promise.all(
      snapshots.map(async (snap: any) => {
        const dayStart = new Date(snap.day);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(snap.day);
        dayEnd.setHours(23, 59, 59, 999);
        
        const postCount = await Post.countDocuments({
          createdAt: { $gte: dayStart, $lte: dayEnd },
          deletedAt: null,
        });
        
        return { day: snap.day, postCount };
      })
    );

    const postCountMap = new Map(dailyPosts.map(p => [p.day, p.postCount]));

    // Transform để frontend dễ sử dụng
    return snapshots.map((snap: any) => ({
      date: snap.day,
      revenue: (snap.subsNet || 0) + (snap.adsRevenue || 0) - (snap.refunds || 0),
      subsRevenue: snap.subsNet || 0,
      adsRevenue: snap.adsRevenue || 0,
      refunds: snap.refunds || 0,
      dau: snap.dau || 0, // Daily Active Users
      posts: postCountMap.get(snap.day) || 0, // Daily Post Count
    }));
  }
}

export const dashboardService = new DashboardService();

