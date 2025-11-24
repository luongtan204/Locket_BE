import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IDevice extends Document {
  userId: Types.ObjectId;
  fcmToken: string;
  platform: 'ios' | 'android';
  lastActiveAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DeviceSchema = new Schema<IDevice>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    fcmToken: { type: String, required: true, unique: true, index: true },
    platform: { type: String, enum: ['ios', 'android'], required: true },
    lastActiveAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

DeviceSchema.index({ userId: 1, lastActiveAt: -1 });

export const Device = mongoose.model<IDevice>('Device', DeviceSchema);