import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { adminUserService } from '../services/admin_user.service';
import { auditService } from '../services/audit.service';
import { ApiError, ok } from '../utils/apiResponse';

class AdminUserController {
  async banUser(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;
      const actingUserId = req.user?._id?.toString();

      if (!actingUserId) {
        return next(new ApiError(401, 'Missing admin context'));
      }

      const bannedUser = await adminUserService.banUserById(userId);

      await auditService.logAdminAction(
        actingUserId,
        'BAN',
        'USER',
        bannedUser._id.toString(),
        {
          description: `Ban user ${userId} by admin`,
          before: { isActive: true },
          after: { isActive: false },
        }
      );

      res.json(ok({ user: bannedUser }, 'User banned successfully'));
    } catch (error) {
      next(error);
    }
  }

  async unbanUser(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;
      const actingUserId = req.user?._id?.toString();

      if (!actingUserId) {
        return next(new ApiError(401, 'Missing admin context'));
      }

      const unbannedUser = await adminUserService.unbanUserById(userId);

      await auditService.logAdminAction(
        actingUserId,
        'UPDATE',
        'USER',
        unbannedUser._id.toString(),
        {
          description: `Unban user ${userId} by admin`,
          before: { isActive: false },
          after: { isActive: true },
        }
      );

      res.json(ok({ user: unbannedUser }, 'User unbanned successfully'));
    } catch (error) {
      next(error);
    }
  }
}

export const adminUserController = new AdminUserController();

