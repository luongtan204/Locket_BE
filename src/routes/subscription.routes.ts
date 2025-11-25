import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import { handleInstantPurchase } from '../controllers/subscription.controller';

const router = Router();

// Purchase subscription (instant, skip payment)
router.post('/purchase', requireAuth, handleInstantPurchase);

export default router;

