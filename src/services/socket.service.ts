import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { env } from '../config/env';
import { User } from '../models/user.model';
import { createMessage, findOrCreateConversation } from './chat.service';
import { Message } from '../models/message.model';
import { Conversation } from '../models/conversation.model';

// Singleton để lưu io instance
let ioInstance: SocketIOServer | null = null;

/**
 * Set io instance (được gọi từ server.ts khi khởi tạo)
 */
export function setSocketIOInstance(io: SocketIOServer) {
  ioInstance = io;
}

/**
 * Get io instance để emit events từ service/controller
 */
export function getSocketIOInstance(): SocketIOServer | null {
  return ioInstance;
}

// Interface cho authenticated socket
interface AuthenticatedSocket extends Socket {
  userId?: string;
  user?: any;
}

/**
 * Xác thực socket connection bằng JWT token
 */
export async function authenticateSocket(socket: AuthenticatedSocket, next: (err?: Error) => void) {
  try {
    // Lấy token từ auth object (khuyến nghị) hoặc từ query/headers
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.query?.token as string ||
      socket.handshake.headers?.authorization?.split(' ')[1];

    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    // Verify JWT token
    const payload = jwt.verify(token, env.JWT_SECRET as jwt.Secret) as any;
    const userId = payload.sub as string;

    // Tìm user trong database
    const user = await User.findById(userId);
    if (!user) {
      return next(new Error('Authentication error: User not found'));
    }

    // Lưu userId và user vào socket
    socket.userId = userId;
    socket.user = user;

    next();
  } catch (error) {
    next(new Error('Authentication error: Invalid or expired token'));
  }
}

/**
 * Khởi tạo và cấu hình Socket.io handlers
 */
export function initializeSocketIO(io: SocketIOServer) {
  // Middleware xác thực cho mọi connection
  io.use(authenticateSocket);

  io.on('connection', (socket: AuthenticatedSocket) => {
    const userId = socket.userId;
    if (!userId) {
      socket.disconnect();
      return;
    }

    console.log(`[Socket] User ${userId} connected (socket: ${socket.id})`);

    // Join room với userId để có thể gửi message trực tiếp cho user
    socket.join(`user:${userId}`);

    /**
     * Event: join_room
     * Client gửi: { conversationId: string } (có thể là "ID" hoặc "conversation:ID")
     * Server sẽ join user vào room của conversation đó
     */
    socket.on('join_room', async (data: { conversationId: string }) => {
      try {
        const { conversationId } = data;

        if (!conversationId) {
          socket.emit('error', { message: 'conversationId is required' });
          return;
        }

        // 1. Chuẩn hóa dữ liệu: Tách lấy raw ID và room name
        const rawId = conversationId.replace(/^conversation:/, '');
        const roomName = conversationId.startsWith('conversation:')
          ? conversationId
          : `conversation:${conversationId}`;

        // 2. Validate raw ID trước khi query DB (QUAN TRỌNG)
        if (!mongoose.Types.ObjectId.isValid(rawId)) {
          socket.emit('error', { message: 'Invalid conversation ID format' });
          console.error(`[Socket] Invalid conversationId format: ${conversationId} (rawId: ${rawId})`);
          return;
        }

        // 3. Query DB (Dùng Raw ID - QUAN TRỌNG)
        const conversation = await Conversation.findById(rawId);
        if (!conversation) {
          socket.emit('error', { message: 'Conversation not found' });
          return;
        }

        // 4. Kiểm tra quyền: User phải là participant
        const isParticipant = conversation.participants.some(
          (p) => p.toString() === userId
        );

        if (!isParticipant) {
          socket.emit('error', { message: 'You are not a participant of this conversation' });
          return;
        }

        // 5. Join Room (Dùng Room Name với prefix conversation:)
        socket.join(roomName);
        console.log(`[Socket] User ${userId} joined room: ${roomName} (conversationId: ${rawId})`);

        socket.emit('joined_room', { conversationId: rawId });
      } catch (error: any) {
        console.error('[Socket] Error in join_room:', error);
        socket.emit('error', { message: error.message || 'Failed to join room' });
      }
    });

    /**
     * Event: send_message
     * Client gửi: { conversationId: string, content: string, type?: 'text' | 'image' }
     * Server sẽ:
     * 1. Lưu message vào database
     * 2. Broadcast message đến tất cả clients trong room của conversation
     */
    socket.on('send_message', async (data: { conversationId: string; content: string; type?: 'text' | 'image' }) => {
      try {
        const { conversationId, content, type = 'text' } = data;

        if (!conversationId || !content) {
          socket.emit('error', { message: 'conversationId and content are required' });
          return;
        }

        // Phân tách ID: Tách lấy raw ID (để query DB) và room name (để socket emit)
        const rawId = conversationId.replace(/^conversation:/, '');
        const roomName = conversationId.startsWith('conversation:')
          ? conversationId
          : `conversation:${conversationId}`;

        // Tạo message trong database (dùng rawId)
        const message = await createMessage(rawId, userId, content, type);

        // Populate để có đầy đủ thông tin
        await message.populate('senderId', 'username displayName avatarUrl');
        await message.populate('conversationId');

        // Broadcast message đến tất cả clients trong room của conversation (dùng roomName)
        io.to(roomName).emit('new_message', {
          message: message.toObject(),
        });

        console.log(`[Socket] Message sent in room: ${roomName} (conversationId: ${rawId}) by user:${userId}`);

        // Gửi confirmation về cho sender
        socket.emit('message_sent', {
          messageId: message._id,
          conversationId: rawId,
        });
      } catch (error: any) {
        console.error('[Socket] Error in send_message:', error);
        socket.emit('error', { message: error.message || 'Failed to send message' });
      }
    });

    /**
     * Event: typing_start
     * Client gửi: { conversationId: string } (có thể là "ID" hoặc "conversation:ID")
     * Server sẽ broadcast đến các user khác trong conversation
     */
    socket.on('typing_start', (data: { conversationId: string }) => {
      const { conversationId } = data;
      if (conversationId) {
        // Phân tách ID: Tách lấy raw ID và room name
        const rawId = conversationId.replace(/^conversation:/, '');
        const roomName = conversationId.startsWith('conversation:')
          ? conversationId
          : `conversation:${conversationId}`;

        // Broadcast đến tất cả clients trong room trừ chính user đó (dùng roomName)
        socket.to(roomName).emit('user_typing', {
          conversationId: rawId, // Trả về rawId cho client
          userId,
          isTyping: true,
        });
      }
    });

    /**
     * Event: typing_stop
     * Client gửi: { conversationId: string } (có thể là "ID" hoặc "conversation:ID")
     * Server sẽ broadcast đến các user khác trong conversation
     */
    socket.on('typing_stop', (data: { conversationId: string }) => {
      const { conversationId } = data;
      if (conversationId) {
        // Phân tách ID: Tách lấy raw ID và room name
        const rawId = conversationId.replace(/^conversation:/, '');
        const roomName = conversationId.startsWith('conversation:')
          ? conversationId
          : `conversation:${conversationId}`;

        socket.to(roomName).emit('user_typing', {
          conversationId: rawId, // Trả về rawId cho client
          userId,
          isTyping: false,
        });
      }
    });

    /**
     * Event: mark_as_read
     * Client gửi: { conversationId: string, messageIds?: string[] }
     * Server sẽ đánh dấu messages là đã đọc
     */
    socket.on('mark_as_read', async (data: { conversationId: string; messageIds?: string[] }) => {
      try {
        const { conversationId, messageIds } = data;

        if (!conversationId) {
          socket.emit('error', { message: 'conversationId is required' });
          return;
        }

        // Phân tách ID: Tách lấy raw ID (để query DB)
        const rawId = conversationId.replace(/^conversation:/, '');

        // Nếu có messageIds cụ thể, chỉ đánh dấu những message đó
        if (messageIds && messageIds.length > 0) {
          await Message.updateMany(
            {
              _id: { $in: messageIds },
              conversationId: rawId, // Dùng rawId để query DB
              senderId: { $ne: userId },
              isRead: false,
            },
            {
              $set: { isRead: true },
            }
          );
        } else {
          // Đánh dấu tất cả messages chưa đọc trong conversation (dùng rawId)
          await Message.updateMany(
            {
              conversationId: rawId, // Dùng rawId để query DB
              senderId: { $ne: userId },
              isRead: false,
            },
            {
              $set: { isRead: true },
            }
          );
        }

        // Phân tách room name để broadcast
        const roomName = conversationId.startsWith('conversation:')
          ? conversationId
          : `conversation:${conversationId}`;

        // Broadcast đến conversation room (dùng roomName)
        io.to(roomName).emit('messages_read', {
          conversationId: rawId, // Trả về rawId cho client
          userId,
        });
      } catch (error: any) {
        console.error('[Socket] Error in mark_as_read:', error);
        socket.emit('error', { message: error.message || 'Failed to mark messages as read' });
      }
    });

    /**
     * Event: disconnect
     * Khi client disconnect, log và cleanup nếu cần
     */
    socket.on('disconnect', (reason) => {
      console.log(`[Socket] User ${userId} disconnected (socket: ${socket.id}), reason: ${reason}`);
    });
  });

  return io;
}

