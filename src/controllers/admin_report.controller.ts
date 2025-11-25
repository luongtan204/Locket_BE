import { Response, NextFunction, Request } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { reportService } from '../services/report.service';
import { adEventService } from '../services/ad_event.service';
import { ApiError, ok } from '../utils/apiResponse';

class AdminReportController {
  /**
   * Lấy báo cáo doanh thu
   * GET /api/v1/admin/reports/revenue?startDate=2024-01-01&endDate=2024-01-31
   */
  async getRevenueReport(req: Request, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate } = req.query;

      // Validation
      if (!startDate || typeof startDate !== 'string') {
        return next(new ApiError(400, 'StartDate is required and must be a string (format: YYYY-MM-DD)'));
      }

      if (!endDate || typeof endDate !== 'string') {
        return next(new ApiError(400, 'EndDate is required and must be a string (format: YYYY-MM-DD)'));
      }

      // Parse dates
      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

      // Validate date format
      if (isNaN(start.getTime())) {
        return next(new ApiError(400, 'Invalid startDate format. Expected format: YYYY-MM-DD'));
      }

      if (isNaN(end.getTime())) {
        return next(new ApiError(400, 'Invalid endDate format. Expected format: YYYY-MM-DD'));
      }

      // Set time to start and end of day
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);

      // Validate date range (max 365 days)
      const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff > 365) {
        return next(new ApiError(400, 'Date range cannot exceed 365 days'));
      }

      // Get revenue summary
      const revenueSummary = await reportService.getDailyRevenueSummary(start, end);

      res.json(ok(revenueSummary, 'Revenue report retrieved successfully'));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Lấy báo cáo hiệu suất quảng cáo
   * GET /api/v1/admin/reports/ad_performance?adId=xxx&startDate=2024-01-01&endDate=2024-01-31
   */
  async getPerformanceReport(req: Request, res: Response, next: NextFunction) {
    try {
      const { adId, startDate, endDate } = req.query;

      // Validation
      if (!adId || typeof adId !== 'string') {
        return next(new ApiError(400, 'AdId is required and must be a string'));
      }

      if (!startDate || typeof startDate !== 'string') {
        return next(new ApiError(400, 'StartDate is required and must be a string (format: YYYY-MM-DD)'));
      }

      if (!endDate || typeof endDate !== 'string') {
        return next(new ApiError(400, 'EndDate is required and must be a string (format: YYYY-MM-DD)'));
      }

      // Parse dates
      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

      // Validate date format
      if (isNaN(start.getTime())) {
        return next(new ApiError(400, 'Invalid startDate format. Expected format: YYYY-MM-DD'));
      }

      if (isNaN(end.getTime())) {
        return next(new ApiError(400, 'Invalid endDate format. Expected format: YYYY-MM-DD'));
      }

      // Validate date range (max 365 days)
      const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff > 365) {
        return next(new ApiError(400, 'Date range cannot exceed 365 days'));
      }

      // Get ad performance report
      const performanceReport = await adEventService.getAdPerformanceReport(adId as string, start, end);

      res.json(ok(performanceReport, 'Ad performance report retrieved successfully'));
    } catch (error) {
      next(error);
    }
  }
}

export const adminReportController = new AdminReportController();

