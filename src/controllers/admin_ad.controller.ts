import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { adService } from '../services/ad.service';
import { auditService } from '../services/audit.service';
import { Ad } from '../models/ad.model';
import { ApiError, ok } from '../utils/apiResponse';
import { AdPlacement } from '../models/ad.model';

class AdminAdController {
  /**
   * Lấy danh sách tất cả quảng cáo
   * GET /api/admin/ads
   */
  async getAds(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ads = await adService.getAllAds();
      res.json(ok({ ads }, 'Ads retrieved successfully'));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Tạo quảng cáo mới
   * POST /api/v1/admin/ads
   * Body: {
   *   name: string (required),
   *   placement: 'feed' | 'splash' | 'banner' (required),
   *   imageUrl: string (required),
   *   title?: string,
   *   description?: string,
   *   ctaText?: string,
   *   ctaUrl?: string,
   *   priority?: number (default: 0),
   *   isActive?: boolean (default: true),
   *   startAt?: Date | null,
   *   endAt?: Date | null
   * }
   */
  async createAd(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const actingUserId = req.user?._id?.toString();

      if (!actingUserId) {
        return next(new ApiError(401, 'Missing admin context'));
      }

      // Validate dữ liệu đầu vào
      const {
        name,
        placement,
        imageUrl,
        title,
        description,
        ctaText,
        ctaUrl,
        priority,
        isActive,
        startAt,
        endAt,
      } = req.body;

      // Validation các trường bắt buộc
      if (!name || typeof name !== 'string' || name.trim() === '') {
        return next(new ApiError(400, 'Name is required and must be a non-empty string'));
      }

      if (!placement || !['feed', 'splash', 'banner'].includes(placement)) {
        return next(new ApiError(400, 'Placement is required and must be one of: feed, splash, banner'));
      }

      if (!imageUrl || typeof imageUrl !== 'string' || imageUrl.trim() === '') {
        return next(new ApiError(400, 'ImageUrl is required and must be a non-empty string'));
      }

      // Validation các trường optional
      if (priority !== undefined && (typeof priority !== 'number' || priority < 0)) {
        return next(new ApiError(400, 'Priority must be a non-negative number'));
      }

      if (isActive !== undefined && typeof isActive !== 'boolean') {
        return next(new ApiError(400, 'IsActive must be a boolean'));
      }

      // Validate dates
      let parsedStartAt: Date | null = null;
      let parsedEndAt: Date | null = null;

      if (startAt !== undefined && startAt !== null) {
        parsedStartAt = new Date(startAt);
        if (isNaN(parsedStartAt.getTime())) {
          return next(new ApiError(400, 'Invalid startAt date format'));
        }
      }

      if (endAt !== undefined && endAt !== null) {
        parsedEndAt = new Date(endAt);
        if (isNaN(parsedEndAt.getTime())) {
          return next(new ApiError(400, 'Invalid endAt date format'));
        }
      }

      // Validate date range
      if (parsedStartAt && parsedEndAt && parsedStartAt > parsedEndAt) {
        return next(new ApiError(400, 'StartAt must be before or equal to endAt'));
      }

      // Tạo quảng cáo
      const newAd = await adService.createAd(
        {
          name,
          placement: placement as AdPlacement,
          imageUrl,
          title,
          description,
          ctaText,
          ctaUrl,
          priority,
          isActive,
          startAt: parsedStartAt,
          endAt: parsedEndAt,
        },
        actingUserId
      );

      // Ghi log audit sau khi tạo thành công
      await auditService.logAdminAction(
        actingUserId,
        'CREATE',
        'AD',
        newAd._id.toString(),
        {
          description: `Create new ad: ${newAd.name} (placement: ${newAd.placement})`,
          adData: {
            name: newAd.name,
            placement: newAd.placement,
            imageUrl: newAd.imageUrl,
            priority: newAd.priority,
            isActive: newAd.isActive,
            startAt: newAd.startAt || null,
            endAt: newAd.endAt || null,
          },
        }
      );

      res.status(201).json(ok({ ad: newAd }, 'Ad created successfully'));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Cập nhật toàn bộ thông tin quảng cáo
   * PUT /api/v1/admin/ads/:adId
   * Body: {
   *   name?: string,
   *   placement?: 'feed' | 'splash' | 'banner',
   *   imageUrl?: string,
   *   title?: string,
   *   description?: string,
   *   ctaText?: string,
   *   ctaUrl?: string,
   *   targetUrl?: string, // Alias for ctaUrl
   *   priority?: number,
   *   isActive?: boolean,
   *   status?: 'ACTIVE' | 'PAUSED', // Map to isActive
   *   startAt?: Date | null,
   *   endAt?: Date | null
   * }
   */
  async updateAd(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { adId } = req.params;
      const actingUserId = req.user?._id?.toString();

      if (!actingUserId) {
        return next(new ApiError(401, 'Missing admin context'));
      }

      // Lấy quảng cáo hiện tại để log audit (trước khi update)
      const currentAd = await Ad.findById(adId).lean();
      if (!currentAd) {
        return next(new ApiError(404, 'Ad not found'));
      }

      // Cập nhật quảng cáo
      const updatedAd = await adService.updateAd(adId, req.body, actingUserId);

      // Ghi log audit sau khi cập nhật thành công
      await auditService.logAdminAction(
        actingUserId,
        'UPDATE',
        'AD',
        adId,
        {
          description: `Update ad: ${updatedAd.name}`,
          before: {
            name: currentAd.name,
            placement: currentAd.placement,
            isActive: currentAd.isActive,
            priority: currentAd.priority,
          },
          after: {
            name: updatedAd.name,
            placement: updatedAd.placement,
            isActive: updatedAd.isActive,
            priority: updatedAd.priority,
          },
        }
      );

      res.json(ok({ ad: updatedAd }, 'Ad updated successfully'));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Cập nhật trạng thái quảng cáo (ACTIVE hoặc PAUSED)
   * PUT /api/v1/admin/ads/:adId/status
   * Body: {
   *   status: 'ACTIVE' | 'PAUSED' (required)
   * }
   */
  async updateAdStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { adId } = req.params;
      const actingUserId = req.user?._id?.toString();

      if (!actingUserId) {
        return next(new ApiError(401, 'Missing admin context'));
      }

      // Lấy quảng cáo hiện tại để log audit (trước khi update)
      const currentAd = await Ad.findById(adId).lean();
      if (!currentAd) {
        return next(new ApiError(404, 'Ad not found'));
      }

      // Validate dữ liệu đầu vào
      const { status } = req.body;

      if (!status || !['ACTIVE', 'PAUSED'].includes(status)) {
        return next(new ApiError(400, "Status is required and must be either 'ACTIVE' or 'PAUSED'"));
      }

      // Cập nhật trạng thái
      const updatedAd = await adService.updateAdStatus(adId, status, actingUserId);

      // Ghi log audit sau khi cập nhật thành công
      await auditService.logAdminAction(
        actingUserId,
        'UPDATE',
        'AD',
        adId,
        {
          description: `${status === 'ACTIVE' ? 'Activate' : 'Pause'} ad: ${updatedAd.name}`,
          before: {
            isActive: currentAd.isActive,
            name: currentAd.name,
            placement: currentAd.placement,
          },
          after: {
            isActive: updatedAd.isActive,
            name: updatedAd.name,
            placement: updatedAd.placement,
          },
        }
      );

      res.json(ok({ ad: updatedAd }, `Ad ${status === 'ACTIVE' ? 'activated' : 'paused'} successfully`));
    } catch (error) {
      next(error);
    }
  }
}

export const adminAdController = new AdminAdController();

