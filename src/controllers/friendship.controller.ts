import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import {
  sendRequest,
  acceptRequest,
  rejectRequest,
  getFriendsList,
  getPendingRequests,
  unfriend,
  checkFriendshipStatus,
} from '../services/friendship.service';
import { ok } from '../utils/apiResponse';
import { ApiError } from '../utils/apiResponse';
import { asyncHandler } from '../utils/asyncHandler';

/**
 * Gửi lời mời kết bạn
 * POST /friendships/request
 * Body: { toUserId: string }
 */
export const sendFriendRequest = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.userId) {
    throw new ApiError(401, 'Unauthorized');
  }

  const { toUserId } = req.body;

  if (!toUserId) {
    throw new ApiError(400, 'toUserId is required');
  }

  const friendship = await sendRequest(req.userId, toUserId);

  return res.status(201).json(ok(friendship, 'Friend request sent successfully'));
});

/**
 * Chấp nhận lời mời kết bạn
 * POST /friendships/:requestId/accept
 */
export const acceptFriendRequest = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.userId) {
    throw new ApiError(401, 'Unauthorized');
  }

  const { requestId } = req.params;

  if (!requestId) {
    throw new ApiError(400, 'requestId is required');
  }

  const friendship = await acceptRequest(requestId, req.userId);

  return res.status(200).json(ok(friendship, 'Friend request accepted successfully'));
});

/**
 * Từ chối hoặc hủy lời mời kết bạn
 * POST /friendships/:requestId/reject
 */
export const rejectFriendRequest = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.userId) {
    throw new ApiError(401, 'Unauthorized');
  }

  const { requestId } = req.params;

  if (!requestId) {
    throw new ApiError(400, 'requestId is required');
  }

  await rejectRequest(requestId, req.userId);

  return res.status(200).json(ok(null, 'Friend request rejected successfully'));
});

/**
 * Lấy danh sách bạn bè
 * GET /friendships
 */
export const getFriends = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.userId) {
    throw new ApiError(401, 'Unauthorized');
  }

  const friendships = await getFriendsList(req.userId);

  // Transform để trả về thông tin bạn bè (không phải friendship object)
  const friends = friendships.map((friendship) => {
    const userAId = (friendship.userA as any)?._id?.toString();
    const userBId = (friendship.userB as any)?._id?.toString();
    const currentUserId = req.userId!;

    // Trả về thông tin của người bạn (không phải current user)
    if (userAId === currentUserId) {
      return {
        ...friendship.userB,
        friendshipId: friendship._id,
        acceptedAt: friendship.acceptedAt,
      };
    } else {
      return {
        ...friendship.userA,
        friendshipId: friendship._id,
        acceptedAt: friendship.acceptedAt,
      };
    }
  });

  return res.status(200).json(ok({ friends, count: friends.length }, 'Friends list retrieved successfully'));
});

/**
 * Lấy danh sách lời mời đang pending
 * GET /friendships/pending
 */
export const getPending = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.userId) {
    throw new ApiError(401, 'Unauthorized');
  }

  const pendingRequests = await getPendingRequests(req.userId);

  // Transform để trả về thông tin người gửi request
  const requests = pendingRequests.map((friendship) => {
    const requestedBy = friendship.requestedBy as any;
    return {
      _id: friendship._id,
      requestedBy: {
        _id: requestedBy._id,
        username: requestedBy.username,
        displayName: requestedBy.displayName,
        avatarUrl: requestedBy.avatarUrl,
      },
      createdAt: friendship.createdAt,
    };
  });

  return res.status(200).json(ok({ requests, count: requests.length }, 'Pending requests retrieved successfully'));
});

/**
 * Hủy kết bạn
 * DELETE /friendships/:friendId
 */
export const unfriendUser = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.userId) {
    throw new ApiError(401, 'Unauthorized');
  }

  const { friendId } = req.params;

  if (!friendId) {
    throw new ApiError(400, 'friendId is required');
  }

  await unfriend(req.userId, friendId);

  return res.status(200).json(ok(null, 'Unfriended successfully'));
});

/**
 * Kiểm tra trạng thái friendship
 * GET /friendships/check/:userId
 */
export const checkStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.userId) {
    throw new ApiError(401, 'Unauthorized');
  }

  const { userId } = req.params;

  if (!userId) {
    throw new ApiError(400, 'userId is required');
  }

  const result = await checkFriendshipStatus(req.userId, userId);

  return res.status(200).json(ok(result, 'Friendship status retrieved successfully'));
});
