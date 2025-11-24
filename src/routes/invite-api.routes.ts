import { Router } from 'express';
import * as inviteController from '../controllers/invite.controller';

const router = Router();

/**
 * POST /api/invites/resolve
 * API resolve username thành user info (cho mobile app)
 * Body: { username: string }
 */
router.post('/resolve', inviteController.resolveInviteUser);

export default router;

