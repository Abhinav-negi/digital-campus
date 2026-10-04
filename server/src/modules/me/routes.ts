import { Router } from 'express';
import { auth } from '../../lib/auth.js';
import { notImplemented } from '../../lib/http.js';
import { deleteMeRouter } from '../admin/users.js';
import { meProfileRouter } from '../commons/profiles.js';
import { remindersRouter } from './reminders.js';
import { todayRouter } from './today.js';
import { upcomingRouter } from './upcoming.js';

// Aggregator (ORCHESTRATOR §6): a task adds one import + one `router.use(sub)` line above the stub.
const router = Router();
router.use(auth()); // Every /me route needs a session.
router.use(deleteMeRouter);
router.use(meProfileRouter);
router.use(todayRouter);
router.use(upcomingRouter);
router.use(remindersRouter);
router.use(notImplemented);
export default router;
