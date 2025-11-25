import { Subscription, ISubscription } from '../models/subscription.model';
import { Invoice } from '../models/invoice.model';
import { Plan, IPlan, BillingInterval } from '../models/plan.model';
import { ApiError } from '../utils/apiResponse';
import { Types } from 'mongoose';
import { recordInvoicePaid } from './revenue.event-driven';

/**
 * Tính số ngày dựa trên interval và intervalCount
 */
function calculateDurationInDays(interval: BillingInterval, intervalCount: number): number {
  const daysPerInterval: Record<BillingInterval, number> = {
    day: 1,
    week: 7,
    month: 30,
    year: 365,
  };

  return daysPerInterval[interval] * intervalCount;
}

class SubscriptionService {
  /**
   * Tạo subscription tức thì (bỏ qua thanh toán)
   * @param userId - ID của user
   * @param planId - ID của plan
   * @returns Object chứa subscription và invoice đã tạo
   * @throws ApiError nếu validation thất bại
   */
  async createInstantSubscription(userId: string, planId: string) {
    // Cho phép user có nhiều subscription active cùng lúc
    // Không cần kiểm tra subscription active hiện có

    // Tìm Plan
    const plan = await Plan.findById(planId);
    if (!plan) {
      throw new ApiError(404, 'Plan not found');
    }

    if (!plan.isActive) {
      throw new ApiError(400, 'Plan is not active');
    }

    // Tính toán thời gian
    const startDate = new Date();
    const durationInDays = calculateDurationInDays(plan.interval, plan.intervalCount);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + durationInDays);

    // Tạo Subscription trước (vì Invoice cần subscriptionId)
    // Tạo externalSubscriptionId unique cho manual subscription để tránh lỗi duplicate key
    const externalSubscriptionId = `manual_${userId}_${Date.now()}`;

    const subscription = await Subscription.create({
      user: new Types.ObjectId(userId),
      plan: new Types.ObjectId(planId),
      status: 'active',
      startAt: startDate,
      currentPeriodStart: startDate,
      currentPeriodEnd: endDate,
      cancelAtPeriodEnd: false,
      autoRenew: false, // Không tự động gia hạn vì bỏ qua thanh toán
      provider: 'manual',
      externalSubscriptionId, // Set unique value để tránh duplicate key error
    });

    // Tạo Invoice với status 'paid'
    // Chỉ set externalInvoiceId và externalPaymentIntentId khi có giá trị (không set null)
    const invoiceData: any = {
      subscription: subscription._id,
      user: new Types.ObjectId(userId),
      amount: plan.price, // Giữ tương thích
      currency: plan.currency,
      subtotalAmount: plan.price,
      discountAmount: 0,
      taxAmount: 0,
      providerFeeAmount: 0,
      platformFeeAmount: 0,
      grossAmount: plan.price,
      netAmount: plan.price,
      status: 'paid',
      periodStart: startDate,
      periodEnd: endDate,
      provider: 'manual',
      paidAt: startDate,
    };

    // Không set externalInvoiceId và externalPaymentIntentId cho manual provider
    // Để field là undefined thay vì null, tránh lỗi duplicate key với sparse index

    const invoice = await Invoice.create(invoiceData);

    // Cập nhật latestInvoice cho subscription
    subscription.latestInvoice = invoice._id as Types.ObjectId;
    await subscription.save();

    // Ghi nhận invoice paid vào revenue snapshot (event-driven)
    await recordInvoicePaid(invoice._id as Types.ObjectId);

    return {
      subscription,
      invoice,
    };
  }
}

export const subscriptionService = new SubscriptionService();

