import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middlewares/auth.middleware';
import {
  getConversationsHandler,
  getMessagesHandler,
  sendMessageHandler,
  createOrGetConversationHandler,
  markAsReadHandler,
} from '../controllers/chat.controller';

const router = Router();

// Định nghĩa type cho Multer file
type MulterFile = {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

// Cấu hình multer để lưu file vào memory (buffer) để upload lên Cloudinary
const storage = multer.memoryStorage();

// Chỉ chấp nhận file ảnh
const fileFilter = (_req: Express.Request, file: MulterFile, cb: multer.FileFilterCallback) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

/**
 * GET /chat/conversations
 * Lấy danh sách conversations của user hiện tại
 * Query: ?page=1&limit=20
 */
router.get('/conversations', requireAuth, getConversationsHandler);

/**
 * POST /chat/conversations
 * Tạo hoặc lấy conversation giữa hai user
 * Body: { otherUserId: string }
 */
router.post('/conversations', requireAuth, createOrGetConversationHandler);

/**
 * GET /chat/conversations/:conversationId/messages
 * Lấy danh sách messages của một conversation
 * Query: ?page=1&limit=50
 */
router.get('/conversations/:conversationId/messages', requireAuth, getMessagesHandler);

/**
 * POST /chat/conversations/:conversationId/read
 * Đánh dấu messages là đã đọc
 */
router.post('/conversations/:conversationId/read', requireAuth, markAsReadHandler);

/**
 * POST /chat/messages
 * Gửi message (HTTP endpoint - fallback khi không dùng Socket.io)
 * Body: { conversationId: string, content: string, type?: 'text' | 'image' }
 * Hoặc multipart/form-data với file (image) và conversationId, content
 */
router.post('/messages', requireAuth, upload.single('image'), sendMessageHandler);

export default router;

