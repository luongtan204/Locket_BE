import { Session } from '../models/session.model';
import { User } from '../models/user.model';
import { Device } from '../models/device.model';
import { Types } from 'mongoose';

const ONLINE_WINDOW_MS = 3 * 60 * 1000; // 3 phút coi là online

export async function heartbeat(params: {
  userId: Types.ObjectId;
  platform: 'ios' | 'android' | 'web';
  deviceId?: Types.ObjectId | null;
  foreground?: boolean;
  ip?: string | null;
  userAgent?: string | null;
}) {
  const { userId, platform, deviceId = null, foreground = true, ip = null, userAgent = null } = params;

  // Upsert session
  const now = new Date();
  await Session.findOneAndUpdate(
    { user: userId, device: deviceId ?? null, platform },
    {
      $set: {
        ip,
        userAgent,
        foreground,
        state: foreground ? 'online' : 'background',
        lastHeartbeatAt: now,
      },
      $setOnInsert: { createdAt: now, user: userId, device: deviceId ?? null, platform },
    },
    { upsert: true, new: true }
  ).lean();

  // Cập nhật thiết bị (nếu có)
  if (deviceId) {
    await Device.updateOne({ _id: deviceId }, { $set: { lastActiveAt: now } }).exec();
  }

  // Cập nhật snapshot trên User
  await User.updateOne(
    { _id: userId },
    {
      $set: {
        'presence.status': foreground ? 'online' : 'away',
        'presence.updatedAt': now,
        lastSeenAt: now,
      },
    }
  ).exec();
}

export async function computeUserPresence(userId: Types.ObjectId): Promise<'online' | 'away' | 'offline'> {
  const since = new Date(Date.now() - ONLINE_WINDOW_MS);
  const session = await Session.findOne({
    user: userId,
    lastHeartbeatAt: { $gt: since },
  })
    .select({ foreground: 1, lastHeartbeatAt: 1 })
    .lean();

  if (!session) return 'offline';
  return session.foreground ? 'online' : 'away';
}

export async function refreshSnapshot(userId: Types.ObjectId) {
  const status = await computeUserPresence(userId);
  const now = new Date();
  await User.updateOne(
    { _id: userId },
    { $set: { 'presence.status': status, 'presence.updatedAt': now }, $setOnInsert: { lastSeenAt: now } }
  ).exec();
}