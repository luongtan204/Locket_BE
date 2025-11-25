import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { planService } from '../services/plan.service';
import { auditService } from '../services/audit.service';
import { Plan } from '../models/plan.model';
import { ApiError, ok } from '../utils/apiResponse';
import { BillingInterval } from '../models/plan.model';

class AdminPlanController {
  /**
   * Lấy danh sách tất cả Plans cho Admin
   * GET /api/admin/plans
   */
  async getPlans(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const plans = await planService.getAllPlans();
      res.json(ok({ plans }, 'Plans retrieved successfully'));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Tạo Plan mới
   * POST /api/v1/admin/plans
   * Body: {
   *   code: string (required, unique),
   *   name: string (required),
   *   description?: string,
   *   price: number (required),
   *   currency?: string (default: 'VND'),
   *   interval: 'day' | 'week' | 'month' | 'year' (required),
   *   intervalCount?: number (default: 1, min: 1),
   *   trialDays?: number (default: 0),
   *   features?: Record<string, any>,
   *   isActive?: boolean (default: true),
   *   providerMetadata?: Record<string, any>
   * }
   */
  async createPlan(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const actingUserId = req.user?._id?.toString();

      if (!actingUserId) {
        return next(new ApiError(401, 'Missing admin context'));
      }

      // Validate dữ liệu đầu vào
      const {
        code,
        name,
        description,
        price,
        currency,
        interval,
        intervalCount,
        trialDays,
        features,
        isActive,
        providerMetadata,
      } = req.body;

      // Validation các trường bắt buộc
      if (!code || typeof code !== 'string' || code.trim() === '') {
        return next(new ApiError(400, 'Code is required and must be a non-empty string'));
      }

      if (!name || typeof name !== 'string' || name.trim() === '') {
        return next(new ApiError(400, 'Name is required and must be a non-empty string'));
      }

      if (price === undefined || price === null || typeof price !== 'number' || price < 0) {
        return next(new ApiError(400, 'Price is required and must be a non-negative number'));
      }

      if (!interval || !['day', 'week', 'month', 'year'].includes(interval)) {
        return next(new ApiError(400, 'Interval is required and must be one of: day, week, month, year'));
      }

      // Validation các trường optional
      if (intervalCount !== undefined && (typeof intervalCount !== 'number' || intervalCount < 1)) {
        return next(new ApiError(400, 'IntervalCount must be a number >= 1'));
      }

      if (trialDays !== undefined && (typeof trialDays !== 'number' || trialDays < 0)) {
        return next(new ApiError(400, 'TrialDays must be a non-negative number'));
      }

      if (currency !== undefined && typeof currency !== 'string') {
        return next(new ApiError(400, 'Currency must be a string'));
      }

      if (isActive !== undefined && typeof isActive !== 'boolean') {
        return next(new ApiError(400, 'IsActive must be a boolean'));
      }

      // Tạo Plan
      const newPlan = await planService.createPlan({
        code: code.trim(),
        name: name.trim(),
        description: description?.trim(),
        price,
        currency,
        interval: interval as BillingInterval,
        intervalCount,
        trialDays,
        features,
        isActive,
        providerMetadata,
      });

      // Ghi log audit sau khi tạo Plan thành công
      await auditService.logAdminAction(
        actingUserId,
        'CREATE',
        'PLAN',
        newPlan._id.toString(),
        {
          description: `Create new plan: ${newPlan.name} (${newPlan.code})`,
          planData: {
            code: newPlan.code,
            name: newPlan.name,
            price: newPlan.price,
            currency: newPlan.currency,
            interval: newPlan.interval,
            intervalCount: newPlan.intervalCount,
          },
        }
      );

      res.status(201).json(ok({ plan: newPlan }, 'Plan created successfully'));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Cập nhật Plan
   * PUT /api/v1/admin/plans/:planId
   * Body: Tương tự Create Plan nhưng tất cả các trường đều optional
   */
  async updatePlan(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { planId } = req.params;
      const actingUserId = req.user?._id?.toString();

      if (!actingUserId) {
        return next(new ApiError(401, 'Missing admin context'));
      }

      // Lấy Plan hiện tại để log audit (trước khi update)
      const currentPlan = await Plan.findById(planId).lean();
      if (!currentPlan) {
        return next(new ApiError(404, 'Plan not found'));
      }

      // Validate dữ liệu đầu vào
      const {
        code,
        name,
        description,
        price,
        currency,
        interval,
        intervalCount,
        trialDays,
        features,
        isActive,
        providerMetadata,
      } = req.body;

      // Validation các trường optional
      if (code !== undefined && (typeof code !== 'string' || code.trim() === '')) {
        return next(new ApiError(400, 'Code must be a non-empty string if provided'));
      }

      if (name !== undefined && (typeof name !== 'string' || name.trim() === '')) {
        return next(new ApiError(400, 'Name must be a non-empty string if provided'));
      }

      if (price !== undefined && (typeof price !== 'number' || price < 0)) {
        return next(new ApiError(400, 'Price must be a non-negative number if provided'));
      }

      if (interval !== undefined && !['day', 'week', 'month', 'year'].includes(interval)) {
        return next(new ApiError(400, 'Interval must be one of: day, week, month, year'));
      }

      if (intervalCount !== undefined && (typeof intervalCount !== 'number' || intervalCount < 1)) {
        return next(new ApiError(400, 'IntervalCount must be a number >= 1'));
      }

      if (trialDays !== undefined && (typeof trialDays !== 'number' || trialDays < 0)) {
        return next(new ApiError(400, 'TrialDays must be a non-negative number'));
      }

      if (currency !== undefined && typeof currency !== 'string') {
        return next(new ApiError(400, 'Currency must be a string'));
      }

      if (isActive !== undefined && typeof isActive !== 'boolean') {
        return next(new ApiError(400, 'IsActive must be a boolean'));
      }

      // Cập nhật Plan
      const updatedPlan = await planService.updatePlan(planId, {
        code: code?.trim(),
        name: name?.trim(),
        description: description?.trim(),
        price,
        currency,
        interval: interval as BillingInterval,
        intervalCount,
        trialDays,
        features,
        isActive,
        providerMetadata,
      });

      // Ghi log audit sau khi cập nhật thành công
      await auditService.logAdminAction(
        actingUserId,
        'UPDATE',
        'PLAN',
        planId,
        {
          description: `Update plan: ${updatedPlan.name} (${updatedPlan.code})`,
          before: {
            code: currentPlan.code,
            name: currentPlan.name,
            price: currentPlan.price,
            currency: currentPlan.currency,
            interval: currentPlan.interval,
            intervalCount: currentPlan.intervalCount,
            isActive: currentPlan.isActive,
          },
          after: {
            code: updatedPlan.code,
            name: updatedPlan.name,
            price: updatedPlan.price,
            currency: updatedPlan.currency,
            interval: updatedPlan.interval,
            intervalCount: updatedPlan.intervalCount,
            isActive: updatedPlan.isActive,
          },
        }
      );

      res.json(ok({ plan: updatedPlan }, 'Plan updated successfully'));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Vô hiệu hóa Plan (soft delete - set isActive: false)
   * DELETE /api/v1/admin/plans/:planId
   */
  async deactivatePlan(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { planId } = req.params;
      const actingUserId = req.user?._id?.toString();

      if (!actingUserId) {
        return next(new ApiError(401, 'Missing admin context'));
      }

      // Lấy Plan hiện tại để log audit (trước khi deactivate)
      const currentPlan = await Plan.findById(planId).lean();
      if (!currentPlan) {
        return next(new ApiError(404, 'Plan not found'));
      }

      // Vô hiệu hóa Plan (set isActive: false)
      const deactivatedPlan = await planService.deactivatePlan(planId);

      // Ghi log audit sau khi vô hiệu hóa thành công
      await auditService.logAdminAction(
        actingUserId,
        'UPDATE',
        'PLAN',
        planId,
        {
          description: `Deactivate plan: ${deactivatedPlan.name} (${deactivatedPlan.code})`,
          before: {
            isActive: currentPlan.isActive,
            code: currentPlan.code,
            name: currentPlan.name,
          },
          after: {
            isActive: deactivatedPlan.isActive,
            code: deactivatedPlan.code,
            name: deactivatedPlan.name,
          },
        }
      );

      res.json(ok({ plan: deactivatedPlan }, 'Plan deactivated successfully'));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Kích hoạt lại Plan (set isActive: true)
   * PUT /api/v1/admin/plans/:planId/activate
   */
  async activatePlan(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { planId } = req.params;
      const actingUserId = req.user?._id?.toString();

      if (!actingUserId) {
        return next(new ApiError(401, 'Missing admin context'));
      }

      // Lấy Plan hiện tại để log audit (trước khi activate)
      const currentPlan = await Plan.findById(planId).lean();
      if (!currentPlan) {
        return next(new ApiError(404, 'Plan not found'));
      }

      // Kích hoạt Plan (set isActive: true)
      const activatedPlan = await planService.activatePlan(planId);

      // Ghi log audit sau khi kích hoạt thành công
      await auditService.logAdminAction(
        actingUserId,
        'UPDATE',
        'PLAN',
        planId,
        {
          description: `Activate plan: ${activatedPlan.name} (${activatedPlan.code})`,
          before: {
            isActive: currentPlan.isActive,
            code: currentPlan.code,
            name: currentPlan.name,
          },
          after: {
            isActive: activatedPlan.isActive,
            code: activatedPlan.code,
            name: activatedPlan.name,
          },
        }
      );

      res.json(ok({ plan: activatedPlan }, 'Plan activated successfully'));
    } catch (error) {
      next(error);
    }
  }
}

export const adminPlanController = new AdminPlanController();

