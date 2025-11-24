import mongoose, { Schema, Document, Types } from 'mongoose';

export type FriendshipStatus = 'pending' | 'accepted' | 'blocked';

export interface IFriendship extends Document {
  userA: Types.ObjectId; // smaller ObjectId
  userB: Types.ObjectId; // larger ObjectId
  requestedBy: Types.ObjectId;
  status: FriendshipStatus;
  blockedBy?: Types.ObjectId | null;
  createdAt: Date;
  acceptedAt?: Date | null;
  updatedAt: Date;
}

const FriendshipSchema = new Schema<IFriendship>(
  {
    userA: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    userB: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: { type: String, enum: ['pending', 'accepted', 'blocked'], default: 'pending', index: true },
    blockedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    acceptedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Đảm bảo cặp (userA,userB) luôn theo thứ tự và duy nhất
FriendshipSchema.pre('validate', function (next) {
  if (this.userA && this.userB && this.userA.toString() > this.userB.toString()) {
    const tmp = this.userA;
    this.userA = this.userB;
    this.userB = tmp;
  }
  next();
});

FriendshipSchema.index({ userA: 1, userB: 1 }, { unique: true });

export const Friendship = mongoose.model<IFriendship>('Friendship', FriendshipSchema);