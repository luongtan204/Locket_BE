# Locket-like Social App Backend (MongoDB/Mongoose)

Thiết kế cơ sở dữ liệu và service nền cho ứng dụng kiểu Locket: chia sẻ ảnh, bình luận, cảm xúc, bạn bè, thông báo; kèm gói Premium có thời hạn, quản lý trạng thái hoạt động (presence), phân quyền admin (RBAC), quảng cáo, và doanh thu/metrics. Không sử dụng cron/scripts — số liệu được cập nhật theo sự kiện (event-driven) và tính “khi cần” (on-demand).

## Tính năng chính
- Bài đăng ảnh (Post), bình luận (Comment), cảm xúc (Reaction) với bộ đếm.
- Bạn bè 2 chiều (Friendship) với pending/accepted/blocked.
- Thông báo (Notification) cho kết bạn, bình luận, reaction.
- Premium theo gói (Plan, Subscription, Invoice, Refund) + snapshot nhanh trên User.
- Trạng thái hoạt động (Presence) qua Session TTL và heartbeat, snapshot trên User.
- RBAC: vai trò user/moderator/admin/superadmin; nhật ký quản trị (AdminAuditLog).
- Quảng cáo (Ad), chiến dịch (AdCampaign), sự kiện quảng cáo (AdEvent) và service phân phối.
- Doanh thu và metrics: snapshot theo ngày (RevenueSnapshotDaily), cập nhật event-driven.

## Công nghệ
- Node.js + TypeScript
- MongoDB + Mongoose
## Import vào database MongoDB
mongosh 
load("E:/NhomReactNative/App_Locket/Backend/src/data/seed_all.mongo.js")
## Cấu trúc thư mục (gợi ý)
- src/models
  - user.model.ts
  - friendship.model.ts
  - device.model.ts
  - session.model.ts
  - post.model.ts
  - comment.model.ts
  - reaction.model.ts
  - notification.model.ts
  - plan.model.ts
  - subscription.model.ts
  - invoice.model.ts
  - refund.model.ts
  - ad.model.ts
  - ad_campaign.model.ts
  - ad_event.model.ts
  - admin_audit_log.model.ts
  - revenue_snapshot_daily.model.ts
- src/services
  - ad.service.ts
  - revenue.event-driven.ts
  - premium.util.ts
  - presence.util.ts

## Quan hệ giữa các model (tóm tắt)
- User 1–N: Post, Comment, Reaction, Device, Session, Notification, Subscription, Invoice, Refund, AdminAuditLog (actor).
- User ↔ User: Friendship (N–N) qua document (userA<userB), unique (userA,userB).
- Post 1–N: Comment (thread bằng parentComment), Reaction.
- Notification tham chiếu: user (người nhận), actor, post/comment/friendship (tùy).
- Premium: Subscription thuộc User và Plan; User có snapshot premium {status, expiresAt, plan, subscription}.
- Billing: Subscription 1–N Invoice; Invoice 1–N Refund.
- Ads: Ad 1–N AdCampaign; AdCampaign 1–N AdEvent; AdCampaign có thể tham chiếu advertiser (User).
- Presence: Session (TTL) theo user/device/platform; User.presence là snapshot.
- Doanh thu: RevenueSnapshotDaily là snapshot tổng hợp theo ngày (không tham chiếu trực tiếp).

## Các collection và ràng buộc quan trọng
- users: unique username/email/phone; roles[]; premium snapshot; presence; lastSeenAt.
- friendships: unique (userA,userB); status pending/accepted/blocked; requestedBy; blockedBy; acceptedAt.
- posts: author, imageUrl, caption, visibility, reactionCount/commentCount, reactionCounts, deletedAt.
- comments: post, author, content, parentComment, mentions[], isDeleted (soft delete).
- reactions: unique (post,user) để mỗi user tối đa 1 reaction/bài; type enum.
- notifications: user, actor, type, post?, comment?, friendship?, readAt.
- devices: unique pushToken; lastActiveAt.
- sessions: lastHeartbeatAt có TTL (ví dụ 15 phút) để cleanup; foreground/state.
- plans: code unique; price, interval(+count), trialDays, features, isActive.
- subscriptions: user, plan, status, currentPeriodStart/End, cancelAtPeriodEnd, canceledAt, autoRenew, provider, externalSubscriptionId.
- invoices: subscription, user; subtotal/discount/tax/providerFee/platformFee; grossAmount, netAmount; status; paidAt; periodStart/End.
- refunds: invoice, user; amount; status; refundedAt.
- ads: placement(feed/splash/banner), isActive, startAt/endAt, priority, impressionCount/clickCount, cta.
- ad_campaigns: ad, advertiser?; pricingModel (CPM/CPC/FLAT); rates; budgets/caps; startAt/endAt; status; counters.
- ad_events: campaign, ad, user?, type (impression/click), at.
- admin_audit_logs: actor, action, targetUser?, targetPost?, targetComment?, targetAd?, details, reason.
- revenue_snapshot_daily: day, currency (cố định, ví dụ VND), số liệu gộp: subs, ads, DAU/MAU/ARPU, churn, MRR/ARR.

## Index khuyến nghị
- User: username/email/phone unique; roles; premium.status/expiresAt; presence.status; lastSeenAt.
- Friendship: (userA, userB) unique; status.
- Post: (author, createdAt), (visibility, createdAt).
- Comment: (post, createdAt), (parentComment, createdAt).
- Reaction: (post, user) unique; (post, createdAt).
- Notification: (user, readAt, createdAt).
- Device: pushToken unique; (user, lastActiveAt).
- Session: TTL lastHeartbeatAt; (user, lastHeartbeatAt).
- Plan: code unique.
- Subscription: (user, status, currentPeriodEnd).
- Invoice: (user, createdAt), (subscription, createdAt), paidAt, netAmount.
- Refund: (user, refundedAt), (status, refundedAt).
- Ad: (placement, isActive, startAt, endAt), priority.
- AdCampaign: (status, startAt, endAt), advertiser.
- AdEvent: (campaign, type, at).
- AdminAuditLog: actor, action, createdAt desc.
- RevenueSnapshotDaily: day unique, createdAt desc.

## Quy tắc nghiệp vụ chính
- Quyền xem post: mặc định friends; có thể mở rộng private/custom list.
- Reaction: mỗi user tối đa 1 reaction/bài; đổi emoji = update type.
- Bình luận: reply bằng parentComment; xóa mềm isDeleted để giữ mạch hội thoại.
- Presence: app/web gửi heartbeat 30–60s; Session TTL tự dọn; User.presence là snapshot.
- Premium:
  - active nếu status ∈ {trialing, active, grace} và expiresAt > now.
  - cập nhật snapshot user.premium khi Subscription/Invoice thay đổi.
- RBAC: vai trò user/moderator/admin/superadmin; policy ví dụ:
  - manageUsers: admin+
  - moderateContent: moderator+
  - managePlans: admin+
- Quảng cáo:
  - Premium active không thấy quảng cáo.
  - Chọn quảng cáo theo placement, isActive và thời gian; ưu tiên priority; random nhẹ.
  - Ghi nhận impression/click tăng counters và log AdEvent.
- Doanh thu/metrics:
  - Event-driven: khi Invoice paid/Refund thành công/AdEvent, cập nhật ngay RevenueSnapshotDaily bằng $inc.
  - On-demand: khi mở dashboard 1 ngày, tính DAU/MAU/ARPU/MRR/ARR/Churn và ghi $set vào snapshot.
  - Không dùng cron/scripts, không dùng tỉ giá; 1 loại tiền tệ duy nhất (ví dụ VND).

## Trích đoạn model RevenueSnapshotDaily
(Đoạn mã tham chiếu, dùng tiền tệ cố định)

```typescript
import mongoose, { Schema, Document } from 'mongoose';

export interface IRevenueSnapshotDaily extends Document {
  day: string;          // yyyy-mm-dd (UTC)
  currency: string;     // tiền tệ gốc sau quy đổi (ví dụ 'VND')

  // Subscription
  subsGross: number;
  subsNet: number;
  subsTax: number;
  subsProviderFees: number;
  subsPlatformFees: number;
  refunds: number;      // số tiền refund trong ngày (giảm doanh thu)

  // Ads (ước tính dựa trên pricing)
  adsRevenue: number;
  impressions: number;
  clicks: number;
  ctr: number;          // clicks / impressions

  // Core metrics
  dau: number;          // Daily Active Users
  mau: number;          // 30-day MAU (tại ngày này)
  arpu: number;         // (subsNet + adsRevenue) / DAU
  arpdaus?: number;     // nếu muốn phân chia theo nguồn

  // Subscription metrics
  activeSubscribers: number;
  newSubscribers: number;       // số sub bắt đầu trong ngày
  canceledSubscribers: number;  // số sub hủy trong ngày
  churnRate: number;            // canceled / active_prev_day
  mrr: number;                  // Monthly Recurring Revenue (ước tính)
  arr: number;                  // Annualized (mrr * 12)

  createdAt: Date;
  updatedAt: Date;
}

const RevenueSnapshotDailySchema = new Schema<IRevenueSnapshotDaily>(
  {
    day: { type: String, required: true, index: true },
    currency: { type: String, required: true, default: 'VND' },

    subsGross: { type: Number, required: true, default: 0 },
    subsNet: { type: Number, required: true, default: 0, index: true },
    subsTax: { type: Number, required: true, default: 0 },
    subsProviderFees: { type: Number, required: true, default: 0 },
    subsPlatformFees: { type: Number, required: true, default: 0 },
    refunds: { type: Number, required: true, default: 0 },

    adsRevenue: { type: Number, required: true, default: 0 },
    impressions: { type: Number, required: true, default: 0 },
    clicks: { type: Number, required: true, default: 0 },
    ctr: { type: Number, required: true, default: 0 },

    dau: { type: Number, required: true, default: 0 },
    mau: { type: Number, required: true, default: 0 },
    arpu: { type: Number, required: true, default: 0 },

    activeSubscribers: { type: Number, required: true, default: 0 },
    newSubscribers: { type: Number, required: true, default: 0 },
    canceledSubscribers: { type: Number, required: true, default: 0 },
    churnRate: { type: Number, required: true, default: 0 },
    mrr: { type: Number, required: true, default: 0 },
    arr: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

RevenueSnapshotDailySchema.index({ day: 1 }, { unique: true });
RevenueSnapshotDailySchema.index({ createdAt: -1 });

export const RevenueSnapshotDaily = mongoose.model<IRevenueSnapshotDaily>('RevenueSnapshotDaily', RevenueSnapshotDailySchema);
```

## Hướng dẫn khởi động (tham khảo)
1) Chuẩn bị
- Node.js v18+ và MongoDB 6+
- Tạo database MongoDB, cấu hình MONGO_URI

2) Cài đặt
- Cài đặt package, build (nếu dùng TypeScript), khởi tạo kết nối MongoDB trong app của bạn.

3) Biến môi trường (gợi ý)
- MONGO_URI=mongodb://localhost:27017/locket_like
- NODE_ENV=development

4) Tạo index
- Mongoose sẽ tạo theo schema; hoặc chủ động tạo index thủ công nếu cần hiệu năng.

## Sử dụng các service

### Quảng cáo
- shouldShowAdsForUser(user): boolean — ẩn ads nếu user premium còn hiệu lực.
- listActiveAds({ placement, limit, now, excludeIds }) — lấy danh sách ads đang hoạt động theo vị trí.
- getFeedAdsForUser(user, limit, excludeIds) — lấy ads cho feed (đã xét premium).
- trackAdImpression(adId) / trackAdClick(adId) — tăng counters.

### Doanh thu (event-driven, không cron)
- recordInvoicePaid(invoiceId) — gọi khi Invoice chuyển sang paid.
- recordRefundSucceeded(refundId) — gọi khi Refund thành công.
- recordAdEvent(campaignId, adId, 'impression'|'click', at, count?, userId?) — ghi nhận sự kiện quảng cáo, cập nhật snapshot ngày.
- getOrComputeDailySnapshot(dayDate) — khi mở dashboard 1 ngày: đảm bảo FLAT ads per-day, tính DAU/MAU/ARPU/MRR/ARR/Churn và cache vào snapshot.

## Gợi ý bảo mật & riêng tư
- Băm mật khẩu (bcrypt/argon2), bảo vệ JWT/session.
- Lọc, rate-limit các endpoint bình luận/bài đăng để chống spam.
- RBAC middleware chặn truy cập admin/mod.
- Soft delete nội dung vi phạm; lưu AdminAuditLog để audit.

## Lộ trình mở rộng
- Close friends/custom list cho quyền xem post.
- Report/Appeal nội dung và người dùng.
- Targeting quảng cáo theo hành vi (cân nhắc riêng tư).
- Tối ưu counters bằng transaction/middleware thay vì change streams.

---
Nếu bạn muốn, mình có thể thêm ví dụ endpoint Express/NestJS cho các service trên, hoặc chuyển toàn bộ schema sang JavaScript thuần.