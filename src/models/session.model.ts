import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ISession extends Document {
  user: Types.ObjectId;
  device?: Types.ObjectId | null; // optional for web
  platform: 'ios' | 'android' | 'web';
  ip?: string | null;
  userAgent?: string | null;
  foreground: boolean; // app đang foreground?
  state: 'online' | 'background';
  createdAt: Date;
  lastHeartbeatAt: Date; // cập nhật mỗi 30-60s
}

const SessionSchema = new Schema<ISession>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    device: { type: Schema.Types.ObjectId, ref: 'Device', default: null, index: true },
    platform: { type: String, enum: ['ios', 'android', 'web'], required: true, index: true },
    ip: { type: String, default: null },
    userAgent: { type: String, default: null },
    foreground: { type: Boolean, default: true },
    state: { type: String, enum: ['online', 'background'], default: 'online', index: true },
    createdAt: { type: Date, default: () => new Date() },
    lastHeartbeatAt: { type: Date, default: () => new Date(), index: true },
  },
  { timestamps: false }
);

// TTL: tự xóa session nếu không heartbeat trong 15 phút
SessionSchema.index({ lastHeartbeatAt: 1 }, { expireAfterSeconds: 900 });
SessionSchema.index({ user: 1, lastHeartbeatAt: -1 });

export const Session = mongoose.model<ISession>('Session', SessionSchema);