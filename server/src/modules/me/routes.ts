import { Router } from 'express';
import { auth } from '../../lib/auth.js';
import { notImplemented } from '../../lib/http.js';
import { deleteMeRouter } from '../admin/users.js';
import { meProfileRouter } from '../commons/profiles.js';

// Aggregator (ORCHESTRATOR §6): a task adds one import + one `router.use(sub)` line above the stub.
const router = Router();
router.use(auth()); // Every /me route needs a session.
router.use(deleteMeRouter);
router.use(meProfileRouter);
router.use(notImplemented);
export default router;
