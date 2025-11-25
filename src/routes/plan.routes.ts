import { Router } from 'express';
import { getPublicPlans } from '../controllers/plan.controller';

const router = Router();

// Public route - không cần authentication
router.get('/', getPublicPlans);

export default router;

