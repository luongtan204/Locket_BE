import { Refund, IRefund, RefundStatus } from '../models/refund.model';
import { Invoice } from '../models/invoice.model';
import { Subscription } from '../models/subscription.model';
import { ApiError } from '../utils/apiResponse';
import { Types } from 'mongoose';
import { recordRefundSucceeded } from './revenue.event-driven';

/**
 * Service xử lý hoàn tiền (Refund)
 */
class RefundService {
  /**
   * Người dùng gửi yêu cầu hoàn tiền
   * @param userId - ID của user yêu cầu hoàn tiền
   * @param invoiceId - ID của invoice cần hoàn tiền
   * @param reason - Lý do người dùng yêu cầu hoàn tiền
   * @returns Refund đã được tạo
   * @throws ApiError nếu validation thất bại
   */
  async submitRefundRequest(userId: string, invoiceId: string, reason: string): Promise<IRefund> {
    // Tìm invoice và kiểm tra thuộc về user
    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      throw new ApiError(404, 'Invoice not found');
    }

    // Kiểm tra invoice có thuộc về userId không
    if (invoice.user.toString() !== userId) {
      throw new ApiError(403, 'Invoice does not belong to this user');
    }

    // Kiểm tra invoice đã được thanh toán chưa
    if (invoice.status !== 'paid') {
      throw new ApiError(400, 'Invoice must be paid before requesting refund');
    }

    // Kiểm tra chưa có yêu cầu Refund PENDING nào cho hóa đơn này
    const existingRefund = await Refund.findOne({
      invoiceId: new Types.ObjectId(invoiceId),
      status: 'PENDING',
    });

    if (existingRefund) {
      throw new ApiError(400, 'A pending refund request already exists for this invoice');
    }

    // Tạo bản ghi Refund mới với status: 'PENDING'
    try {
      const refund = await Refund.create({
        userId: new Types.ObjectId(userId),
        invoiceId: new Types.ObjectId(invoiceId),
        amount: invoice.grossAmount || invoice.amount, // Sử dụng grossAmount nếu có, fallback về amount
        currency: invoice.currency,
        reasonByUser: reason.trim(),
        status: 'PENDING',
        provider: invoice.provider || 'manual',
      });

      return refund;
    } catch (error: any) {
      // Handle unique constraint error (invoiceId đã tồn tại)
      if (error.code === 11000 && error.keyPattern?.invoiceId) {
        throw new ApiError(
          400,
          'A refund request already exists for this invoice. Each invoice can only have one refund request.'
        );
      }
      throw error;
    }
  }
  /**
   * Xử lý refund: phê duyệt hoặc từ chối
   * @param refundId - ID của refund cần xử lý
   * @param status - Trạng thái mới: 'APPROVED' hoặc 'REJECTED'
   * @param adminId - ID của admin xử lý
   * @param externalRefundId - ID refund từ payment provider (nếu có)
   * @returns Refund đã được cập nhật
   * @throws ApiError nếu validation thất bại
   */
  async processRefund(
    refundId: string,
    status: 'APPROVED' | 'REJECTED',
    adminId: string,
    adminNote?: string,
    externalRefundId?: string
  ): Promise<IRefund> {
    // Tìm refund
    const refund = await Refund.findById(refundId);
    if (!refund) {
      throw new ApiError(404, 'Refund not found');
    }

    // Kiểm tra refund đã được xử lý chưa
    if (refund.status !== 'PENDING') {
      throw new ApiError(400, `Refund has already been processed. Current status: ${refund.status}`);
    }

    // Status đã đúng format (APPROVED hoặc REJECTED)
    const dbStatus: RefundStatus = status;

    // Cập nhật refund
    const updateData: any = {
      status: dbStatus,
      processedByAdminId: new Types.ObjectId(adminId),
    };

    // Thêm adminNote nếu có
    if (adminNote !== undefined && adminNote !== null) {
      updateData.adminNote = adminNote.trim();
    }

    // Nếu APPROVED, set refundedAt và externalRefundId (nếu có)
    if (status === 'APPROVED') {
      updateData.refundedAt = new Date();
      if (externalRefundId) {
        updateData.externalRefundId = externalRefundId;
      }

      // Tìm Invoice liên quan đến Refund
      const invoice = await Invoice.findById(refund.invoiceId);
      if (!invoice) {
        throw new ApiError(404, 'Invoice not found for this refund');
      }

      // Tìm Subscription liên quan đến Invoice và cập nhật status thành 'canceled'
      if (invoice.subscription) {
        const subscription = await Subscription.findById(invoice.subscription);
        if (subscription) {
          // Cập nhật subscription status thành 'canceled'
          subscription.status = 'canceled';
          subscription.canceledAt = new Date();
          subscription.cancelAtPeriodEnd = false;
          subscription.autoRenew = false;
          await subscription.save();
        }
      }

      // Ghi nhận refund vào revenue snapshot (event-driven)
      // Lưu ý: Cần gọi sau khi update để có refundedAt
      const updatedRefund = await Refund.findByIdAndUpdate(refundId, updateData, { new: true });
      if (!updatedRefund) {
        throw new ApiError(500, 'Failed to update refund');
      }

      // Ghi nhận refund thành công vào revenue (chỉ khi APPROVED)
      await recordRefundSucceeded(updatedRefund._id);

      // TODO: Gọi API payment provider để thực hiện hoàn tiền thực tế
      // Ví dụ:
      // if (refund.provider === 'stripe') {
      //   await this.processStripeRefund(refund, externalRefundId);
      // } else if (refund.provider === 'vnpay') {
      //   await this.processVNPayRefund(refund, externalRefundId);
      // }
      // Lưu ý: Nếu API provider thất bại, có thể cần rollback status

      return updatedRefund;
    } else {
      // REJECTED - chỉ cập nhật status
      const updatedRefund = await Refund.findByIdAndUpdate(refundId, updateData, { new: true });
      if (!updatedRefund) {
        throw new ApiError(500, 'Failed to update refund');
      }
      return updatedRefund;
    }
  }

  /**
   * Lấy danh sách refunds với filter
   * @param filters - Object chứa các filter: status, userId, invoiceId
   * @param page - Số trang (default: 1)
   * @param limit - Số lượng items mỗi trang (default: 20)
   * @returns Danh sách refunds với pagination info
   */
  async getRefunds(
    filters: {
      status?: RefundStatus;
      userId?: string;
      invoiceId?: string;
    } = {},
    page: number = 1,
    limit: number = 20
  ) {
    const query: Record<string, any> = {};

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.userId) {
      query.userId = new Types.ObjectId(filters.userId);
    }

    if (filters.invoiceId) {
      query.invoiceId = new Types.ObjectId(filters.invoiceId);
    }

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      Refund.find(query)
        .populate('userId', 'username displayName email')
        .populate('invoiceId', 'amount currency status')
        .populate('processedByAdminId', 'username displayName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Refund.countDocuments(query),
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

export const refundService = new RefundService();

