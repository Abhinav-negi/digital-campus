import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../lib/db.js';
import { HttpError, page, paginate, pageQuery } from '../../lib/http.js';
import { registry, route } from '../../lib/openapi.js';

// CS-12: the in-app inbox (SPEC §11). `text` and `link` are rendered here per type so clients stay thin.

const notification = z
  .object({ id: z.string(), type: z.string(), text: z.string(), link: z.string().nullable(), payload: z.record(z.string(), z.unknown()), read: z.boolean(), createdAt: z.iso.datetime() })
  .meta({ id: 'Notification' });

type Payload = Record<string, string | undefined>;

/** Where tapping a notification goes, as a route that exists in the web app; null when there is none (staff have no messages/commons screens). */
export const linkFor = (type: string, p: Payload, home: 's' | 't'): string | null => {
  const s = home === 's';
  if (p.conversationId) return s ? `/s/me/messages/${p.conversationId}` : null;
  if (p.ticketId) return s ? '/s/me' : null;
  if (p.projectId || p.challengeId) return s ? '/s/commons/build' : null;
  if (p.postId && type !== 'post') return s ? '/s/commons' : null;
  if (type === 'post' && s) return '/s/class/posts';
  if (type === 'class-change') return s ? '/s' : '/t';
  if (type === 'attendance-low' || type === 'attendance-digest') return s ? '/s/class/attendance' : '/t';
  if (type === 'exam-reminder' || type === 'deadline-reminder') return s ? '/s' : '/t/upcoming';
  return p.classId ? (s ? '/s/class' : `/t/classes/${p.classId}`) : null;
};

const body = z.object({ muted: z.array(z.string().trim().min(1).max(50)).max(100) });
const readBody = z.union([z.object({ ids: z.array(z.string().min(1)).min(1).max(200) }), z.object({ all: z.literal(true) })]);

export const notificationsRouter = Router();

notificationsRouter.get(
  '/notifications',
  route(registry, {
    method: 'get',
    path: '/me/notifications',
    summary: 'My inbox, newest first, with the unread count',
    guard: 'auth',
    request: { query: pageQuery },
    responses: { 200: z.object({ items: z.array(notification), nextCursor: z.string().nullable(), unreadCount: z.number().int() }) },
  }),
  async (req, res) => {
    const me = req.user!;
    const { cursor, limit } = req.query as unknown as z.infer<typeof pageQuery>;
    const [rows, unreadCount] = await Promise.all([
      db.notification.findMany({ where: { userId: me.id }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], ...paginate(cursor, limit) }),
      db.notification.count({ where: { userId: me.id, readAt: null } }),
    ]);
    const p = page(rows, limit);
    const items = p.items.map((n) => {
      const payload = n.payload as Payload;
      return { id: n.id, type: n.type, text: payload.text ?? n.type, link: linkFor(n.type, payload, me.role === 'staff' ? 't' : 's'), payload, read: !!n.readAt, createdAt: n.createdAt.toISOString() };
    });
    res.json({ items, nextCursor: p.nextCursor, unreadCount });
  },
);

notificationsRouter.post(
  '/notifications/read',
  route(registry, {
    method: 'post',
    path: '/me/notifications/read',
    summary: 'Mark some (ids) or all of my notifications read',
    guard: 'auth',
    request: { body: readBody },
    responses: { 200: z.object({ unreadCount: z.number().int() }) },
  }),
  async (req, res) => {
    const b = req.body as z.infer<typeof readBody>;
    const userId = req.user!.id;
    await db.notification.updateMany({ where: { userId, readAt: null, ...('ids' in b && { id: { in: b.ids } }) }, data: { readAt: new Date() } });
    res.json({ unreadCount: await db.notification.count({ where: { userId, readAt: null } }) });
  },
);

const prefs = z.object({ muted: z.array(z.string()) });

notificationsRouter.get(
  '/notification-prefs',
  route(registry, { method: 'get', path: '/me/notification-prefs', summary: 'The notification types I muted', guard: 'auth', responses: { 200: prefs } }),
  async (req, res) => {
    res.json({ muted: (await db.user.findUniqueOrThrow({ where: { id: req.user!.id }, select: { mutedTypes: true } })).mutedTypes });
  },
);

notificationsRouter.put(
  '/notification-prefs',
  route(registry, {
    method: 'put',
    path: '/me/notification-prefs',
    summary: 'Replace the muted types; class-change cannot be muted (422)',
    guard: 'auth',
    request: { body },
    responses: { 200: prefs },
  }),
  async (req, res) => {
    const muted = [...new Set((req.body as z.infer<typeof body>).muted)];
    if (muted.includes('class-change')) throw new HttpError(422, 'VALIDATION', 'Class changes cannot be muted');
    await db.user.update({ where: { id: req.user!.id }, data: { mutedTypes: muted } });
    res.json({ muted });
  },
);
