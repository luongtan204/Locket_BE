import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IComment extends Document {
  post: Types.ObjectId;
  author: Types.ObjectId;
  content: string;
  parentComment?: Types.ObjectId | null;
  mentions?: Types.ObjectId[];
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CommentSchema = new Schema<IComment>(
  {
    post: { type: Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    content: { type: String, required: true, maxlength: 1000 },
    parentComment: { type: Schema.Types.ObjectId, ref: 'Comment', default: null, index: true },
    mentions: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

CommentSchema.index({ post: 1, createdAt: 1 });
CommentSchema.index({ parentComment: 1, createdAt: 1 });

export const Comment = mongoose.model<IComment>('Comment', CommentSchema);