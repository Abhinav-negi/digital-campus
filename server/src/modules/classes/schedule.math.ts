import { dow } from '../../lib/dates.js';

// CS-05 pure schedule maths (ARCH §9.3, D10–D11): no DB. CS-11 (Today) reuses it.
// Times are "HH:MM" strings (institution tz), so string comparison orders them. Dates are UTC-midnight Dates.

export type Slot = { id: string; classId: string; subjectId: string; teacherId: string | null; weekday: number; start: string; end: string; room: string | null };
export type Change = {
  id: string;
  classId: string;
  kind: 'cancelled' | 'moved' | 'extra' | 'event';
  date: Date;
  slotId: string | null;
  subjectId: string | null;
  /** The subject's teacher (for a cancel/move, the slot's). */
  teacherId: string | null;
  title: string | null;
  start: string | null;
  end: string | null;
  room: string | null;
  movedToDate: Date | null;
};
export type Item<C extends Change = Change> = {
  /** Slot id for a plain or cancelled slot; change id for anything a change puts on the day (extra, event, moved). */
  id: string;
  kind: 'class' | 'extra' | 'event';
  classId: string;
  slotId: string | null;
  subjectId: string | null;
  teacherId: string | null;
  title: string | null;
  start: string;
  end: string;
  room: string | null;
  /** Shown but not happening: cancelled, or moved to another date. Never clashes. */
  off: boolean;
  change: C | null;
  /** Ids of the items it overlaps. */
  clashWith: string[];
};

const same = (a: Date | null, b: Date) => a?.getTime() === b.getTime();
const overlap = (a: Item, b: Item) => a.start < b.end && b.start < a.end;

/** Adds to each item's `clashWith` every other live item that overlaps it and matches `related`. */
const mark = <I extends Item>(items: I[], related: (a: I, b: I) => boolean): I[] =>
  items.map((a) => ({
    ...a,
    clashWith: [...new Set([...a.clashWith, ...items.filter((b) => b !== a && !a.off && !b.off && related(a, b) && overlap(a, b)).map((b) => b.id)])],
  }));

/** Overlaps within the same class. */
export const clashes = <I extends Item>(items: I[]) => mark(items, (a, b) => a.classId === b.classId);

/** The same teacher in two places at once; pass one day's items across classes (e.g. a teacher's Today). */
export const teacherClashes = <I extends Item>(items: I[]) => mark(items, (a, b) => !!a.teacherId && a.teacherId === b.teacherId);

/**
 * One class's effective day (ARCH §9.3): the weekly slots for `dow(date)`, a cancelled slot kept as `off`, a slot moved
 * to another date kept as `off` (and shown on that date at its new time), a slot moved within the day shown only at its
 * new time, plus extras and events. Sorted by start, with in-class clashes marked.
 * `slots` = the term's slots (any weekday: a move can land on another one); `changes` may hold other dates too.
 */
export const daySchedule = <C extends Change>(slots: Slot[], changes: C[], date: Date): Item<C>[] => {
  const items: Item<C>[] = [];
  const fromSlot = (s: Slot, change: C | null, off: boolean): Item<C> => ({
    id: s.id,
    kind: 'class',
    classId: s.classId,
    slotId: s.id,
    subjectId: s.subjectId,
    teacherId: s.teacherId,
    title: null,
    start: s.start,
    end: s.end,
    room: s.room,
    off,
    change,
    clashWith: [],
  });
  for (const s of slots) {
    if (s.weekday !== dow(date)) continue;
    const c = changes.findLast((c) => c.slotId === s.id && same(c.date, date) && (c.kind === 'cancelled' || c.kind === 'moved')) ?? null;
    if (c?.kind === 'moved' && same(c.movedToDate ?? c.date, date)) continue; // shown at its new time below
    items.push(fromSlot(s, c, !!c));
  }
  for (const c of changes) {
    if (c.kind === 'cancelled') continue;
    if (c.kind === 'moved') {
      const s = slots.find((x) => x.id === c.slotId);
      if (s && same(c.movedToDate ?? c.date, date))
        items.push({ ...fromSlot(s, c, false), id: c.id, start: c.start ?? s.start, end: c.end ?? s.end, room: c.room ?? s.room });
    } else if (same(c.date, date) && c.start && c.end) {
      items.push({ id: c.id, kind: c.kind, classId: c.classId, slotId: null, subjectId: c.subjectId, teacherId: c.teacherId, title: c.title, start: c.start, end: c.end, room: c.room, off: false, change: c, clashWith: [] });
    }
  }
  return clashes(items.sort((a, b) => a.start.localeCompare(b.start)));
};
