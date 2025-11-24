import { RevenueSnapshotDaily } from '../models/revenue_snapshot_daily.model';
import { buildCrud } from '../utils/crudFactory';

export const { list, getById, create, updateById, removeById } = buildCrud(RevenueSnapshotDaily);
