import { AdCampaign } from '../models/ad_campaign.model';
import { buildCrud } from '../utils/crudFactory';

export const { list, getById, create, updateById, removeById } = buildCrud(AdCampaign);
