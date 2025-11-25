import { Request, Response } from 'express';
import { Plan } from '../models/plan.model';
import { buildCrud } from '../utils/crudFactory';
import { planService } from '../services/plan.service';
import { ok } from '../utils/apiResponse';
import { asyncHandler } from '../utils/asyncHandler';

export const { list, getById, create, updateById, removeById } = buildCrud(Plan);

/**
 * Lấy danh sách các Plan công khai (đang hoạt động)
 * GET /api/plans
 * Không cần authentication
 */
export const getPublicPlans = asyncHandler(async (req: Request, res: Response) => {
  const plans = await planService.getAvailablePlans();
  return res.json(ok({ plans }, 'Available plans retrieved successfully'));
});
