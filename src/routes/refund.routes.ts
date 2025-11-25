import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import { submitRefund } from '../controllers/refund.controller';

const router = Router();

// User submit refund request (yêu cầu authentication)
router.post('/', requireAuth, submitRefund);

export default router;


