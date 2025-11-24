import mongoose, { Schema, Document, Types } from 'mongoose';

export type Role = 'user' | 'moderator' | 'admin' | 'superadmin';
export type ModerationStatus = 'active' | 'suspended' | 'banned';

export interface IUser extends Document {
  username: string;
  displayName?: string;
  email?: string;
  phone?: string;
  passwordHash: string;
  avatarUrl?: string;
  avatarPublicId?: string;
  bio?: string;
  settings: {
    privacy: 'friends' | 'private';
    allowCommentsFrom: 'friends' | 'no_one';
    allowReactions: boolean;
  };
  // Premium snapshot
  premium?: {
    status: 'none' | 'trialing' | 'active' | 'grace' | 'expired';
    expiresAt?: Date | null;
    plan?: Types.ObjectId | null;
    subscription?: Types.ObjectId | null;
    lastCheckedAt?: Date | null;
  };
  // Presence
  presence?: {
    status: 'online' | 'away' | 'dnd' | 'offline';
    updatedAt?: Date | null;
  };
  lastSeenAt?: Date | null;

  isActive: boolean;

  // RBAC
  roles: Role[];

  // Moderation
  moderation?: {
    status: ModerationStatus;
    bannedUntil?: Date | null;
    reason?: string | null;
    updatedBy?: Types.ObjectId | null; // admin/mod cập nhật
    updatedAt?: Date | null;
  };

  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    username: { type: String, required: true, trim: true, lowercase: true, unique: true, index: true },
    displayName: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true, sparse: true, unique: true, index: true },
    phone: { type: String, trim: true, sparse: true, unique: true },
    passwordHash: { type: String, required: true, select: false },
    avatarUrl: { type: String },
    avatarPublicId: { type: String },
    bio: { type: String, maxlength: 150 },
    settings: {
      privacy: { type: String, enum: ['friends', 'private'], default: 'friends' },
      allowCommentsFrom: { type: String, enum: ['friends', 'no_one'], default: 'friends' },
      allowReactions: { type: Boolean, default: true },
    },
    premium: {
      status: { type: String, enum: ['none', 'trialing', 'active', 'grace', 'expired'], default: 'none', index: true },
      expiresAt: { type: Date, default: null, index: true },
      plan: { type: Schema.Types.ObjectId, ref: 'Plan', default: null, index: true },
      subscription: { type: Schema.Types.ObjectId, ref: 'Subscription', default: null, index: true },
      lastCheckedAt: { type: Date, default: null },
    },
    presence: {
      status: { type: String, enum: ['online', 'away', 'dnd', 'offline'], default: 'offline', index: true },
      updatedAt: { type: Date, default: null },
    },
    lastSeenAt: { type: Date, default: null, index: true },

    isActive: { type: Boolean, default: true, index: true },

    roles: {
      type: [{ type: String, enum: ['user', 'moderator', 'admin', 'superadmin'] }],
      default: ['user'],
      index: true,
    },

    moderation: {
      status: { type: String, enum: ['active', 'suspended', 'banned'], default: 'active', index: true },
      bannedUntil: { type: Date, default: null, index: true },
      reason: { type: String, default: null },
      updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      updatedAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

UserSchema.index({ 'premium.expiresAt': 1 });
UserSchema.index({ 'premium.status': 1 });
UserSchema.index({ 'presence.status': 1 });
UserSchema.index({ lastSeenAt: -1 });
UserSchema.index({ roles: 1 });
UserSchema.index({ 'moderation.status': 1, 'moderation.bannedUntil': 1 });

export const User = mongoose.model<IUser>('User', UserSchema);