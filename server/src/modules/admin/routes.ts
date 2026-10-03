import { Router } from 'express';
import { admin } from '../../lib/auth.js';
import { notImplemented } from '../../lib/http.js';

// Aggregator (ORCHESTRATOR §6): a task adds one import + one `router.use(sub)` line above the stub.
const router = Router();
router.use(admin()); // Every /admin route is admins-only (ARCH §3).
router.use(notImplemented);
export default router;
