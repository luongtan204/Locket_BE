import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/authorize';
import { adminUserController } from '../controllers/admin_user.controller';
import { adminPostController } from '../controllers/admin_post.controller';
import { list, getById } from '../controllers/admin_audit_log.controller';

const router = Router();

router.use(requireAuth, authorize(['admin', 'superadmin']));

// User Management
router.put('/users/:userId/ban', (req, res, next) => adminUserController.banUser(req, res, next));
router.put('/users/:userId/unban', (req, res, next) => adminUserController.unbanUser(req, res, next));

// Content Management
router.delete('/posts/:postId', (req, res, next) => adminPostController.deletePost(req, res, next));

// Audit Logs
router.get('/audit-logs', list);
router.get('/audit-logs/:id', getById);

export default router;

