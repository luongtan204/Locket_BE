import { Router } from 'express';
import multer from 'multer';
import { cleanupImage } from '../controllers/cleanup.controller';

const router = Router();
const upload = multer({ dest: 'uploads/' });

router.post('/', upload.fields([{ name: 'image' }, { name: 'mask' }]), cleanupImage);

export default router;
