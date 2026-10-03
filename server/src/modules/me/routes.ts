import { Router } from 'express';
import { auth } from '../../lib/auth.js';
import { notImplemented } from '../../lib/http.js';

// Aggregator (ORCHESTRATOR §6): a task adds one import + one `router.use(sub)` line above the stub.
const router = Router();
router.use(auth()); // Every /me route needs a session.
router.use(notImplemented);
export default router;
