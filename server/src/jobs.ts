import cron from 'node-cron';
import { config } from './config.js';
import { addDays, today } from './lib/dates.js';
import { db } from './lib/db.js';
import { notify } from './lib/notify.js';
import { standing } from './modules/attendance/routes.js';

// CS-12: scheduled jobs (ARCH §11). Each takes `now` so tests can pin the date, and is idempotent per day:
// a recipient who already has the same notification (same item/post/day) is skipped.

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Of `userIds`, those without a `type` notification whose payload matches `key`. */
const withoutSeen = async (userIds: string[], type: string, key: Record<string, string | number>) => {
  const seen = await db.notification.findMany({
    where: { type, userId: { in: userIds }, AND: Object.entries(key).map(([k, v]) => ({ payload: { path: [k], equals: v } })) },
    select: { userId: true },
  });
  const done = new Set(seen.map((n) => n.userId));
  return userIds.filter((id) => !done.has(id));
};

/** 07:00 — exams and deadlines exactly 3 and 1 days away → the class's students + the subject teacher. */
export const examReminders = async (now: Date) => {
  const day = today(undefined, now);
  let sent = 0;
  for (const days of [3, 1]) {
    const items = await db.boardItem.findMany({
      where: { kind: { in: ['exam', 'deadline'] }, date: addDays(day, days), term: { endedAt: null } },
      include: { subject: { select: { name: true, teacherId: true } } },
    });
    for (const item of items) {
      const members = await db.classMember.findMany({ where: { classId: item.classId, role: { in: ['student', 'cr'] } }, select: { userId: true } });
      const to = await withoutSeen([...members.map((m) => m.userId), ...(item.subject?.teacherId ? [item.subject.teacherId] : [])], `${item.kind}-reminder`, { boardItemId: item.id, days });
      const text = `${item.title}${item.subject ? ` (${item.subject.name})` : ''} is ${days === 1 ? 'tomorrow' : `in ${days} days`}`;
      sent += (await notify(to, `${item.kind}-reminder`, { text, classId: item.classId, boardItemId: item.id, days, date: iso(item.date!) })).count;
    }
  }
  return sent;
};

/** 07:05 — open board posts expiring in 2 days → the poster. Extending moves expiresAt, so a later expiry nudges again. */
export const boardExpiryNudges = async (now: Date) => {
  const on = addDays(today(undefined, now), 2);
  const posts = await db.boardPost.findMany({ where: { status: 'open', hiddenAt: null, expiresAt: on }, select: { id: true, authorId: true, title: true } });
  let sent = 0;
  for (const p of posts) {
    const to = await withoutSeen([p.authorId], 'board-expiring', { postId: p.id, expiresAt: iso(on) });
    sent += (await notify(to, 'board-expiring', { text: `Your post "${p.title}" expires in 2 days. Still need this? Extend · Close`, postId: p.id, expiresAt: iso(on), actions: ['extend', 'close'] })).count;
  }
  return sent;
};

/** 03:00 — unaccepted invites that expired and were created over 30 days ago. */
export const cleanInvites = async (now: Date) =>
  (await db.invite.deleteMany({ where: { acceptedAt: null, expiresAt: { lt: now }, createdAt: { lt: addDays(now, -30) } } })).count;

/**
 * 07:10 — students below a class's minimum attendance get one digest of their subjects.
 * Only on change (the set of subjects differs from their last digest) and at most once a week.
 */
export const attendanceDigest = async (now: Date) => {
  const subjects = await db.subject.findMany({ where: { term: { endedAt: null }, class: { archivedAt: null } }, select: { id: true, name: true, classId: true, class: { select: { minAttendancePct: true } } } });
  const low = new Map<string, { id: string; name: string; pct: number }[]>();
  for (const s of subjects) {
    const members = await db.classMember.findMany({ where: { classId: s.classId, role: { in: ['student', 'cr'] } }, select: { userId: true } });
    const stand = await standing(s.id, members.map((m) => m.userId), s.class.minAttendancePct);
    for (const [userId, a] of stand) if (a.total && a.pct < s.class.minAttendancePct) low.set(userId, [...(low.get(userId) ?? []), { id: s.id, name: s.name, pct: a.pct }]);
  }
  let sent = 0;
  for (const [userId, list] of low) {
    const last = await db.notification.findFirst({ where: { userId, type: 'attendance-digest' }, orderBy: { createdAt: 'desc' } });
    const ids = list.map((l) => l.id).sort();
    if (last && (last.createdAt >= addDays(now, -7) || (last.payload as { subjectIds: string[] }).subjectIds.join() === ids.join())) continue;
    const text = `Attendance is below the minimum in ${list.map((l) => `${l.name} (${l.pct}%)`).join(', ')}`;
    sent += (await notify([userId], 'attendance-digest', { text, subjectIds: ids, subjects: list })).count;
  }
  return sent;
};

export function start() {
  if (config.NODE_ENV === 'test') return;
  const at = (expr: string, job: (now: Date) => Promise<unknown>) =>
    cron.schedule(expr, () => void job(new Date()).catch((e) => console.error('job failed', e)), { timezone: config.INSTITUTION_TZ });
  at('0 7 * * *', examReminders);
  at('5 7 * * *', boardExpiryNudges);
  at('0 3 * * *', cleanInvites);
  at('10 7 * * *', attendanceDigest);
}
