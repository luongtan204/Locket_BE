import mongoose, { Schema, Document, Types } from 'mongoose';

export type PricingModel = 'CPM' | 'CPC' | 'FLAT';
export type CampaignStatus = 'draft' | 'active' | 'paused' | 'ended';

export interface IAdCampaign extends Document {
  ad: Types.ObjectId;          // creative
  advertiser?: Types.ObjectId | null; // nhà quảng cáo (user) nếu có
  pricingModel: PricingModel;

  currency: string;            // đơn vị thanh toán
  cpmRate?: number | null;     // tiền cho 1000 impressions
  cpcRate?: number | null;     // tiền cho 1 click
  flatTotal?: number | null;   // tổng tiền flat cho toàn chiến dịch

  budgetTotal?: number | null; // ngân sách tối đa
  dailyCapImpressions?: number | null;
  dailyCapClicks?: number | null;

  startAt?: Date | null;
  endAt?: Date | null;
  status: CampaignStatus;

  // Thống kê gộp
  impressionCount: number;
  clickCount: number;
  spendAmount: number;   // tổng tiền phải trả theo pricing
  createdAt: Date;
  updatedAt: Date;
}

const AdCampaignSchema = new Schema<IAdCampaign>(
  {
    ad: { type: Schema.Types.ObjectId, ref: 'Ad', required: true, index: true },
    advertiser: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    pricingModel: { type: String, enum: ['CPM', 'CPC', 'FLAT'], required: true },
    currency: { type: String, required: true, default: 'VND' },
    cpmRate: { type: Number, default: null },
    cpcRate: { type: Number, default: null },
    flatTotal: { type: Number, default: null },
    budgetTotal: { type: Number, default: null },
    dailyCapImpressions: { type: Number, default: null },
    dailyCapClicks: { type: Number, default: null },
    startAt: { type: Date, default: null, index: true },
    endAt: { type: Date, default: null, index: true },
    status: { type: String, enum: ['draft', 'active', 'paused', 'ended'], default: 'draft', index: true },
    impressionCount: { type: Number, default: 0 },
    clickCount: { type: Number, default: 0 },
    spendAmount: { type: Number, default: 0, index: true },
  },
  { timestamps: true }
);

AdCampaignSchema.index({ status: 1, startAt: 1, endAt: 1 });
AdCampaignSchema.index({ advertiser: 1, createdAt: -1 });

export const AdCampaign = mongoose.model<IAdCampaign>('AdCampaign', AdCampaignSchema);