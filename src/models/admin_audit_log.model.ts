import mongoose, { Schema, Document, Types } from 'mongoose';

export type AdminActionType = 'CREATE' | 'UPDATE' | 'DELETE' | 'BAN';
export type TargetResource = 'USER' | 'POST' | 'SUBSCRIPTION' | 'PLAN' | 'REFUND' | 'AD';

export interface IAdminAuditLog extends Document {
  adminId: Types.ObjectId; // Admin thực hiện hành động (ref đến User)
  actionType: AdminActionType; // Loại hành động
  targetResource: TargetResource; // Loại tài nguyên bị ảnh hưởng
  targetId: string; // ID của tài nguyên bị ảnh hưởng
  details: Record<string, any>; // JSON object chứa thông tin trước/sau thay đổi
  createdAt: Date;
}

const AdminAuditLogSchema = new Schema<IAdminAuditLog>(
  {
    adminId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    actionType: {
      type: String,
      enum: ['CREATE', 'UPDATE', 'DELETE', 'BAN'],
      required: true,
      index: true,
    },
    targetResource: {
      type: String,
      enum: ['USER', 'POST', 'SUBSCRIPTION', 'PLAN', 'REFUND', 'AD'],
      required: true,
      index: true,
    },
    targetId: { type: String, required: true, index: true },
    details: { type: Schema.Types.Mixed, required: true, default: {} },
    createdAt: { type: Date, default: () => new Date(), index: true },
  },
  { timestamps: false }
);

AdminAuditLogSchema.index({ createdAt: -1 });
AdminAuditLogSchema.index({ adminId: 1, createdAt: -1 });
AdminAuditLogSchema.index({ targetResource: 1, targetId: 1 });

export const AdminAuditLog = mongoose.model<IAdminAuditLog>('AdminAuditLog', AdminAuditLogSchema);