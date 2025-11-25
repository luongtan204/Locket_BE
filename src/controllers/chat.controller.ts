import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import {
  getConversations,
  getMessages,
  createMessage,
  findOrCreateConversation,
  markMessagesAsRead,
} from '../services/chat.service';
import { ok, ApiError } from '../utils/apiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { uploadToCloudinary } from '../utils/cloudinary';
import { getSocketIOInstance } from '../services/socket.service';

// Định nghĩa type cho Multer file
interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

// Extend AuthRequest để có file type
interface ChatRequest extends Omit<AuthRequest, 'file'> {
  file?: MulterFile;
}

/**
 * Lấy danh sách conversations của user hiện tại
 * GET /chat/conversations?page=1&limit=20
 */
export const getConversationsHandler = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.userId) {
    throw new ApiError(401, 'Unauthorized');
  }

  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;

  const result = await getConversations(req.userId, page, limit);

  return res.status(200).json(ok(result, 'Conversations retrieved successfully'));
});

/**
 * Lấy danh sách messages của một conversation
 * GET /chat/conversations/:conversationId/messages?page=1&limit=50
 */
export const getMessagesHandler = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.userId) {
    throw new ApiError(401, 'Unauthorized');
  }

  const { conversationId } = req.params;
  if (!conversationId) {
    throw new ApiError(400, 'conversationId is required');
  }

  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;

  const result = await getMessages(conversationId, req.userId, page, limit);

  // Đánh dấu messages là đã đọc khi user xem
  await markMessagesAsRead(conversationId, req.userId);

  return res.status(200).json(ok(result, 'Messages retrieved successfully'));
});

/**
 * Gửi message (HTTP endpoint - fallback khi không dùng Socket.io)
 * POST /chat/messages
 * Body: { conversationId: string, content: string, type?: 'text' | 'image' }
 * Hoặc multipart/form-data với file (image) và conversationId, content
 */
export const sendMessageHandler = asyncHandler(async (req: ChatRequest, res: Response) => {
  if (!req.userId) {
    throw new ApiError(401, 'Unauthorized');
  }

  const { conversationId, content, type } = req.body;
  const file = req.file;

  // Nếu có file (image), upload lên Cloudinary trước
  let messageContent = content;
  let messageType: 'text' | 'image' = type || 'text';

  if (file) {
    // Upload ảnh lên Cloudinary
    try {
      if (!file.buffer) {
        throw new ApiError(400, 'File buffer is required');
      }

      const uploadResult = await uploadToCloudinary(file.buffer, 'locket/messages', {
        quality: 'auto',
        fetch_format: 'auto',
      } as any);

      messageContent = uploadResult.secure_url;
      messageType = 'image';
    } catch (error) {
      console.error('Cloudinary upload error:', error);
      throw new ApiError(500, 'Failed to upload image to cloud storage');
    }
  }

  // Kiểm tra conversationId và content
  if (!conversationId) {
    throw new ApiError(400, 'conversationId is required');
  }

  if (!messageContent) {
    throw new ApiError(400, 'content is required');
  }

  // Tạo message (đã được populate senderId và conversationId trong service)
  const message = await createMessage(conversationId, req.userId, messageContent, messageType);

  // Bắn tín hiệu Socket.IO để gửi message real-time
  const io = getSocketIOInstance();
  
  // DEBUG: Log conversationId để kiểm tra type
  console.log('[Chat Controller] ========== DEBUG SOCKET EMIT ==========');
  console.log('[Chat Controller] conversationId:', conversationId);
  console.log('[Chat Controller] conversationId type:', typeof conversationId);
  console.log('[Chat Controller] conversationId is ObjectId?', conversationId instanceof Object);
  
  if (io) {
    console.log('[Chat Controller] Socket.IO instance found, bắt đầu emit...');
    
    // Convert message sang plain object để emit
    const messageObj = (message as any).toObject ? (message as any).toObject() : message;
    
    // DEBUG: Log dữ liệu message đang được gửi
    console.log('[Chat Controller] Message object:', JSON.stringify(messageObj, null, 2));
    console.log('[Chat Controller] Message senderId:', messageObj.senderId);
    console.log('[Chat Controller] Message senderId type:', typeof messageObj.senderId);
    console.log('[Chat Controller] Message senderId._id:', messageObj.senderId?._id);
    console.log('[Chat Controller] Message conversationId:', messageObj.conversationId);
    
    // Tạo room name
    const conversationRoom = `conversation:${conversationId}`;
    console.log('[Chat Controller] Emitting to conversation room:', conversationRoom);
    
    // Broadcast message đến tất cả clients trong room của conversation
    io.to(conversationRoom).emit('new_message', {
      message: messageObj,
    });
    
    console.log('[Chat Controller] ✅ Emit thành công đến conversation room:', conversationRoom);
    
    // Cũng gửi đến user room của người nhận (nếu họ không ở trong conversation room)
    // Lấy participants từ conversation (đã được populate trong createMessage)
    const conversationObj = (message as any).conversationId;
    console.log('[Chat Controller] Conversation object:', conversationObj);
    
    if (conversationObj && conversationObj.participants) {
      console.log('[Chat Controller] Participants:', conversationObj.participants);
      const otherParticipant = conversationObj.participants.find(
        (p: any) => p.toString() !== req.userId
      );
      console.log('[Chat Controller] Other participant:', otherParticipant);
      
      if (otherParticipant) {
        const userRoom = `user:${otherParticipant.toString()}`;
        console.log('[Chat Controller] Emitting to user room:', userRoom);
        io.to(userRoom).emit('new_message', {
          message: messageObj,
        });
        console.log('[Chat Controller] ✅ Emit thành công đến user room:', userRoom);
      } else {
        console.log('[Chat Controller] ⚠️ Không tìm thấy other participant');
      }
    } else {
      console.log('[Chat Controller] ⚠️ Conversation object hoặc participants không tồn tại');
    }
    
    console.log(`[Chat Controller] Message sent via Socket.IO in conversation:${conversationId} by user:${req.userId}`);
    console.log('[Chat Controller] ========== END DEBUG ==========');
  } else {
    console.warn('[Chat Controller] ⚠️ Socket.IO instance not available, message saved but not broadcasted');
    console.log('[Chat Controller] ========== END DEBUG ==========');
  }

  return res.status(201).json(ok(message, 'Message sent successfully'));
});

/**
 * Tạo hoặc lấy conversation giữa hai user
 * POST /chat/conversations
 * Body: { otherUserId: string }
 */
export const createOrGetConversationHandler = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.userId) {
    throw new ApiError(401, 'Unauthorized');
  }

  const { otherUserId } = req.body;
  if (!otherUserId) {
    throw new ApiError(400, 'otherUserId is required');
  }

  const conversation = await findOrCreateConversation(req.userId, otherUserId);

  // Populate participants
  await conversation.populate('participants', 'username displayName avatarUrl');
  await conversation.populate({
    path: 'lastMessage',
    populate: { path: 'senderId', select: 'username displayName avatarUrl' },
  });

  return res.status(200).json(ok(conversation, 'Conversation retrieved successfully'));
});

/**
 * Đánh dấu messages là đã đọc
 * POST /chat/conversations/:conversationId/read
 */
export const markAsReadHandler = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.userId) {
    throw new ApiError(401, 'Unauthorized');
  }

  const { conversationId } = req.params;
  if (!conversationId) {
    throw new ApiError(400, 'conversationId is required');
  }

  await markMessagesAsRead(conversationId, req.userId);

  return res.status(200).json(ok(null, 'Messages marked as read'));
});

