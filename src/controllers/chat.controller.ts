import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import {
  getConversations,
  getMessages,
  createMessage,
  findOrCreateConversation,
  markMessagesAsRead,
  getRecentMessages,
} from '../services/chat.service';
import { ok, ApiError } from '../utils/apiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { uploadToCloudinary } from '../utils/cloudinary';
import { groqService } from '../services/groq.service';
import { getSocketIOInstance } from '../services/socket.service';
import { env } from '../config/env';
import { Conversation } from '../models/conversation.model';
import { Types } from 'mongoose';

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

  // Tạo message
  const message = await createMessage(conversationId, req.userId, messageContent, messageType);

  // Kiểm tra nếu đây là conversation với Bot
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    throw new ApiError(404, 'Conversation not found');
  }

  // Debug: Log để kiểm tra
  const participantIds = conversation.participants.map((p) => {
    // Đảm bảo convert đúng sang string
    const id = p instanceof Types.ObjectId ? p.toString() : String(p);
    return id;
  });
  
  // So sánh BOT_ID (có thể là string hoặc ObjectId)
  const botIdString = env.BOT_ID ? String(env.BOT_ID).trim() : '';
  const isBotConversation = botIdString && participantIds.some((id) => id === botIdString);
  
  console.log('[AI Bot] Checking bot conversation:', {
    conversationId,
    participants: participantIds,
    botId: botIdString,
    isBotConversation,
    messageType,
    groqAvailable: groqService.isAvailable(),
  });

  // Nếu là chat với Bot, xử lý AI response trong background
  if (isBotConversation && messageType === 'text' && groqService.isAvailable()) {
    console.log('[AI Bot] Processing bot response in background...');
    // Response ngay cho client (không chờ AI)
    res.status(201).json(ok(message, 'Message sent successfully'));

    // Xử lý AI response trong background (async, không await)
    (async () => {
      try {
        console.log('[AI Bot] Starting bot response generation...');
        
        // Lấy lịch sử chat gần đây để làm context
        const history = await getRecentMessages(conversationId, 15);
        console.log('[AI Bot] Chat history loaded:', history.length, 'messages');

        // Gọi AI để generate response
        console.log('[AI Bot] Calling Groq API...');
        const botResponse = await groqService.generateBotResponse(messageContent, history);
        console.log('[AI Bot] Bot response generated:', botResponse.substring(0, 50) + '...');

        // Tạo message mới từ Bot
        const botMessage = await createMessage(
          conversationId,
          env.BOT_ID,
          botResponse,
          'text'
        );
        console.log('[AI Bot] Bot message created:', botMessage._id);

        // Populate để có đầy đủ thông tin
        await botMessage.populate('senderId', 'username displayName avatarUrl');
        await botMessage.populate('conversationId');

        // Emit socket event để client nhận được message từ Bot
        const io = getSocketIOInstance();
        if (io) {
          const roomName = `conversation:${conversationId}`;
          io.to(roomName).emit('new_message', {
            message: botMessage.toObject(),
          });
          console.log(`[AI Bot] Socket event emitted to room: ${roomName}`);
        } else {
          console.warn('[AI Bot] Socket.io instance not available');
        }
        
        console.log('[AI Bot] Bot response completed successfully');
      } catch (error) {
        console.error('[AI Bot] Error generating response:', error);
        if (error instanceof Error) {
          console.error('[AI Bot] Error details:', error.message, error.stack);
        }
        // Không throw error để không ảnh hưởng đến response đã gửi cho client
      }
    })();

    return; // Đã response rồi, không cần return gì thêm
  }

  // 🔴 BỔ SUNG LOGIC SOCKET CHO NGƯỜI THƯỜNG
  const io = getSocketIOInstance();
  if (io) {
    const roomName = `conversation:${conversationId}`;
    console.log(`[Human Chat] Emitting new_message to room: ${roomName}`);
    
    // Populate message để có đầy đủ thông tin trước khi emit
    await message.populate('senderId', 'username displayName avatarUrl');
    await message.populate('conversationId');
    
    io.to(roomName).emit('new_message', {
      message: message.toObject()
    });
    
    console.log(`[Human Chat] ✅ Socket event emitted successfully to room: ${roomName}`);
  } else {
    console.warn('[Human Chat] Socket.io instance not available');
  }

  // Response API (Giữ nguyên)
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

