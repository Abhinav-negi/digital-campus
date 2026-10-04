import { z } from 'zod';

// CS-06: the JSON a chatbot returns (input) and the editable draft the preview returns / apply re-validates (D8).
// Input is lenient (chatbots send null for blanks, "9 am" for times); the draft is what the CR edits, so rows can carry an `issue`.

export const kinds = ['timetable', 'syllabus', 'datesheet'] as const;
export type Kind = (typeof kinds)[number];

const str = z.string().trim().min(1).max(200);
const opt = z.string().trim().max(200).nullish();
const num = z.union([z.string(), z.number()]);

export const input = {
  timetable: z.object({
    subjects: z.array(z.object({ name: str, code: opt, teacherName: opt })).max(40),
    slots: z.array(z.object({ subject: str, weekday: num, start: num, end: num, room: opt })).max(200),
  }),
  syllabus: z.object({ subjects: z.array(z.object({ name: str, units: z.array(str).max(30) })).max(40) }),
  datesheet: z.object({ exams: z.array(z.object({ subject: str, title: str, date: num, note: opt })).max(60) }),
};

export const issue = z.enum(['unmatched-teacher', 'bad-time', 'unknown-subject', 'bad-date']);
export type Issue = z.infer<typeof issue>;
const flag = { issue: issue.optional() };
const id = z.string().min(1).nullable();

export const draft = {
  timetable: z
    .object({
      subjects: z.array(z.object({ name: str, code: opt, teacherName: opt, teacherId: id, ...flag })).max(40),
      slots: z.array(z.object({ subject: str, weekday: z.number().int(), start: z.string(), end: z.string(), room: opt, ...flag })).max(200),
    })
    .meta({ id: 'TimetableDraft' }),
  syllabus: z.object({ subjects: z.array(z.object({ name: str, subjectId: id, units: z.array(str).max(30), ...flag })).max(40) }).meta({ id: 'SyllabusDraft' }),
  datesheet: z
    .object({ exams: z.array(z.object({ subject: str, subjectId: id, title: str, date: z.string(), note: opt, ...flag })).max(60) })
    .meta({ id: 'DatesheetDraft' }),
};

export const previewBody = z.object({ kind: z.enum(kinds), data: z.union([z.string().max(200_000), z.looseObject({})]) });
export const applyBody = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('timetable'), draft: draft.timetable }),
  z.object({ kind: z.literal('syllabus'), draft: draft.syllabus }),
  z.object({ kind: z.literal('datesheet'), draft: draft.datesheet }),
]);
export const summary = z.object({ counts: z.record(z.string(), z.number()), issues: z.record(z.string(), z.number()) });
