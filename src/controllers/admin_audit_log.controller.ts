import { AdminAuditLog } from '../models/admin_audit_log.model';
import { buildCrud } from '../utils/crudFactory';

export const { list, getById, create, updateById, removeById } = buildCrud(AdminAuditLog);
