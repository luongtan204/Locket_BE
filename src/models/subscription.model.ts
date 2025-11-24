import mongoose, { Schema, Document, Types } from 'mongoose';

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'expired';

export interface ISubscription extends Document {
  user: Types.ObjectId;
  plan: Types.ObjectId;
  status: SubscriptionStatus;
  startAt: Date;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  canceledAt?: Date | null;
  autoRenew: boolean;
  provider?: 'stripe' | 'vnpay' | 'momo' | 'apple' | 'google' | 'manual';
  externalSubscriptionId?: string | null;
  latestInvoice?: Types.ObjectId | null;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionSchema = new Schema<ISubscription>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    plan: { type: Schema.Types.ObjectId, ref: 'Plan', required: true, index: true },
    status: {
      type: String,
      enum: ['trialing', 'active', 'past_due', 'canceled', 'expired'],
      required: true,
      index: true,
    },
    startAt: { type: Date, required: true, default: () => new Date() },
    currentPeriodStart: { type: Date, required: true, index: true },
    currentPeriodEnd: { type: Date, required: true, index: true },
    cancelAtPeriodEnd: { type: Boolean, default: false },
    canceledAt: { type: Date, default: null },
    autoRenew: { type: Boolean, default: true, index: true },
    provider: { type: String, enum: ['stripe', 'vnpay', 'momo', 'apple', 'google', 'manual'], default: 'manual' },
    externalSubscriptionId: { type: String, default: null, sparse: true, unique: true },
    latestInvoice: { type: Schema.Types.ObjectId, ref: 'Invoice', default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

// Một user có thể có nhiều subscription lịch sử, nhưng chỉ 1 active tại một thời điểm tuỳ policy.
// Dễ truy vấn các sub gần hết hạn:
SubscriptionSchema.index({ user: 1, status: 1, currentPeriodEnd: 1 });

export const Subscription = mongoose.model<ISubscription>('Subscription', SubscriptionSchema);