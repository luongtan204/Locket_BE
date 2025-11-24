import { Types } from 'mongoose';
import { Conversation, IConversation } from '../models/conversation.model';
import { Message, IMessage, MessageType } from '../models/message.model';
import { Friendship } from '../models/friendship.model';
import { ApiError } from '../utils/apiResponse';

/**
 * Kiểm tra xem hai user có phải là bạn bè không
 * @param userId1 - ID của user thứ nhất
 * @param userId2 - ID của user thứ hai
 * @returns true nếu là bạn bè, false nếu không
 */
export async function areFriends(userId1: string, userId2: string): Promise<boolean> {
  const friendship = await Friendship.findOne({
    $or: [
      { userA: new Types.ObjectId(userId1), userB: new Types.ObjectId(userId2) },
      { userA: new Types.ObjectId(userId2), userB: new Types.ObjectId(userId1) },
    ],
    status: 'accepted',
  });

  return !!friendship;
}

/**
 * Tìm hoặc tạo conversation giữa hai user
 * Kiểm tra friendship trước khi tạo
 * @param userId1 - ID của user thứ nhất
 * @param userId2 - ID của user thứ hai
 * @returns Conversation object
 */
export async function findOrCreateConversation(userId1: string, userId2: string): Promise<IConversation> {
  if (userId1 === userId2) {
    throw new ApiError(400, 'Cannot create conversation with yourself');
  }

  // Kiểm tra friendship
  const isFriend = await areFriends(userId1, userId2);
  if (!isFriend) {
    throw new ApiError(403, 'Users must be friends to start a conversation');
  }

  // Sắp xếp participants theo thứ tự để đảm bảo unique
  const participants = [userId1, userId2]
    .map((id) => new Types.ObjectId(id))
    .sort((a, b) => a.toString().localeCompare(b.toString()));

  // Tìm conversation hiện có
  let conversation = await Conversation.findOne({ participants });

  // Nếu chưa có thì tạo mới
  if (!conversation) {
    conversation = await Conversation.create({ participants });
  }

  return conversation;
}

/**
 * Tạo message mới và cập nhật lastMessage trong conversation
 * @param conversationId - ID của conversation
 * @param senderId - ID của user gửi
 * @param content - Nội dung message
 * @param type - Loại message ('text' hoặc 'image')
 * @returns Message object
 */
export async function createMessage(
  conversationId: string,
  senderId: string,
  content: string,
  type: MessageType = 'text'
): Promise<IMessage> {
  // Kiểm tra conversation tồn tại
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    throw new ApiError(404, 'Conversation not found');
  }

  // Kiểm tra sender có phải là participant không
  const isParticipant = conversation.participants.some(
    (p) => p.toString() === senderId
  );
  if (!isParticipant) {
    throw new ApiError(403, 'You are not a participant of this conversation');
  }

  // Kiểm tra friendship giữa sender và người còn lại
  const otherParticipant = conversation.participants.find(
    (p) => p.toString() !== senderId
  );
  if (!otherParticipant) {
    throw new ApiError(400, 'Invalid conversation participants');
  }

  const isFriend = await areFriends(senderId, otherParticipant.toString());
  if (!isFriend) {
    throw new ApiError(403, 'Users must be friends to send messages');
  }

  // Tạo message
  const message = await Message.create({
    conversationId: new Types.ObjectId(conversationId),
    senderId: new Types.ObjectId(senderId),
    content,
    type,
    isRead: false,
  });

  // Cập nhật lastMessage và lastMessageAt trong conversation
  conversation.lastMessage = message._id as Types.ObjectId;
  conversation.lastMessageAt = message.createdAt;
  await conversation.save();

  // Populate để trả về đầy đủ thông tin
  await message.populate('senderId', 'username displayName avatarUrl');
  await message.populate('conversationId');

  return message;
}

/**
 * Lấy danh sách conversations của một user (có pagination)
 * @param userId - ID của user
 * @param page - Số trang (bắt đầu từ 1)
 * @param limit - Số lượng conversations mỗi trang
 * @returns Object chứa conversations và pagination info
 */
export async function getConversations(userId: string, page: number = 1, limit: number = 20) {
  const skip = (page - 1) * limit;

  const conversations = await Conversation.find({
    participants: new Types.ObjectId(userId),
  })
    .populate('participants', 'username displayName avatarUrl')
    .populate({
      path: 'lastMessage',
      populate: { path: 'senderId', select: 'username displayName avatarUrl' },
    })
    .sort({ lastMessageAt: -1, updatedAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const total = await Conversation.countDocuments({
    participants: new Types.ObjectId(userId),
  });

  return {
    conversations,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Lấy danh sách messages của một conversation (có pagination)
 * @param conversationId - ID của conversation
 * @param userId - ID của user đang request (để kiểm tra quyền)
 * @param page - Số trang (bắt đầu từ 1)
 * @param limit - Số lượng messages mỗi trang
 * @returns Object chứa messages và pagination info
 */
export async function getMessages(conversationId: string, userId: string, page: number = 1, limit: number = 50) {
  // Kiểm tra conversation tồn tại và user là participant
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    throw new ApiError(404, 'Conversation not found');
  }

  const isParticipant = conversation.participants.some(
    (p) => p.toString() === userId
  );
  if (!isParticipant) {
    throw new ApiError(403, 'You are not a participant of this conversation');
  }

  const skip = (page - 1) * limit;

  const messages = await Message.find({
    conversationId: new Types.ObjectId(conversationId),
  })
    .populate('senderId', 'username displayName avatarUrl')
    .sort({ createdAt: -1 }) // Mới nhất trước
    .skip(skip)
    .limit(limit)
    .lean();

  const total = await Message.countDocuments({
    conversationId: new Types.ObjectId(conversationId),
  });

  // Đảo ngược để hiển thị từ cũ đến mới (cho UI)
  messages.reverse();

  return {
    messages,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Đánh dấu messages là đã đọc
 * @param conversationId - ID của conversation
 * @param userId - ID của user đang đọc (không phải sender)
 */
export async function markMessagesAsRead(conversationId: string, userId: string): Promise<void> {
  // Kiểm tra conversation tồn tại và user là participant
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    throw new ApiError(404, 'Conversation not found');
  }

  const isParticipant = conversation.participants.some(
    (p) => p.toString() === userId
  );
  if (!isParticipant) {
    throw new ApiError(403, 'You are not a participant of this conversation');
  }

  // Đánh dấu tất cả messages chưa đọc (không phải của user này) là đã đọc
  await Message.updateMany(
    {
      conversationId: new Types.ObjectId(conversationId),
      senderId: { $ne: new Types.ObjectId(userId) },
      isRead: false,
    },
    {
      $set: { isRead: true },
    }
  );
}

