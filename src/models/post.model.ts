import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IPost extends Document {
  author: Types.ObjectId;
  imageUrl: string;
  caption?: string;
  location?: {
    name?: string;
    lat?: number;
    lng?: number;
  };
  visibility: 'friends' | 'private';
  reactionCount: number;
  commentCount: number;
  reactionCounts: Record<string, number>;
  viewers: Array<{
    userId: Types.ObjectId;
    seenAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

const PostSchema = new Schema<IPost>(
  {
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    imageUrl: { type: String, required: true },
    caption: { type: String, maxlength: 300 },
    location: {
      name: String,
      lat: Number,
      lng: Number,
    },
    visibility: { type: String, enum: ['friends', 'private'], default: 'friends', index: true },
    reactionCount: { type: Number, default: 0 },
    commentCount: { type: Number, default: 0 },
    reactionCounts: { type: Map, of: Number, default: {} },
    viewers: [
      {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        seenAt: { type: Date, required: true, default: Date.now },
      },
    ],
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

PostSchema.index({ author: 1, createdAt: -1 });
PostSchema.index({ visibility: 1, createdAt: -1 });

export const Post = mongoose.model<IPost>('Post', PostSchema);