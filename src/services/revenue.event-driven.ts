import { startOfDay, endOfDay, subDays } from 'date-fns';
import { Types } from 'mongoose';
import { Invoice } from '../models/invoice.model';
import { Refund } from '../models/refund.model';
import { AdEvent } from '../models/ad_event.model';
import { AdCampaign } from '../models/ad_campaign.model';
import { Subscription } from '../models/subscription.model';
import { Plan } from '../models/plan.model';
import { Session } from '../models/session.model';
import { RevenueSnapshotDaily } from '../models/revenue_snapshot_daily.model';

function dayKeyUTC(d: Date) {
  return d.toISOString().slice(0, 10); // yyyy-mm-dd
}

async function upsertDailyInc(day: string, inc: Record<string, number>) {
  await RevenueSnapshotDaily.updateOne(
    { day },
    {
      $setOnInsert: { currency: 'VND' },
      $inc: inc,
    },
    { upsert: true }
  ).exec();
}

/**
 * Gọi hàm này ngay khi đơn được đánh dấu paid.
 * Yêu cầu Invoice đã có: grossAmount, netAmount, taxAmount, providerFeeAmount, platformFeeAmount, paidAt.
 */
export async function recordInvoicePaid(invoiceId: Types.ObjectId) {
  const inv = await Invoice.findById(invoiceId).lean();
  if (!inv || inv.status !== 'paid' || !inv.paidAt) return;

  const day = dayKeyUTC(inv.paidAt);
  await upsertDailyInc(day, {
    subsGross: inv.grossAmount || 0,
    subsNet: inv.netAmount || 0,
    subsTax: inv.taxAmount || 0,
    subsProviderFees: inv.providerFeeAmount || 0,
    subsPlatformFees: inv.platformFeeAmount || 0,
  });
}

/**
 * Gọi hàm này khi hoàn tiền thành công.
 */
export async function recordRefundSucceeded(refundId: Types.ObjectId) {
  const rf = await Refund.findById(refundId).lean();
  if (!rf || rf.status !== 'APPROVED' || !rf.refundedAt) return;

  const day = dayKeyUTC(rf.refundedAt);
  await upsertDailyInc(day, {
    refunds: rf.amount || 0,
  });
}

/**
 * Ghi nhận ad event: impression/click. Có thể gọi từng event hoặc batch theo count.
 * Đồng thời cập nhật chiến dịch để có counter tổng.
 */
export async function recordAdEvent(campaignId: Types.ObjectId, adId: Types.ObjectId, type: 'impression' | 'click', at: Date, count = 1, userId?: Types.ObjectId) {
  // Lưu log sự kiện (tùy quy mô, bạn có thể skip log và chỉ tăng counter)
  await AdEvent.create({
    campaign: campaignId,
    ad: adId,
    user: userId ?? null,
    type,
    at,
  });

  // Cập nhật counters trong campaign
  if (type === 'impression') {
    await AdCampaign.updateOne({ _id: campaignId }, { $inc: { impressionCount: count } }).exec();
  } else {
    await AdCampaign.updateOne({ _id: campaignId }, { $inc: { clickCount: count } }).exec();
  }

  // Tính doanh thu ad theo pricing, tăng trực tiếp vào snapshot ngày
  const c = await AdCampaign.findById(campaignId).lean();
  if (!c) return;

  const day = dayKeyUTC(at);
  let inc: Record<string, number> = {};
  if (type === 'impression') {
    inc.impressions = count;
    if (c.pricingModel === 'CPM' && c.cpmRate) {
      inc.adsRevenue = (c.cpmRate * count) / 1000;
    }
  } else {
    inc.clicks = count;
    if (c.pricingModel === 'CPC' && c.cpcRate) {
      inc.adsRevenue = c.cpcRate * count;
    }
  }
  if (Object.keys(inc).length) {
    await upsertDailyInc(day, inc);
  }
}

/**
 * Tính phần doanh thu FLAT theo ngày (không cần cron):
 * Gọi hàm này khi mở dashboard của 1 ngày; nó sẽ cộng doanh thu per-day từ các FLAT campaigns vào snapshot ngày đó.
 * Idempotent: hàm này sẽ tính lại chính xác thay vì cộng dồn mù; nên ta dùng $set thay vì $inc cho phần FLAT add-on.
 */
async function ensureFlatAdsRevenueForDay(dayDate: Date) {
  const start = startOfDay(dayDate);
  const end = endOfDay(dayDate);
  const day = dayKeyUTC(dayDate);

  const flatCampaigns = await AdCampaign.find({
    pricingModel: 'FLAT',
    status: { $in: ['active', 'ended'] },
    startAt: { $ne: null },
    endAt: { $ne: null },
  }).lean();

  let flatRevenue = 0;
  for (const c of flatCampaigns) {
    if (!c.flatTotal || !c.startAt || !c.endAt) continue;
    const totalDays = Math.max(1, Math.ceil((c.endAt.getTime() - c.startAt.getTime()) / (24 * 3600 * 1000)));
    const perDay = c.flatTotal / totalDays;
    if (start <= c.endAt && end >= c.startAt) {
      flatRevenue += perDay;
    }
  }

  // Ghi vào snapshot: đặt một field phụ để đảm bảo idempotent
  await RevenueSnapshotDaily.updateOne(
    { day },
    {
      $setOnInsert: { currency: 'VND' },
      $set: { flatAdsRevenue: flatRevenue },
    },
    { upsert: true }
  ).exec();

  // Đồng bộ vào adsRevenue tổng (adsRevenue = adsRevenueCounters + flatAdsRevenue)
  const snap = await RevenueSnapshotDaily.findOne({ day }).lean();
  const baseCounters = (snap?.adsRevenue || 0) - (snap?.flatAdsRevenue || 0);
  const newTotal = baseCounters + flatRevenue;
  await RevenueSnapshotDaily.updateOne({ day }, { $set: { adsRevenue: newTotal } }).exec();
}

/**
 * Tính toán các chỉ số còn lại "khi cần" cho 1 ngày và cache vào snapshot.
 * Gọi khi frontend/dashboard mở báo cáo ngày đó. Không cần scripts.
 */
export async function getOrComputeDailySnapshot(dayDate: Date) {
  const day = dayKeyUTC(dayDate);
  const start = startOfDay(dayDate);
  const end = endOfDay(dayDate);

  // Đảm bảo flat revenue đã phản ánh vào snapshot
  await ensureFlatAdsRevenueForDay(dayDate);

  // Lấy snapshot hiện có (đã có các phần increment từ sự kiện)
  let snap = await RevenueSnapshotDaily.findOne({ day }).lean();

  // Tính DAU/MAU
  const dau = await Session.distinct('user', { lastHeartbeatAt: { $gte: start, $lte: end } }).then(a => a.length);
  const mauStart = subDays(end, 29);
  const mau = await Session.distinct('user', { lastHeartbeatAt: { $gte: mauStart, $lte: end } }).then(a => a.length);

  // Active Subscribers tại cuối ngày
  const activeSubscribers = await Subscription.countDocuments({
    status: { $in: ['trialing', 'active'] },
    currentPeriodEnd: { $gt: end },
  });

  // New/Canceled trong ngày
  const newSubscribers = await Subscription.countDocuments({ startAt: { $gte: start, $lte: end } });
  const canceledSubscribers = await Subscription.countDocuments({
    status: { $in: ['canceled', 'expired'] },
    canceledAt: { $gte: start, $lte: end },
  });

  // Active prev day để tính churn
  const prevEnd = endOfDay(subDays(dayDate, 1));
  const activePrevDay = await Subscription.countDocuments({
    status: { $in: ['trialing', 'active'] },
    currentPeriodEnd: { $gt: prevEnd },
  });
  const churnRate = activePrevDay > 0 ? canceledSubscribers / activePrevDay : 0;

  // ARPU = (subsNet - refunds + adsRevenue) / DAU
  snap = await RevenueSnapshotDaily.findOne({ day }).lean(); // refetch in case ensureFlat changed it
  const subsNet = snap?.subsNet || 0;
  const refunds = snap?.refunds || 0;
  const adsRevenue = snap?.adsRevenue || 0;
  const totalNet = Math.max(0, subsNet - refunds) + adsRevenue;
  const arpu = dau > 0 ? totalNet / dau : 0;

  // MRR/ARR ước tính: cộng theo Plan
  const activeSubs = await Subscription.find({
    status: { $in: ['trialing', 'active'] },
    currentPeriodEnd: { $gt: end },
  })
    .select({ plan: 1 })
    .lean();

  const planIds = Array.from(new Set(activeSubs.map(s => String(s.plan))));
  const plans = await Plan.find({ _id: { $in: planIds } }).lean();

  const normalizeToMonthly = (price: number, interval: 'day' | 'week' | 'month' | 'year', intervalCount: number) => {
    const days = interval === 'day' ? 1 : interval === 'week' ? 7 : interval === 'month' ? 30 : 365;
    const periodDays = days * Math.max(1, intervalCount || 1);
    return (price * 30) / periodDays;
    };
  const planMap = new Map(plans.map((p: any) => [String(p._id), p]));
  let mrr = 0;
  for (const s of activeSubs) {
    const p: any = planMap.get(String(s.plan));
    if (!p) continue;
    mrr += normalizeToMonthly(p.price, p.interval, p.intervalCount);
  }
  const arr = mrr * 12;

  // Lưu/cập nhật snapshot
  await RevenueSnapshotDaily.updateOne(
    { day },
    {
      $setOnInsert: { currency: 'VND' },
      $set: {
        dau,
        mau,
        arpu,
        activeSubscribers,
        newSubscribers,
        canceledSubscribers,
        churnRate,
        mrr,
        arr,
      },
    },
    { upsert: true }
  ).exec();

  return RevenueSnapshotDaily.findOne({ day }).lean();
}

/**
 * Gợi ý nơi gọi:
 *
 * - Khi đánh dấu invoice paid: await recordInvoicePaid(invoiceId)
 * - Khi refund thành công: await recordRefundSucceeded(refundId)
 * - Khi ghi nhận quảng cáo hiển thị/nhấp: await recordAdEvent(campaignId, adId, 'impression'|'click', new Date(), 1, userId?)
 * - Khi mở dashboard ngày D: const snap = await getOrComputeDailySnapshot(new Date('2025-10-24'))
 */