import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { refundService } from '../services/refund.service';
import { auditService } from '../services/audit.service';
import { Refund } from '../models/refund.model';
import { ApiError, ok } from '../utils/apiResponse';

class AdminRefundController {
  /**
   * Lấy danh sách pending refunds
   * GET /api/admin/refunds/pending
   */
  async getPendingRefunds(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await refundService.getRefunds({ status: 'PENDING' }, 1, 100);
      res.json(ok({ refunds: result.items }, 'Pending refunds retrieved successfully'));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Xử lý refund: phê duyệt hoặc từ chối
   * PUT /api/admin/refunds/:refundId/process
   * Body: {
   *   status: 'APPROVED' | 'REJECTED' (required),
   *   externalRefundId?: string (optional) - ID refund từ payment provider
   * }
   */
  async handleRefund(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { refundId } = req.params;
      const actingUserId = req.user?._id?.toString();

      if (!actingUserId) {
        return next(new ApiError(401, 'Missing admin context'));
      }

      // Validate dữ liệu đầu vào
      const { status, adminNote, externalRefundId } = req.body;

      // Validation status
      if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
        return next(
          new ApiError(400, "Status is required and must be either 'APPROVED' or 'REJECTED'")
        );
      }

      // Validation adminNote (nếu có)
      if (adminNote !== undefined && (typeof adminNote !== 'string')) {
        return next(new ApiError(400, 'AdminNote must be a string if provided'));
      }

      // Validation externalRefundId (nếu có)
      if (externalRefundId !== undefined && (typeof externalRefundId !== 'string' || externalRefundId.trim() === '')) {
        return next(new ApiError(400, 'ExternalRefundId must be a non-empty string if provided'));
      }

      // Lấy refund hiện tại để log audit (trước khi update)
      const currentRefund = await Refund.findById(refundId).lean();
      
      if (!currentRefund) {
        return next(new ApiError(404, 'Refund not found'));
      }

      // Xử lý refund
      const updatedRefund = await refundService.processRefund(
        refundId,
        status,
        actingUserId,
        adminNote?.trim(),
        externalRefundId?.trim()
      );

      // Ghi log audit sau khi xử lý thành công
      await auditService.logAdminAction(
        actingUserId,
        'UPDATE',
        'REFUND',
        refundId,
        {
          description: `${status === 'APPROVED' ? 'Approve' : 'Reject'} refund ${refundId}`,
          before: {
            status: currentRefund.status,
            processedByAdminId: currentRefund.processedByAdminId?.toString() || null,
            refundedAt: currentRefund.refundedAt || null,
          },
          after: {
            status: updatedRefund.status,
            processedByAdminId: updatedRefund.processedByAdminId?.toString(),
            refundedAt: updatedRefund.refundedAt || null,
            externalRefundId: updatedRefund.externalRefundId || null,
          },
          refundData: {
            amount: updatedRefund.amount,
            currency: updatedRefund.currency,
            invoiceId: updatedRefund.invoiceId.toString(),
            userId: updatedRefund.userId.toString(),
            provider: updatedRefund.provider,
            adminNote: updatedRefund.adminNote || null,
          },
        }
      );

      res.json(
        ok(
          { refund: updatedRefund },
          `Refund ${status === 'APPROVED' ? 'approved' : 'rejected'} successfully`
        )
      );
    } catch (error) {
      next(error);
    }
  }
}

export const adminRefundController = new AdminRefundController();
