import { Request, Response } from 'express';
import { Subscription } from '../models/subscription.model';
import { buildCrud } from '../utils/crudFactory';
import { subscriptionService } from '../services/subscription.service';
import { ok, ApiError } from '../utils/apiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { AuthRequest } from '../middlewares/auth.middleware';

export const { list, getById, create, updateById, removeById } = buildCrud(Subscription);

/**
 * Mua gói tức thì (bỏ qua thanh toán)
 * POST /api/subscriptions/purchase
 * Body: { planId: string }
 * Yêu cầu: Authentication (userId từ req.user)
 */
export const handleInstantPurchase = asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as unknown as AuthRequest;

  if (!authReq.userId) {
    throw new ApiError(401, 'Unauthorized');
  }

  const { planId } = req.body as { planId: string };

  // Validation
  if (!planId || typeof planId !== 'string' || planId.trim() === '') {
    throw new ApiError(400, 'PlanId is required and must be a non-empty string');
  }

  // Tạo subscription và invoice
  const result = await subscriptionService.createInstantSubscription(authReq.userId, planId.trim());

  return res.status(201).json(
    ok(
      {
        subscription: result.subscription,
        invoice: result.invoice,
      },
      'Subscription created successfully'
    )
  );
});
