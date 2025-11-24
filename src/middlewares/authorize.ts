import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { ApiError } from '../utils/apiResponse';

/**
 * Middleware kiểm tra quyền truy cập dựa trên danh sách role bắt buộc.
 * Sử dụng sau requireAuth để đảm bảo req.user đã tồn tại.
 */
export function authorize(requiredRoles: string[]) {
  return function authorizeMiddleware(req: AuthRequest, _res: Response, next: NextFunction) {
    const user = req.user;

    if (!user) {
      return next(new ApiError(401, 'Unauthorized'));
    }

    const userRoles: string[] = Array.isArray((user as any).roles)
      ? ((user as any).roles as string[])
      : ((user as any).role ? [(user as any).role as string] : []);

    const hasPermission = userRoles.some((role) => requiredRoles.includes(role));

    if (!hasPermission) {
      return next(new ApiError(403, 'Access Denied: Insufficient permissions'));
    }

    next();
  };
}

