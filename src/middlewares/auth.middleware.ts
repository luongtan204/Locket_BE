import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { ApiError } from '../utils/apiResponse';
import { User, IUser } from '../models/user.model';

export interface AuthRequest extends Request {
  userId?: string;
  user?: IUser;
}

export async function requireAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next(new ApiError(401, 'Missing or invalid Authorization header'));
  const token = header.split(' ')[1];
  try {
    const payload = jwt.verify(token, env.JWT_SECRET as jwt.Secret) as any;
    const userId = payload.sub as string;
    
    // Tìm user trong database
    const user = await User.findById(userId);
    if (!user) {
      return next(new ApiError(401, 'User not found'));
    }
    
    req.userId = userId;
    req.user = user;
    next();
  } catch {
    next(new ApiError(401, 'Invalid or expired token'));
  }
}
