import mongoose, { Schema, Document, Types } from 'mongoose';

export type MessageType = 'text' | 'image';

export interface IMessage extends Document {
  conversationId: Types.ObjectId; // Reference đến conversation
  senderId: Types.ObjectId; // User gửi message
  content: string; // Nội dung message (text hoặc URL ảnh)
  type: MessageType; // Loại message: 'text' hoặc 'image'
  isRead: boolean; // Đã đọc chưa
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    content: { type: String, required: true },
    type: { type: String, enum: ['text', 'image'], default: 'text', index: true },
    isRead: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

// Index để query messages theo conversation và thời gian
MessageSchema.index({ conversationId: 1, createdAt: -1 });
MessageSchema.index({ senderId: 1, createdAt: -1 });

export const Message = mongoose.model<IMessage>('Message', MessageSchema);

