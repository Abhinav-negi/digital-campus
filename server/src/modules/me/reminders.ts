import { Router } from 'express';
import { z } from 'zod';
import { staff } from '../../lib/auth.js';
import { today } from '../../lib/dates.js';
import { db } from '../../lib/db.js';
import { HttpError } from '../../lib/http.js';
import { registry, route } from '../../lib/openapi.js';

// CS-11: a teacher's private reminders ("set the question paper"): visible only to their author, no audit, no notification.

const reminder = z.object({ id: z.string(), title: z.string(), date: z.iso.date() }).meta({ id: 'Reminder' });
const view = (r: { id: string; title: string; date: Date }) => ({ id: r.id, title: r.title, date: r.date.toISOString().slice(0, 10) });
const body = z.object({ title: z.string().trim().min(1).max(200), date: z.iso.date() });

export const remindersRouter = Router();
remindersRouter.use('/reminders', staff());

remindersRouter.get(
  '/reminders',
  route(registry, {
    method: 'get',
    path: '/me/reminders',
    summary: 'My private reminders from today on, soonest first (staff)',
    guard: 'auth',
    responses: { 200: z.object({ items: z.array(reminder) }), 403: null },
  }),
  async (req, res) => {
    const rows = await db.reminder.findMany({ where: { teacherId: req.user!.id, date: { gte: today() } }, orderBy: [{ date: 'asc' }, { createdAt: 'asc' }] });
    res.json({ items: rows.map(view) });
  },
);

remindersRouter.post(
  '/reminders',
  route(registry, {
    method: 'post',
    path: '/me/reminders',
    summary: 'Add a private reminder (staff)',
    guard: 'auth',
    request: { body },
    responses: { 201: reminder, 403: null },
  }),
  async (req, res) => {
    const b = req.body as z.infer<typeof body>;
    res.status(201).json(view(await db.reminder.create({ data: { teacherId: req.user!.id, title: b.title, date: new Date(b.date) } })));
  },
);

remindersRouter.delete(
  '/reminders/:id',
  route(registry, {
    method: 'delete',
    path: '/me/reminders/:id',
    summary: 'Delete one of my reminders (staff); someone else\'s is a 404',
    guard: 'auth',
    request: { params: z.object({ id: z.string().min(1) }) },
    responses: { 204: null, 403: null, 404: null },
  }),
  async (req, res) => {
    const { count } = await db.reminder.deleteMany({ where: { id: String(req.params.id), teacherId: req.user!.id } });
    if (!count) throw new HttpError(404, 'NOT_FOUND', 'Reminder not found');
    res.status(204).end();
  },
);
