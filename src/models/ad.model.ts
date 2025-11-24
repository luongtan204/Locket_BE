import mongoose, { Schema, Document, Types } from 'mongoose';

export type AdPlacement = 'feed' | 'splash' | 'banner';

export interface IAd extends Document {
  name: string; // tên nội bộ cho admin
  placement: AdPlacement; // vị trí hiển thị
  imageUrl: string; // ảnh quảng cáo (đơn giản)
  title?: string;
  description?: string;
  ctaText?: string;
  ctaUrl?: string; // link mở khi click
  priority?: number; // độ ưu tiên hiển thị, số càng lớn càng ưu tiên
  isActive: boolean;

  // Lịch chạy (đơn giản, có thể để trống để chạy ngay)
  startAt?: Date | null;
  endAt?: Date | null;

  // Thống kê cơ bản (optional)
  impressionCount: number;
  clickCount: number;

  // Dấu vết quản trị
  createdBy?: Types.ObjectId | null;
  updatedBy?: Types.ObjectId | null;

  createdAt: Date;
  updatedAt: Date;
}

const AdSchema = new Schema<IAd>(
  {
    name: { type: String, required: true, trim: true },
    placement: { type: String, enum: ['feed', 'splash', 'banner'], required: true, index: true },
    imageUrl: { type: String, required: true },
    title: { type: String },
    description: { type: String },
    ctaText: { type: String },
    ctaUrl: { type: String },
    priority: { type: Number, default: 0, index: true },
    isActive: { type: Boolean, default: true, index: true },
    startAt: { type: Date, default: null, index: true },
    endAt: { type: Date, default: null, index: true },
    impressionCount: { type: Number, default: 0 },
    clickCount: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

// Truy vấn nhanh các quảng cáo đang hoạt động theo placement, thời gian
AdSchema.index({ placement: 1, isActive: 1, startAt: 1, endAt: 1 });
AdSchema.index({ createdAt: -1 });

export const Ad = mongoose.model<IAd>('Ad', AdSchema);