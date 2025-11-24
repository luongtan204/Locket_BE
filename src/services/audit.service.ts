import { AdminAuditLog, AdminActionType, TargetResource } from '../models/admin_audit_log.model';
import { Types, isValidObjectId } from 'mongoose';
import { ApiError } from '../utils/apiResponse';

/**
 * Service để ghi log và quản lý audit logs của admin
 */
class AuditService {
  /**
   * Ghi log hành động quản trị
   * @param adminId - ID của admin thực hiện hành động
   * @param actionType - Loại hành động: 'CREATE', 'UPDATE', 'DELETE', 'BAN'
   * @param targetResource - Loại tài nguyên: 'USER', 'POST', 'SUBSCRIPTION'
   * @param targetId - ID của tài nguyên bị ảnh hưởng
   * @param details - JSON object chứa thông tin trước/sau thay đổi
   * @throws ApiError nếu validation thất bại
   */
  async logAdminAction(
    adminId: string,
    actionType: AdminActionType,
    targetResource: TargetResource,
    targetId: string,
    details: Record<string, any> = {}
  ): Promise<void> {
    // Validation
    if (!isValidObjectId(adminId)) {
      throw new ApiError(400, 'Invalid adminId');
    }

    if (!targetId || targetId.trim() === '') {
      throw new ApiError(400, 'targetId is required');
    }

    try {
      const payload = {
        adminId: new Types.ObjectId(adminId),
        actionType,
        targetResource,
        targetId: targetId.trim(),
        details: typeof details === 'object' ? details : {},
      };

      await AdminAuditLog.create(payload);
    } catch (error: any) {
      // Log error nhưng không throw để không làm gián đoạn flow chính
      console.error('Failed to log admin action:', error);
      // Có thể throw nếu muốn đảm bảo audit log luôn được ghi
      // throw new ApiError(500, 'Failed to log admin action');
    }
  }

  /**
   * Lấy danh sách audit logs với filter và pagination
   * @param filters - Object chứa các filter: adminId, actionType, targetResource, targetId
   * @param page - Số trang (default: 1)
   * @param limit - Số lượng items mỗi trang (default: 20)
   * @returns Danh sách audit logs với pagination info
   */
  async getAuditLogs(
    filters: {
      adminId?: string;
      actionType?: AdminActionType;
      targetResource?: TargetResource;
      targetId?: string;
    } = {},
    page: number = 1,
    limit: number = 20
  ) {
    const query: Record<string, any> = {};

    if (filters.adminId && isValidObjectId(filters.adminId)) {
      query.adminId = new Types.ObjectId(filters.adminId);
    }

    if (filters.actionType) {
      query.actionType = filters.actionType;
    }

    if (filters.targetResource) {
      query.targetResource = filters.targetResource;
    }

    if (filters.targetId) {
      query.targetId = filters.targetId.trim();
    }

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      AdminAuditLog.find(query)
        .populate('adminId', 'username displayName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AdminAuditLog.countDocuments(query),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

export const auditService = new AuditService();

