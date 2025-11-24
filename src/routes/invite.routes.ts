import { Router } from 'express';
import * as inviteController from '../controllers/invite.controller';

const router = Router();

/**
 * GET /invite/:username
 * Trả về HTML page cho invite link với deep linking
 * Không cần authentication
 */
router.get('/:username', inviteController.getInvitePage);

export default router;

