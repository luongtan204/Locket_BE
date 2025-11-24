// One-shot MongoDB seed file for all collections (no cron/scripts needed)
// Usage:
//   mongosh "mongodb://localhost:27017" data/seed_all.mongo.js
// It will seed the database named in DB_NAME (default: 'locket_like') using upsert.
// Safe to re-run: existing docs with same _id will be replaced.

const DB_NAME = typeof process !== 'undefined' && process.env.DB_NAME ? process.env.DB_NAME : 'locket';
const database = db.getSiblingDB(DB_NAME);

function oid(s) { return ObjectId(s); }
function dt(s) { return ISODate(s); }

function upserts(colName, docs) {
  if (!docs || !docs.length) return;
  const col = database.getCollection(colName);
  const ops = docs.map(doc => ({ replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true } }));
  const res = col.bulkWrite(ops, { ordered: false });
  print(`Seeded ${colName}: matched ${res.matchedCount}, upserted ${res.upsertedCount}, modified ${res.modifiedCount}`);
}

// --------------------- DATA ---------------------

const users = [
  {
    _id: oid("652000000000000000000001"),
    username: "alice",
    displayName: "Alice",
    email: "alice@example.com",
    passwordHash: "$argon2id$example",
    avatarUrl: null,
    bio: "Hello from Alice",
    settings: { privacy: "friends", allowCommentsFrom: "friends", allowReactions: true },
    premium: {
      status: "active",
      expiresAt: dt("2025-11-24T00:00:00Z"),
      plan: oid("653000000000000000000001"),
      subscription: oid("654000000000000000000001"),
      lastCheckedAt: dt("2025-10-24T14:40:00Z"),
    },
    presence: { status: "online", updatedAt: dt("2025-10-24T14:40:00Z") },
    lastSeenAt: dt("2025-10-24T14:40:00Z"),
    roles: ["user"],
    moderation: { status: "active", bannedUntil: null, reason: null, updatedBy: null, updatedAt: null },
    createdAt: dt("2025-10-20T10:00:00Z"),
    updatedAt: dt("2025-10-24T14:40:00Z"),
  },
  {
    _id: oid("652000000000000000000002"),
    username: "bob",
    displayName: "Bob",
    email: "bob@example.com",
    passwordHash: "$argon2id$example",
    avatarUrl: null,
    bio: "Bob here",
    settings: { privacy: "friends", allowCommentsFrom: "friends", allowReactions: true },
    premium: { status: "none", expiresAt: null, plan: null, subscription: null, lastCheckedAt: null },
    presence: { status: "away", updatedAt: dt("2025-10-24T14:35:00Z") },
    lastSeenAt: dt("2025-10-24T14:35:00Z"),
    roles: ["user"],
    moderation: { status: "active", bannedUntil: null, reason: null, updatedBy: null, updatedAt: null },
    createdAt: dt("2025-10-20T10:05:00Z"),
    updatedAt: dt("2025-10-24T14:35:00Z"),
  },
  {
    _id: oid("652000000000000000000003"),
    username: "charlie",
    displayName: "Charlie",
    email: "charlie@example.com",
    passwordHash: "$argon2id$example",
    avatarUrl: null,
    bio: "Charlie in the app",
    settings: { privacy: "friends", allowCommentsFrom: "friends", allowReactions: true },
    premium: { status: "none", expiresAt: null, plan: null, subscription: null, lastCheckedAt: null },
    presence: { status: "offline", updatedAt: dt("2025-10-23T09:00:00Z") },
    lastSeenAt: dt("2025-10-23T09:00:00Z"),
    roles: ["user"],
    moderation: { status: "active", bannedUntil: null, reason: null, updatedBy: null, updatedAt: null },
    createdAt: dt("2025-10-20T10:10:00Z"),
    updatedAt: dt("2025-10-23T09:00:00Z"),
  },
  {
    _id: oid("652000000000000000000004"),
    username: "admin",
    displayName: "Admin",
    email: "admin@example.com",
    passwordHash: "$argon2id$example",
    avatarUrl: null,
    bio: "Superadmin",
    settings: { privacy: "private", allowCommentsFrom: "friends", allowReactions: true },
    premium: { status: "none", expiresAt: null, plan: null, subscription: null, lastCheckedAt: null },
    presence: { status: "online", updatedAt: dt("2025-10-24T14:50:00Z") },
    lastSeenAt: dt("2025-10-24T14:50:00Z"),
    roles: ["superadmin"],
    moderation: { status: "active", bannedUntil: null, reason: null, updatedBy: null, updatedAt: null },
    createdAt: dt("2025-10-20T09:55:00Z"),
    updatedAt: dt("2025-10-24T14:50:00Z"),
  },
];

const friendships = [
  {
    _id: oid("659000000000000000000001"),
    userA: oid("652000000000000000000001"),
    userB: oid("652000000000000000000002"),
    requestedBy: oid("652000000000000000000001"),
    status: "accepted",
    blockedBy: null,
    acceptedAt: dt("2025-10-21T08:00:00Z"),
    createdAt: dt("2025-10-21T07:50:00Z"),
    updatedAt: dt("2025-10-21T08:00:00Z"),
  },
  {
    _id: oid("659000000000000000000002"),
    userA: oid("652000000000000000000001"),
    userB: oid("652000000000000000000003"),
    requestedBy: oid("652000000000000000000001"),
    status: "pending",
    blockedBy: null,
    acceptedAt: null,
    createdAt: dt("2025-10-22T10:00:00Z"),
    updatedAt: dt("2025-10-22T10:00:00Z"),
  },
];

const devices = [
  {
    _id: oid("65a000000000000000000001"),
    user: oid("652000000000000000000001"),
    platform: "ios",
    pushToken: "expo-token-alice-ios",
    appVersion: "1.0.0",
    lastActiveAt: dt("2025-10-24T14:40:00Z"),
    createdAt: dt("2025-10-20T12:00:00Z"),
    updatedAt: dt("2025-10-24T14:40:00Z"),
  },
  {
    _id: oid("65a000000000000000000002"),
    user: oid("652000000000000000000002"),
    platform: "android",
    pushToken: "fcm-token-bob-android",
    appVersion: "1.0.0",
    lastActiveAt: dt("2025-10-24T14:35:00Z"),
    createdAt: dt("2025-10-20T12:05:00Z"),
    updatedAt: dt("2025-10-24T14:35:00Z"),
  },
];

const sessions = [
  {
    _id: oid("66a000000000000000000001"),
    user: oid("652000000000000000000001"),
    device: oid("65a000000000000000000001"),
    platform: "ios",
    ip: "127.0.0.1",
    userAgent: "iOS-App/1.0",
    foreground: true,
    state: "online",
    createdAt: dt("2025-10-24T14:30:00Z"),
    lastHeartbeatAt: dt("2025-10-24T14:40:00Z"),
  },
  {
    _id: oid("66a000000000000000000002"),
    user: oid("652000000000000000000002"),
    device: oid("65a000000000000000000002"),
    platform: "android",
    ip: "127.0.0.1",
    userAgent: "Android-App/1.0",
    foreground: false,
    state: "background",
    createdAt: dt("2025-10-24T14:20:00Z"),
    lastHeartbeatAt: dt("2025-10-24T14:35:00Z"),
  },
];

const posts = [
  {
    _id: oid("656000000000000000000001"),
    author: oid("652000000000000000000001"),
    imageUrl: "https://example.com/photos/alice-1.jpg",
    caption: "Sáng nay nắng đẹp!",
    location: { name: "Hanoi", lat: 21.03, lng: 105.85 },
    visibility: "friends",
    reactionCount: 2,
    commentCount: 2,
    reactionCounts: { heart: 2 },
    deletedAt: null,
    createdAt: dt("2025-10-23T07:30:00Z"),
    updatedAt: dt("2025-10-23T08:00:00Z"),
  },
  {
    _id: oid("656000000000000000000002"),
    author: oid("652000000000000000000002"),
    imageUrl: "https://example.com/photos/bob-1.jpg",
    caption: "Cafe chiều",
    location: { name: "Da Nang", lat: 16.07, lng: 108.22 },
    visibility: "friends",
    reactionCount: 1,
    commentCount: 0,
    reactionCounts: { heart: 1 },
    deletedAt: null,
    createdAt: dt("2025-10-23T15:00:00Z"),
    updatedAt: dt("2025-10-23T15:10:00Z"),
  },
  {
    _id: oid("656000000000000000000003"),
    author: oid("652000000000000000000001"),
    imageUrl: "https://example.com/photos/alice-2.jpg",
    caption: "Tối đi dạo",
    location: null,
    visibility: "friends",
    reactionCount: 0,
    commentCount: 0,
    reactionCounts: {},
    deletedAt: null,
    createdAt: dt("2025-10-24T12:00:00Z"),
    updatedAt: dt("2025-10-24T12:00:00Z"),
  },
];

const comments = [
  {
    _id: oid("657000000000000000000001"),
    post: oid("656000000000000000000001"),
    author: oid("652000000000000000000002"),
    content: "Đẹp quá!",
    parentComment: null,
    mentions: [oid("652000000000000000000001")],
    isDeleted: false,
    createdAt: dt("2025-10-23T07:45:00Z"),
    updatedAt: dt("2025-10-23T07:45:00Z"),
  },
  {
    _id: oid("657000000000000000000002"),
    post: oid("656000000000000000000001"),
    author: oid("652000000000000000000001"),
    content: "Cảm ơn Bob!",
    parentComment: oid("657000000000000000000001"),
    mentions: [oid("652000000000000000000002")],
    isDeleted: false,
    createdAt: dt("2025-10-23T07:50:00Z"),
    updatedAt: dt("2025-10-23T07:50:00Z"),
  },
];

const reactions = [
  {
    _id: oid("658000000000000000000001"),
    post: oid("656000000000000000000001"),
    user: oid("652000000000000000000002"),
    type: "heart",
    createdAt: dt("2025-10-23T07:40:00Z"),
    updatedAt: dt("2025-10-23T07:40:00Z"),
  },
  {
    _id: oid("658000000000000000000002"),
    post: oid("656000000000000000000001"),
    user: oid("652000000000000000000001"),
    type: "heart",
    createdAt: dt("2025-10-23T07:41:00Z"),
    updatedAt: dt("2025-10-23T07:41:00Z"),
  },
  {
    _id: oid("658000000000000000000003"),
    post: oid("656000000000000000000002"),
    user: oid("652000000000000000000001"),
    type: "heart",
    createdAt: dt("2025-10-23T15:05:00Z"),
    updatedAt: dt("2025-10-23T15:05:00Z"),
  },
];

const notifications = [
  {
    _id: oid("65e000000000000000000001"),
    user: oid("652000000000000000000003"),
    actor: oid("652000000000000000000001"),
    type: "friend_request",
    post: null,
    comment: null,
    friendship: oid("659000000000000000000002"),
    message: "Alice đã gửi lời mời kết bạn",
    readAt: null,
    createdAt: dt("2025-10-22T10:00:10Z"),
    updatedAt: dt("2025-10-22T10:00:10Z"),
  },
  {
    _id: oid("65e000000000000000000002"),
    user: oid("652000000000000000000001"),
    actor: oid("652000000000000000000002"),
    type: "comment",
    post: oid("656000000000000000000001"),
    comment: oid("657000000000000000000001"),
    friendship: null,
    message: "Bob đã bình luận bài viết của bạn",
    readAt: dt("2025-10-23T08:10:00Z"),
    createdAt: dt("2025-10-23T07:45:10Z"),
    updatedAt: dt("2025-10-23T08:10:00Z"),
  },
  {
    _id: oid("65e000000000000000000003"),
    user: oid("652000000000000000000001"),
    actor: oid("652000000000000000000002"),
    type: "reaction",
    post: oid("656000000000000000000001"),
    comment: null,
    friendship: null,
    message: "Bob đã thả tim bài viết của bạn",
    readAt: dt("2025-10-23T08:10:00Z"),
    createdAt: dt("2025-10-23T07:41:10Z"),
    updatedAt: dt("2025-10-23T08:10:00Z"),
  },
];

const plans = [
  {
    _id: oid("653000000000000000000001"),
    code: "premium_monthly",
    name: "Premium Monthly",
    description: "Gói Premium theo tháng",
    price: 99000,
    currency: "VND",
    interval: "month",
    intervalCount: 1,
    trialDays: 7,
    features: { maxPostsPerDay: 10, noAds: true },
    isActive: true,
    providerMetadata: {},
    createdAt: dt("2025-10-20T09:00:00Z"),
    updatedAt: dt("2025-10-20T09:00:00Z"),
  },
];

const subscriptions = [
  {
    _id: oid("654000000000000000000001"),
    user: oid("652000000000000000000001"),
    plan: oid("653000000000000000000001"),
    status: "active",
    startAt: dt("2025-10-20T09:10:00Z"),
    currentPeriodStart: dt("2025-10-20T09:10:00Z"),
    currentPeriodEnd: dt("2025-11-20T09:10:00Z"),
    cancelAtPeriodEnd: false,
    canceledAt: null,
    autoRenew: true,
    provider: "manual",
    externalSubscriptionId: null,
    latestInvoice: oid("655000000000000000000001"),
    metadata: {},
    createdAt: dt("2025-10-20T09:10:00Z"),
    updatedAt: dt("2025-10-20T09:10:00Z"),
  },
];

const invoices = [
  {
    _id: oid("655000000000000000000001"),
    subscription: oid("654000000000000000000001"),
    user: oid("652000000000000000000001"),
    amount: 99000,
    currency: "VND",
    subtotalAmount: 99000,
    discountAmount: 0,
    taxAmount: 0,
    providerFeeAmount: 7000,
    platformFeeAmount: 2000,
    grossAmount: 99000,
    netAmount: 90000,
    status: "paid",
    periodStart: dt("2025-10-20T09:10:00Z"),
    periodEnd: dt("2025-11-20T09:10:00Z"),
    provider: "manual",
    externalInvoiceId: null,
    externalPaymentIntentId: null,
    paidAt: dt("2025-10-20T09:11:00Z"),
    failedAt: null,
    failureCode: null,
    failureMessage: null,
    metadata: {},
    createdAt: dt("2025-10-20T09:11:00Z"),
    updatedAt: dt("2025-10-20T09:11:00Z"),
  },
];

const refunds = [
  {
    _id: oid("655100000000000000000001"),
    invoice: oid("655000000000000000000001"),
    user: oid("652000000000000000000001"),
    amount: 20000,
    currency: "VND",
    status: "succeeded",
    reason: "partial_refund",
    provider: "manual",
    externalRefundId: null,
    refundedAt: dt("2025-10-22T10:30:00Z"),
    createdAt: dt("2025-10-22T10:30:00Z"),
    updatedAt: dt("2025-10-22T10:30:00Z"),
  },
];

const ads = [
  {
    _id: oid("65b000000000000000000001"),
    name: "Brand A - Feed Image",
    placement: "feed",
    imageUrl: "https://example.com/ads/brand-a.jpg",
    title: "Brand A",
    description: "Ưu đãi đặc biệt tháng này",
    ctaText: "Mua ngay",
    ctaUrl: "https://brand-a.example.com",
    priority: 10,
    isActive: true,
    startAt: dt("2025-10-20T00:00:00Z"),
    endAt: dt("2025-11-20T23:59:59Z"),
    impressionCount: 3,
    clickCount: 1,
    createdBy: oid("652000000000000000000004"),
    updatedBy: oid("652000000000000000000004"),
    createdAt: dt("2025-10-20T08:00:00Z"),
    updatedAt: dt("2025-10-24T14:45:00Z"),
  },
  {
    _id: oid("65b000000000000000000002"),
    name: "Brand B - Splash",
    placement: "splash",
    imageUrl: "https://example.com/ads/brand-b.jpg",
    title: "Brand B",
    description: "Khuyến mãi 50%",
    ctaText: "Khám phá",
    ctaUrl: "https://brand-b.example.com",
    priority: 5,
    isActive: true,
    startAt: dt("2025-10-20T00:00:00Z"),
    endAt: dt("2025-11-20T23:59:59Z"),
    impressionCount: 0,
    clickCount: 0,
    createdBy: oid("652000000000000000000004"),
    updatedBy: oid("652000000000000000000004"),
    createdAt: dt("2025-10-20T08:10:00Z"),
    updatedAt: dt("2025-10-20T08:10:00Z"),
  },
];

const ad_campaigns = [
  {
    _id: oid("65c000000000000000000001"),
    ad: oid("65b000000000000000000001"),
    advertiser: oid("652000000000000000000004"),
    pricingModel: "CPM",
    currency: "VND",
    cpmRate: 5000,
    cpcRate: null,
    flatTotal: null,
    budgetTotal: 1000000,
    dailyCapImpressions: 5000,
    dailyCapClicks: null,
    startAt: dt("2025-10-20T00:00:00Z"),
    endAt: dt("2025-11-20T23:59:59Z"),
    status: "active",
    impressionCount: 3,
    clickCount: 1,
    spendAmount: 0,
    createdAt: dt("2025-10-20T08:15:00Z"),
    updatedAt: dt("2025-10-24T14:45:00Z"),
  },
];

const ad_events = [
  {
    _id: oid("65c100000000000000000001"),
    campaign: oid("65c000000000000000000001"),
    ad: oid("65b000000000000000000001"),
    user: oid("652000000000000000000002"),
    type: "impression",
    at: dt("2025-10-24T12:10:00Z"),
    createdAt: dt("2025-10-24T12:10:00Z"),
  },
  {
    _id: oid("65c100000000000000000002"),
    campaign: oid("65c000000000000000000001"),
    ad: oid("65b000000000000000000001"),
    user: oid("652000000000000000000002"),
    type: "impression",
    at: dt("2025-10-24T12:20:00Z"),
    createdAt: dt("2025-10-24T12:20:00Z"),
  },
  {
    _id: oid("65c100000000000000000003"),
    campaign: oid("65c000000000000000000001"),
    ad: oid("65b000000000000000000001"), // fixed id to match existing Ad
    user: oid("652000000000000000000002"),
    type: "impression",
    at: dt("2025-10-24T12:25:00Z"),
    createdAt: dt("2025-10-24T12:25:00Z"),
  },
  {
    _id: oid("65c100000000000000000004"),
    campaign: oid("65c000000000000000000001"),
    ad: oid("65b000000000000000000001"),
    user: oid("652000000000000000000002"),
    type: "click",
    at: dt("2025-10-24T12:26:00Z"),
    createdAt: dt("2025-10-24T12:26:00Z"),
  },
];

const admin_audit_logs = [
  {
    _id: oid("65d000000000000000000001"),
    actor: oid("652000000000000000000004"),
    action: "grant_role",
    targetUser: oid("652000000000000000000001"),
    targetPost: null,
    targetComment: null,
    targetAd: null,
    details: { role: "moderator" },
    reason: "Promote active user",
    createdAt: dt("2025-10-21T09:00:00Z"),
  },
];

const revenue_snapshot_daily = [
  {
    _id: oid("65f000000000000000000001"),
    day: "2025-10-24",
    currency: "VND",
    subsGross: 99000,
    subsNet: 90000,
    subsTax: 0,
    subsProviderFees: 7000,
    subsPlatformFees: 2000,
    refunds: 20000,
    adsRevenue: 15,
    impressions: 3,
    clicks: 1,
    ctr: 0.3333,
    dau: 2,
    mau: 3,
    arpu: 35007.5,
    activeSubscribers: 1,
    newSubscribers: 1,
    canceledSubscribers: 0,
    churnRate: 0,
    mrr: 99000,
    arr: 1188000,
    createdAt: dt("2025-10-24T14:50:00Z"),
    updatedAt: dt("2025-10-24T14:50:00Z"),
  },
];

// --------------------- EXECUTION ---------------------

upserts("users", users);
upserts("friendships", friendships);
upserts("devices", devices);
upserts("sessions", sessions);
upserts("posts", posts);
upserts("comments", comments);
upserts("reactions", reactions);
upserts("notifications", notifications);
upserts("plans", plans);
upserts("subscriptions", subscriptions);
upserts("invoices", invoices);
upserts("refunds", refunds);
upserts("ads", ads);
upserts("ad_campaigns", ad_campaigns);
upserts("ad_events", ad_events);
upserts("admin_audit_logs", admin_audit_logs);
upserts("revenue_snapshot_daily", revenue_snapshot_daily);

print(`Done seeding database: ${DB_NAME}`);