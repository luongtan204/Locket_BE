import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/authorize';
import { adminUserController } from '../controllers/admin_user.controller';
import { adminPostController } from '../controllers/admin_post.controller';
import { adminPlanController } from '../controllers/admin_plan.controller';
import { adminRefundController } from '../controllers/admin_refund.controller';
import { adminReportController } from '../controllers/admin_report.controller';
import { adminAdController } from '../controllers/admin_ad.controller';
import { list, getById } from '../controllers/admin_audit_log.controller';

const router = Router();

router.use(requireAuth, authorize(['admin', 'superadmin']));

// User Management
router.put('/users/:userId/ban', (req, res, next) => adminUserController.banUser(req, res, next));
router.put('/users/:userId/unban', (req, res, next) => adminUserController.unbanUser(req, res, next));

// Content Management
router.delete('/posts/:postId', (req, res, next) => adminPostController.deletePost(req, res, next));

// Plan Management
router.post('/plans', (req, res, next) => adminPlanController.createPlan(req, res, next));
router.put('/plans/:planId', (req, res, next) => adminPlanController.updatePlan(req, res, next));
router.delete('/plans/:planId', (req, res, next) => adminPlanController.deactivatePlan(req, res, next));
router.put('/plans/:planId/activate', (req, res, next) => adminPlanController.activatePlan(req, res, next));

// Refund Management
router.put('/refunds/:refundId/process', (req, res, next) => adminRefundController.handleRefund(req, res, next));

// Reports
router.get('/reports/revenue', (req, res, next) => adminReportController.getRevenueReport(req, res, next));
router.get('/reports/ad_performance', (req, res, next) => adminReportController.getPerformanceReport(req, res, next));

// Ad Management
router.post('/ads', (req, res, next) => adminAdController.createAd(req, res, next));
router.put('/ads/:adId/status', (req, res, next) => adminAdController.updateAdStatus(req, res, next));

// Audit Logs
router.get('/audit-logs', list);
router.get('/audit-logs/:id', getById);

export default router;

