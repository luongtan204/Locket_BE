import mongoose, { Schema, Document } from 'mongoose';

export interface IRevenueSnapshotDaily extends Document {
  day: string;          // yyyy-mm-dd (UTC)
  currency: string;     // tiền tệ gốc sau quy đổi (ví dụ 'VND')

  // Subscription
  subsGross: number;
  subsNet: number;
  subsTax: number;
  subsProviderFees: number;
  subsPlatformFees: number;
  refunds: number;      // số tiền refund trong ngày (giảm doanh thu)

  // Ads (ước tính dựa trên pricing)
  adsRevenue: number;
  impressions: number;
  clicks: number;
  ctr: number;          // clicks / impressions

  // Core metrics
  dau: number;          // Daily Active Users
  mau: number;          // 30-day MAU (tại ngày này)
  arpu: number;         // (subsNet + adsRevenue) / DAU
  arpdaus?: number;     // nếu muốn phân chia theo nguồn

  // Subscription metrics
  activeSubscribers: number;
  newSubscribers: number;       // số sub bắt đầu trong ngày
  canceledSubscribers: number;  // số sub hủy trong ngày
  churnRate: number;            // canceled / active_prev_day
  mrr: number;                  // Monthly Recurring Revenue (ước tính)
  arr: number;                  // Annualized (mrr * 12)

  createdAt: Date;
  updatedAt: Date;
}

const RevenueSnapshotDailySchema = new Schema<IRevenueSnapshotDaily>(
  {
    day: { type: String, required: true, index: true },
    currency: { type: String, required: true, default: 'VND' },

    subsGross: { type: Number, required: true, default: 0 },
    subsNet: { type: Number, required: true, default: 0, index: true },
    subsTax: { type: Number, required: true, default: 0 },
    subsProviderFees: { type: Number, required: true, default: 0 },
    subsPlatformFees: { type: Number, required: true, default: 0 },
    refunds: { type: Number, required: true, default: 0 },

    adsRevenue: { type: Number, required: true, default: 0 },
    impressions: { type: Number, required: true, default: 0 },
    clicks: { type: Number, required: true, default: 0 },
    ctr: { type: Number, required: true, default: 0 },

    dau: { type: Number, required: true, default: 0 },
    mau: { type: Number, required: true, default: 0 },
    arpu: { type: Number, required: true, default: 0 },

    activeSubscribers: { type: Number, required: true, default: 0 },
    newSubscribers: { type: Number, required: true, default: 0 },
    canceledSubscribers: { type: Number, required: true, default: 0 },
    churnRate: { type: Number, required: true, default: 0 },
    mrr: { type: Number, required: true, default: 0 },
    arr: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

RevenueSnapshotDailySchema.index({ day: 1 }, { unique: true });
RevenueSnapshotDailySchema.index({ createdAt: -1 });

export const RevenueSnapshotDaily = mongoose.model<IRevenueSnapshotDaily>('RevenueSnapshotDaily', RevenueSnapshotDailySchema);