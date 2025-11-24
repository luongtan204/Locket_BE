import { Response } from 'express';
import { Types } from 'mongoose';
import { AuthRequest } from '../middlewares/auth.middleware';
import { postService } from '../services/post.service';
import { groqService } from '../services/groq.service';
import { ok, ApiError } from '../utils/apiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { uploadToCloudinary } from '../utils/cloudinary';

// Định nghĩa type cho Multer file
interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
  location?: string; // URL sau khi upload lên Cloudinary/S3
  path?: string;
  filename?: string;
}

// Extend AuthRequest để có file type
interface PostRequest extends Omit<AuthRequest, 'file'> {
  file?: MulterFile;
}

/**
 * Tạo bài viết mới (Upload Moment)
 * POST /posts
 * Body: multipart/form-data với file (image) và caption (optional)
 */
export const create = asyncHandler(async (req: PostRequest, res: Response) => {
  // Kiểm tra authentication
  if (!req.user || !req.user._id) {
    throw new ApiError(401, 'Unauthorized');
  }

  // Lấy userId từ req.user._id
  const userId = req.user._id.toString();

  // Lấy file từ multer (sẽ được thêm vào req.file)
  const file = req.file;
  if (!file) {
    throw new ApiError(400, 'Image file is required');
  }

  // Upload file lên Cloudinary
  let imageUrl: string;
  try {
    if (!file.buffer) {
      throw new ApiError(400, 'File buffer is required');
    }

    const uploadResult = await uploadToCloudinary(file.buffer, 'locket/posts', {
      quality: 'auto',
      fetch_format: 'auto',
    } as any);
    
    // Lấy URL từ Cloudinary (hoặc từ req.file.location nếu đã có)
    imageUrl = uploadResult.secure_url || file.location || '';
    
    if (!imageUrl) {
      throw new ApiError(500, 'Failed to get image URL');
    }
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw new ApiError(500, 'Failed to upload image to cloud storage');
  }

  // Lấy caption từ body
  const { caption } = req.body;

  // Gọi PostService.createPost với URL này
  const post = await postService.createPost(userId, imageUrl, caption);

  // Trả về Response 201 kèm theo thông tin bài post vừa tạo
  return res.status(201).json(ok(post, 'Post created successfully'));
});

/**
 * Gợi ý caption cho ảnh sử dụng Groq AI
 * POST /posts/suggest-caption
 * Body: multipart/form-data với file (image) HOẶC JSON với base64Image
 */
export const suggestCaption = asyncHandler(async (req: PostRequest, res: Response) => {
  // Kiểm tra authentication
  if (!req.user || !req.user._id) {
    throw new ApiError(401, 'Unauthorized');
  }

  // Kiểm tra Groq service có sẵn sàng không
  if (!groqService.isAvailable()) {
    throw new ApiError(503, 'Caption suggestion service is not available. Please configure GROQ_API_KEY.');
  }

  let imageBuffer: Buffer;

  // Cách 1: Nhận file từ multipart/form-data (multer)
  if (req.file && req.file.buffer) {
    imageBuffer = req.file.buffer;
  }
  // Cách 2: Nhận base64 từ JSON body
  else if (req.body.base64Image) {
    try {
      // Parse base64 string (có thể có prefix data:image/...;base64,)
      const base64String = req.body.base64Image.replace(/^data:image\/[a-z]+;base64,/, '');
      imageBuffer = Buffer.from(base64String, 'base64');
    } catch (error) {
      throw new ApiError(400, 'Invalid base64 image format');
    }
  } else {
    throw new ApiError(400, 'Image is required. Send as multipart/form-data file or JSON with base64Image field.');
  }

  // Kiểm tra image buffer hợp lệ
  if (!imageBuffer || imageBuffer.length === 0) {
    throw new ApiError(400, 'Invalid image data');
  }

  try {
    // Gọi Groq service để generate caption
    const caption = await groqService.suggestCaption(imageBuffer);

    // Trả về caption
    return res.status(200).json(ok({ caption }, 'Caption suggested successfully'));
  } catch (error) {
    console.error('[Post Controller] Error suggesting caption:', error);
    throw new ApiError(
      500,
      error instanceof Error ? error.message : 'Failed to generate caption suggestion'
    );
  }
});

/**
 * Lấy lịch sử posts giữa current user và một friend
 * GET /posts/history/:friendId
 * Query params: page (default: 1), limit (default: 20), groupByMonth (default: false)
 */
export const getHistory = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.userId) {
    throw new ApiError(401, 'Unauthorized');
  }

  const currentUserId = req.userId;
  const friendId = req.params.friendId;

  if (!friendId) {
    throw new ApiError(400, 'friendId is required');
  }

  // Parse query params
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const groupByMonth = req.query.groupByMonth === 'true' || req.query.groupByMonth === '1';

  // Validate pagination
  if (page < 1) {
    throw new ApiError(400, 'page must be greater than 0');
  }
  if (limit < 1 || limit > 100) {
    throw new ApiError(400, 'limit must be between 1 and 100');
  }

  // Gọi service để lấy history
  const result = await postService.getHistoryWithFriend(
    currentUserId,
    friendId,
    page,
    limit,
    groupByMonth
  );

  return res.status(200).json(ok(result, 'History retrieved successfully'));
});

/**
 * Lấy thông tin chi tiết một bài viết theo ID
 * GET /posts/:id
 */
export const getById = asyncHandler(async (req: AuthRequest, res: Response) => {
  const postId = req.params.id;

  if (!postId) {
    throw new ApiError(400, 'Post ID is required');
  }

  const post = await postService.getPostById(postId);

  return res.status(200).json(ok(post, 'Post retrieved successfully'));
});

/**
 * Cập nhật bài viết (chỉ cho phép sửa caption và location)
 * PUT /posts/:id
 * Body: { caption?: string, location?: { name?: string, lat?: number, lng?: number } }
 */
export const update = asyncHandler(async (req: AuthRequest, res: Response) => {
  // Kiểm tra authentication
  if (!req.user || !req.user._id) {
    throw new ApiError(401, 'Unauthorized');
  }

  const postId = req.params.id;
  const userId = req.user._id.toString();

  if (!postId) {
    throw new ApiError(400, 'Post ID is required');
  }

  // Lấy dữ liệu cập nhật từ body
  const { caption, location } = req.body;

  // Validate: chỉ cho phép cập nhật caption và location
  const updateData: { caption?: string; location?: { name?: string; lat?: number; lng?: number } } = {};

  if (caption !== undefined) {
    if (typeof caption !== 'string' || caption.length > 300) {
      throw new ApiError(400, 'Caption must be a string with max 300 characters');
    }
    updateData.caption = caption || undefined;
  }

  if (location !== undefined) {
    if (typeof location !== 'object' || location === null) {
      throw new ApiError(400, 'Location must be an object');
    }
    updateData.location = {
      name: location.name,
      lat: location.lat ? parseFloat(location.lat) : undefined,
      lng: location.lng ? parseFloat(location.lng) : undefined,
    };
  }

  // Kiểm tra có ít nhất một field để update
  if (Object.keys(updateData).length === 0) {
    throw new ApiError(400, 'At least one field (caption or location) must be provided');
  }

  const updatedPost = await postService.updatePost(postId, userId, updateData);

  return res.status(200).json(ok(updatedPost, 'Post updated successfully'));
});

/**
 * Xóa bài viết (chỉ chủ bài viết mới được xóa)
 * DELETE /posts/:id
 */
export const remove = asyncHandler(async (req: AuthRequest, res: Response) => {
  // Kiểm tra authentication
  if (!req.user || !req.user._id) {
    throw new ApiError(401, 'Unauthorized');
  }

  const postId = req.params.id;
  const userId = req.user._id.toString();

  if (!postId) {
    throw new ApiError(400, 'Post ID is required');
  }

  // Xóa post (service sẽ kiểm tra quyền và xóa ảnh trên Cloudinary)
  await postService.deletePost(postId, userId);

  return res.status(200).json(ok({ postId }, 'Post deleted successfully'));
});

/**
 * Đánh dấu bài viết đã được xem (Mark as Seen)
 * POST /posts/:id/seen
 */
export const markAsSeen = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.userId) {
    throw new ApiError(401, 'Unauthorized');
  }

  const postId = req.params.id;
  const userId = req.userId;

  if (!postId) {
    throw new ApiError(400, 'Post ID is required');
  }

  const post = await postService.markPostAsSeen(postId, userId);

  return res.status(200).json(ok(post, 'Post marked as seen successfully'));
});

/**
 * Lấy danh sách bài viết của một user (User Profile Feed / Wall)
 * GET /posts/user/:userId?limit=10&cursor=2023-10-25T10:00:00.000Z
 */
export const getUserWall = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.userId) {
    throw new ApiError(401, 'Unauthorized');
  }

  const targetUserId = req.params.userId;
  const currentUserId = req.userId;

  if (!targetUserId) {
    throw new ApiError(400, 'User ID is required');
  }

  // Validate targetUserId format
  if (!Types.ObjectId.isValid(targetUserId)) {
    throw new ApiError(400, 'Invalid user ID format');
  }

  // Lấy limit và cursor từ query params
  const limit = Math.min(Math.max(parseInt((req.query?.limit as string) || '10'), 1), 50); // Max 50
  const cursor = (req.query?.cursor as string) || undefined;

  // Gọi service để lấy posts
  const result = await postService.getUserWall(currentUserId, targetUserId, limit, cursor);

  return res.status(200).json(ok(result, 'User wall retrieved successfully'));
});