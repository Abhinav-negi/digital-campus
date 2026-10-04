import type { Kind } from './schemas.js';

// CS-06: the text the CR pastes into any chatbot together with their PDF/photo (D8).

const RULES = `Reply with ONLY the JSON, no explanation. Use 24-hour times as "HH:MM" and weekday names ("Monday".."Saturday"). Use null for anything you cannot read; never guess.`;

const prompts: Record<Kind, string> = {
  timetable: `Read the attached class timetable and extract every period.
${RULES}
Shape: {"subjects":[{"name":string,"code":string|null,"teacherName":string|null}],"slots":[{"subject":string,"weekday":string,"start":"HH:MM","end":"HH:MM","room":string|null}]}
Each slot's "subject" must be a "name" from "subjects". List each subject once.
Example: {"subjects":[{"name":"Data Structures","code":"CS201","teacherName":"Dr. Meera Iyer"}],"slots":[{"subject":"Data Structures","weekday":"Monday","start":"09:00","end":"10:00","room":"LH-3"}]}`,
  syllabus: `Read the attached syllabus and list, for each subject, its units/topics in order (one short string per unit).
${RULES}
Shape: {"subjects":[{"name":string,"units":[string]}]}
Example: {"subjects":[{"name":"Data Structures","units":["Arrays and linked lists","Stacks and queues","Trees"]}]}`,
  datesheet: `Read the attached exam date sheet and extract every exam.
${RULES}
Dates as "YYYY-MM-DD".
Shape: {"exams":[{"subject":string,"title":string,"date":"YYYY-MM-DD","note":string|null}]}
Example: {"exams":[{"subject":"Data Structures","title":"Mid-term exam","date":"2026-11-05","note":"10:00-12:00, Hall B"}]}`,
};

export default prompts;
