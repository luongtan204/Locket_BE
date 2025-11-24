import { AdEvent } from '../models/ad_event.model';
import { buildCrud } from '../utils/crudFactory';

export const { list, getById, create, updateById, removeById } = buildCrud(AdEvent);
