import mongoose, { Schema, Document } from 'mongoose';

export type OTPType = 'phone' | 'email';

export interface IOTP extends Document {
  type: OTPType; // 'phone' hoặc 'email'
  identifier: string; // phone number hoặc email address
  code: string;
  expiresAt: Date;
  verified: boolean;
  attempts: number; // Số lần thử verify
  createdAt: Date;
  updatedAt: Date;
}

const OTPSchema = new Schema<IOTP>(
  {
    type: { type: String, enum: ['phone', 'email'], required: true, index: true },
    identifier: { type: String, required: true, index: true }, // phone hoặc email
    code: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: true },
    verified: { type: Boolean, default: false, index: true },
    attempts: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Index để tìm OTP chưa verify và chưa hết hạn
OTPSchema.index({ type: 1, identifier: 1, verified: 1, expiresAt: 1 });

// Tự động xóa OTP đã hết hạn sau 10 phút
OTPSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 600 });

export const OTP = mongoose.model<IOTP>('OTP', OTPSchema);

