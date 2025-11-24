import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IConversation extends Document {
  participants: Types.ObjectId[]; // Mảng 2 user IDs (luôn sắp xếp theo thứ tự)
  lastMessage?: Types.ObjectId | null; // Reference đến message cuối cùng
  lastMessageAt?: Date | null; // Thời gian message cuối cùng
  createdAt: Date;
  updatedAt: Date;
}

const ConversationSchema = new Schema<IConversation>(
  {
    participants: {
      type: [{ type: Schema.Types.ObjectId, ref: 'User', required: true }],
      required: true,
      validate: {
        validator: (arr: Types.ObjectId[]) => arr.length === 2,
        message: 'Conversation must have exactly 2 participants',
      },
    },
    lastMessage: { type: Schema.Types.ObjectId, ref: 'Message', default: null },
    lastMessageAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Đảm bảo participants luôn được sắp xếp theo thứ tự để dễ tìm kiếm
ConversationSchema.pre('validate', function (next) {
  if (this.participants && this.participants.length === 2) {
    const [userA, userB] = this.participants;
    if (userA.toString() > userB.toString()) {
      this.participants = [userB, userA];
    }
  }
  next();
});

// Index để tìm conversation nhanh hơn
ConversationSchema.index({ participants: 1 }, { unique: true });
ConversationSchema.index({ lastMessageAt: -1 }); // Để sắp xếp conversations theo thời gian

export const Conversation = mongoose.model<IConversation>('Conversation', ConversationSchema);

