import mongoose, { Schema, Document, Types } from 'mongoose';

export type AdEventType = 'impression' | 'click';

export interface IAdEvent extends Document {
  campaign: Types.ObjectId;
  ad: Types.ObjectId;
  user?: Types.ObjectId | null; // người xem/nhấp (nếu có)
  type: AdEventType;
  at: Date;
  createdAt: Date;
}

const AdEventSchema = new Schema<IAdEvent>(
  {
    campaign: { type: Schema.Types.ObjectId, ref: 'AdCampaign', required: true, index: true },
    ad: { type: Schema.Types.ObjectId, ref: 'Ad', required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    type: { type: String, enum: ['impression', 'click'], required: true, index: true },
    at: { type: Date, required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Tùy quy mô, có thể đặt TTL 60 ngày để giảm dung lượng log
// AdEventSchema.index({ at: 1 }, { expireAfterSeconds: 60 * 24 * 60 * 60 });

AdEventSchema.index({ campaign: 1, type: 1, at: 1 });

export const AdEvent = mongoose.model<IAdEvent>('AdEvent', AdEventSchema);