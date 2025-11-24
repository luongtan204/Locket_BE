import { Router } from 'express';
import authRoutes from './auth.routes';
import postRoutes from './post.routes';
import feedRoutes from './feed.routes';
import friendshipRoutes from './friendship.routes';
import commentRoutes from './comment.routes';
import chatRoutes from './chat.routes';
import userRoutes from './user.routes';
import adminRoutes from './admin.routes';
import inviteApiRoutes from './invite-api.routes';

const router = Router();

router.get('/health', (_req, res) => res.json({ ok: true }));
router.use('/auth', authRoutes);
router.use('/posts', postRoutes);
router.use('/feed', feedRoutes);
router.use('/friendships', friendshipRoutes);
router.use('/comments', commentRoutes);
router.use('/chat', chatRoutes);
router.use('/users', userRoutes);
router.use('/admin', adminRoutes);
router.use('/invites', inviteApiRoutes);

export default router;
