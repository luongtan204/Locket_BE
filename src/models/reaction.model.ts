import mongoose, { Schema, Document, Types } from 'mongoose';

export type ReactionType = 'heart' | 'smile' | 'laugh' | 'shock' | 'sad' | 'thumbsup';

export interface IReaction extends Document {
  post: Types.ObjectId;
  user: Types.ObjectId;
  type: ReactionType;
  createdAt: Date;
  updatedAt: Date;
}

const ReactionSchema = new Schema<IReaction>(
  {
    post: { type: Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['heart', 'smile', 'laugh', 'shock', 'sad', 'thumbsup'], required: true },
  },
  { timestamps: true }
);

// Mỗi user chỉ có 1 reaction trên 1 bài; cập nhật type nếu đổi
ReactionSchema.index({ post: 1, user: 1 }, { unique: true });
ReactionSchema.index({ post: 1, createdAt: -1 });

export const Reaction = mongoose.model<IReaction>('Reaction', ReactionSchema);