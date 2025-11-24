import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IRecapVideo extends Document {
  user: Types.ObjectId;
  month: number; // 1-12
  year: number;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  postIds: Types.ObjectId[]; // Danh sách posts được chọn cho video
  isProcessed: boolean; // Trạng thái xử lý
  processedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const RecapVideoSchema = new Schema<IRecapVideo>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true, index: true },
    videoUrl: { type: String, default: null },
    thumbnailUrl: { type: String, default: null },
    postIds: [{ type: Schema.Types.ObjectId, ref: 'Post' }],
    isProcessed: { type: Boolean, default: false, index: true },
    processedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Index để tìm recap video theo user, month, year
RecapVideoSchema.index({ user: 1, year: 1, month: 1 }, { unique: true });
RecapVideoSchema.index({ isProcessed: 1, createdAt: -1 });

export const RecapVideo = mongoose.model<IRecapVideo>('RecapVideo', RecapVideoSchema);

