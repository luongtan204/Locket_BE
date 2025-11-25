import { RevenueSnapshotDaily } from '../models/revenue_snapshot_daily.model';
import { Invoice } from '../models/invoice.model';
import { ApiError } from '../utils/apiResponse';

/**
 * Service xử lý báo cáo
 */
class ReportService {
  /**
   * Lấy tổng hợp doanh thu theo ngày trong khoảng thời gian
   * @param startDate - Ngày bắt đầu
   * @param endDate - Ngày kết thúc
   * @returns Tổng hợp doanh thu và số đơn hàng
   */
  async getDailyRevenueSummary(startDate: Date, endDate: Date) {
    // Validate dates
    if (startDate > endDate) {
      throw new ApiError(400, 'Start date must be before or equal to end date');
    }

    // Format dates to yyyy-mm-dd (UTC)
    const formatDate = (date: Date): string => {
      return date.toISOString().slice(0, 10);
    };

    const startDay = formatDate(startDate);
    const endDay = formatDate(endDate);

    // Truy vấn RevenueSnapshotDaily trong khoảng thời gian
    const revenueSnapshots = await RevenueSnapshotDaily.find({
      day: { $gte: startDay, $lte: endDay },
    }).sort({ day: 1 }).lean();

    // Tính tổng doanh thu
    const totalRevenue = revenueSnapshots.reduce((sum, snapshot) => {
      // Doanh thu ròng = subsNet + adsRevenue - refunds
      const dailyRevenue = snapshot.subsNet + snapshot.adsRevenue - (snapshot.refunds || 0);
      return sum + dailyRevenue;
    }, 0);

    // Tính tổng doanh thu gộp (gross)
    const totalGrossRevenue = revenueSnapshots.reduce((sum, snapshot) => {
      return sum + snapshot.subsGross + snapshot.adsRevenue;
    }, 0);

    // Tính tổng refunds
    const totalRefunds = revenueSnapshots.reduce((sum, snapshot) => {
      return sum + (snapshot.refunds || 0);
    }, 0);

    // Truy vấn số đơn hàng đã thanh toán trong khoảng thời gian
    const invoiceCount = await Invoice.countDocuments({
      status: 'paid',
      paidAt: {
        $gte: startDate,
        $lte: new Date(endDate.getTime() + 24 * 60 * 60 * 1000 - 1), // End of day
      },
    });

    // Chi tiết theo ngày
    const dailyDetails = revenueSnapshots.map((snapshot) => ({
      day: snapshot.day,
      subsGross: snapshot.subsGross,
      subsNet: snapshot.subsNet,
      adsRevenue: snapshot.adsRevenue,
      refunds: snapshot.refunds || 0,
      totalRevenue: snapshot.subsNet + snapshot.adsRevenue - (snapshot.refunds || 0),
      currency: snapshot.currency,
    }));

    return {
      period: {
        startDate: startDay,
        endDate: endDay,
        days: revenueSnapshots.length,
      },
      summary: {
        totalGrossRevenue,
        totalNetRevenue: totalRevenue,
        totalRefunds,
        totalInvoices: invoiceCount,
        averageDailyRevenue: revenueSnapshots.length > 0 ? totalRevenue / revenueSnapshots.length : 0,
        currency: revenueSnapshots[0]?.currency || 'VND',
      },
      dailyDetails,
    };
  }
}

export const reportService = new ReportService();

