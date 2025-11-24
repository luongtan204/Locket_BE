import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/apiResponse';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res
      .status(err.statusCode)
      .json({ success: false, message: err.message, details: err.details });
  }
  // eslint-disable-next-line no-console
  console.error(err);
  return res.status(500).json({ success: false, message: 'Internal Server Error' });
}
