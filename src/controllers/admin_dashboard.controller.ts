import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { dashboardService } from '../services/dashboard.service';
import { ok } from '../utils/apiResponse';

class AdminDashboardController {
  /**
   * Lấy tổng hợp các chỉ số KPI cho dashboard
   * GET /api/admin/dashboard/summary
   */
  async getSummary(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const summary = await dashboardService.getDashboardSummary();
      res.json(ok(summary, 'Dashboard summary retrieved successfully'));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Lấy doanh thu hàng ngày
   * GET /api/admin/dashboard/daily-revenue
   * Query: ?days=30
   */
  async getDailyRevenue(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const dailyRevenue = await dashboardService.getDailyRevenue(days);
      res.json(ok({ dailyRevenue }, 'Daily revenue retrieved successfully'));
    } catch (error) {
      next(error);
    }
  }
}

export const adminDashboardController = new AdminDashboardController();

