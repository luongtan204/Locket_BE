import { Request, Response } from 'express';
import { Refund } from '../models/refund.model';
import { buildCrud } from '../utils/crudFactory';
import { refundService } from '../services/refund.service';
import { ok, ApiError } from '../utils/apiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { AuthRequest } from '../middlewares/auth.middleware';

export const { list, getById, create, updateById, removeById } = buildCrud(Refund);

/**
 * Người dùng gửi yêu cầu hoàn tiền
 * POST /api/refunds
 * Body: { invoiceId: string, reason: string }
 * Yêu cầu: Authentication (userId từ req.user)
 */
export const submitRefund = asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as unknown as AuthRequest;

  if (!authReq.userId) {
    throw new ApiError(401, 'Unauthorized');
  }

  const { invoiceId, reason } = req.body as { invoiceId: string; reason: string };

  // Validation
  if (!invoiceId || typeof invoiceId !== 'string' || invoiceId.trim() === '') {
    throw new ApiError(400, 'InvoiceId is required and must be a non-empty string');
  }

  if (!reason || typeof reason !== 'string' || reason.trim() === '') {
    throw new ApiError(400, 'Reason is required and must be a non-empty string');
  }

  if (reason.length > 1000) {
    throw new ApiError(400, 'Reason must be less than 1000 characters');
  }

  // Tạo refund request
  const refund = await refundService.submitRefundRequest(
    authReq.userId,
    invoiceId.trim(),
    reason.trim()
  );

  return res.status(201).json(ok({ refund }, 'Refund request submitted successfully'));
});
