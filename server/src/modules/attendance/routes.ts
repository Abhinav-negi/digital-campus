import { Router } from 'express';
import { notImplemented } from '../../lib/http.js';

// Stub (FND-01): every request 501s until the owning task replaces this file.
const router = Router();
router.use(notImplemented);
export default router;
