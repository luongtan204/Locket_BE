import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/authorize';
import { adminUserController } from '../controllers/admin_user.controller';
import { adminPostController } from '../controllers/admin_post.controller';
import { adminPlanController } from '../controllers/admin_plan.controller';
import { adminRefundController } from '../controllers/admin_refund.controller';
import { adminReportController } from '../controllers/admin_report.controller';
import { adminAdController } from '../controllers/admin_ad.controller';
import { adminMediaController } from '../controllers/admin_media.controller';
import { adminDashboardController } from '../controllers/admin_dashboard.controller';
import { list, getById } from '../controllers/admin_audit_log.controller';

const router = Router();

// Cấu hình multer cho upload ảnh
type MulterFile = Express.Multer.File & {
  buffer: Buffer;
};

const storage = multer.memoryStorage();

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

router.use(requireAuth, authorize(['admin', 'superadmin']));

// Dashboard Summary
router.get('/dashboard/summary', (req, res, next) => adminDashboardController.getSummary(req, res, next));
router.get('/dashboard/daily-revenue', (req, res, next) => adminDashboardController.getDailyRevenue(req, res, next));

// User Management
router.get('/users', (req, res, next) => adminUserController.getUsers(req, res, next));
router.put('/users/:userId/ban', (req, res, next) => adminUserController.banUser(req, res, next));
router.put('/users/:userId/unban', (req, res, next) => adminUserController.unbanUser(req, res, next));

// Content Management
router.get('/posts', (req, res, next) => adminPostController.getPosts(req, res, next));
router.delete('/posts/:postId', (req, res, next) => adminPostController.deletePost(req, res, next));

// Plan Management
router.get('/plans', (req, res, next) => adminPlanController.getPlans(req, res, next));
router.post('/plans', (req, res, next) => adminPlanController.createPlan(req, res, next));
router.put('/plans/:planId', (req, res, next) => adminPlanController.updatePlan(req, res, next));
router.delete('/plans/:planId', (req, res, next) => adminPlanController.deactivatePlan(req, res, next));
router.put('/plans/:planId/activate', (req, res, next) => adminPlanController.activatePlan(req, res, next));

// Refund Management
router.get('/refunds/pending', (req, res, next) => adminRefundController.getPendingRefunds(req, res, next));
router.put('/refunds/:refundId/process', (req, res, next) => adminRefundController.handleRefund(req, res, next));

// Reports
router.get('/reports/revenue', (req, res, next) => adminReportController.getRevenueReport(req, res, next));
router.get('/reports/ad_performance', (req, res, next) => adminReportController.getPerformanceReport(req, res, next));

// Ad Management
router.get('/ads', (req, res, next) => adminAdController.getAds(req, res, next));
router.post('/ads', (req, res, next) => adminAdController.createAd(req, res, next));
router.put('/ads/:adId', (req, res, next) => adminAdController.updateAd(req, res, next));
router.put('/ads/:adId/status', (req, res, next) => adminAdController.updateAdStatus(req, res, next));

// Media Upload
router.post('/upload/ad-image', upload.single('image'), (req, res, next) => 
  adminMediaController.handleAdImageUpload(req, res, next)
);

// Audit Logs
router.get('/audit-logs', list);
router.get('/audit-logs/:id', getById);

export default router;

