import mongoose, { Schema, Document } from 'mongoose';

export type BillingInterval = 'day' | 'week' | 'month' | 'year';

export interface IPlan extends Document {
  code: string; // mã gói nội bộ, ví dụ 'premium_monthly'
  name: string;
  description?: string;
  price: number; // đơn vị nhỏ nhất (vd VND)
  currency: string; // 'VND', 'USD'...
  interval: BillingInterval; // chu kỳ
  intervalCount: number; // ví dụ 1 month, hoặc 3 month
  trialDays?: number; // số ngày dùng thử
  features?: Record<string, any>; // cấu hình tính năng (limits/quyền)
  isActive: boolean;
  providerMetadata?: Record<string, any>; // mapping product/price id trên provider
  createdAt: Date;
  updatedAt: Date;
}

const PlanSchema = new Schema<IPlan>(
  {
    code: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    description: { type: String },
    price: { type: Number, required: true },
    currency: { type: String, required: true, default: 'VND' },
    interval: { type: String, enum: ['day', 'week', 'month', 'year'], required: true, default: 'month' },
    intervalCount: { type: Number, required: true, default: 1, min: 1 },
    trialDays: { type: Number, default: 0 },
    features: { type: Map, of: Schema.Types.Mixed, default: {} },
    isActive: { type: Boolean, default: true, index: true },
    providerMetadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

export const Plan = mongoose.model<IPlan>('Plan', PlanSchema);