import { Router } from 'express';
import { commons } from '../../lib/auth.js';
import { notImplemented } from '../../lib/http.js';
import profiles from './profiles.js';

// Stub (FND-01): every request 501s until the owning task replaces this file.
const router = Router();
router.use(commons()); // The wall (ARCH §3): every Commons route sits behind it.
router.use(profiles);
router.use(notImplemented);
export default router;
