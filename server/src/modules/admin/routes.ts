import { Router } from 'express';
import { admin } from '../../lib/auth.js';
import { notImplemented } from '../../lib/http.js';
import audit from './audit.js';
import badge from './badge.js';
import featured from './featured.js';
import inbox from './inbox.js';
import overview from './overview.js';
import school from './school.js';
import students from './students.js';
import users from './users.js';

// Aggregator (ORCHESTRATOR §6): a task adds one import + one `router.use(sub)` line above the stub.
const router = Router();
router.use(admin()); // Every /admin route is admins-only (ARCH §3).
router.use(users);
router.use(badge);
router.use(school);
router.use(inbox);
router.use(students);
router.use(audit);
router.use(overview);
router.use(featured);
router.use(notImplemented);
export default router;
