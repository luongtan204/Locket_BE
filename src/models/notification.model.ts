import mongoose, { Schema, Document, Types } from 'mongoose';

export type NotificationType =
    | 'friend_request'
    | 'friend_accept'
    | 'comment'
    | 'reaction'
    | 'subscription_expiring'
    | 'subscription_renewed';
export interface INotification extends Document {
    user: Types.ObjectId;      // người nhận thông báo
    actor: Types.ObjectId;     // người gây ra sự kiện
    type: NotificationType;
    post?: Types.ObjectId | null;
    comment?: Types.ObjectId | null;
    friendship?: Types.ObjectId | null;
    message?: string;
    readAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
    {
        user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        actor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        type: {
            type: String,
            enum: ['friend_request', 'friend_accept', 'comment', 'reaction'],
            required: true,
            index: true,
        },
        post: { type: Schema.Types.ObjectId, ref: 'Post', default: null },
        comment: { type: Schema.Types.ObjectId, ref: 'Comment', default: null },
        friendship: { type: Schema.Types.ObjectId, ref: 'Friendship', default: null },
        message: { type: String },
        readAt: { type: Date, default: null, index: true },
    },
    { timestamps: true }
);

NotificationSchema.index({ user: 1, readAt: 1, createdAt: -1 });

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);