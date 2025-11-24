import { Model, isValidObjectId } from 'mongoose';
import { Request, Response } from 'express';
import { asyncHandler } from './asyncHandler';
import { ApiError, ok } from './apiResponse';

export function buildCrud<T extends { _id: any }>(ModelCls: Model<T>) {
  const list = asyncHandler(async (req: Request, res: Response) => {
    const page = Math.max(parseInt((req.query.page as string) || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt((req.query.limit as string) || '20', 10), 1), 100);
    const skip = (page - 1) * limit;
    const filter: Record<string, any> = {};
    // Optional: pass-through simple filters via query
    // e.g., /?author=... or /?status=active
    Object.keys(req.query).forEach((k) => {
      if (!['page', 'limit'].includes(k)) filter[k] = req.query[k as keyof typeof req.query];
    });

    const [items, total] = await Promise.all([
      ModelCls.find(filter as any).skip(skip).limit(limit).lean(),
      ModelCls.countDocuments(filter as any),
    ]);
    return res.json(ok({ items, page, limit, total }));
  });

  const getById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!isValidObjectId(id)) throw new ApiError(400, 'Invalid id');
    const doc = await ModelCls.findById(id).lean();
    if (!doc) throw new ApiError(404, 'Not found');
    return res.json(ok(doc));
  });

  const create = asyncHandler(async (req: Request, res: Response) => {
    const created = await ModelCls.create(req.body);
    return res.status(201).json(ok(created));
  });

  const updateById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!isValidObjectId(id)) throw new ApiError(400, 'Invalid id');
    const updated = await ModelCls.findByIdAndUpdate(id, req.body, { new: true });
    if (!updated) throw new ApiError(404, 'Not found');
    return res.json(ok(updated));
  });

  const removeById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!isValidObjectId(id)) throw new ApiError(400, 'Invalid id');
    const deleted = await ModelCls.findByIdAndDelete(id);
    if (!deleted) throw new ApiError(404, 'Not found');
    return res.json(ok({ id }));
  });

  return { list, getById, create, updateById, removeById };
}
