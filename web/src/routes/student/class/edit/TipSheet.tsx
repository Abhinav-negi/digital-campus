import { Sheet } from '../../../../ui/Sheet';

export type TipKind = 'timetable' | 'syllabus' | 'exam' | 'import';

/** First-time CR tip (SPEC §6). ponytail: buttons only report the pick; ST-03b/c and ST-05 decide where timetable/syllabus/import lead. */
export function TipSheet({ onPick, onClose }: { onPick: (k: TipKind) => void; onClose: () => void }) {
  return (
    <Sheet title="Set up your class" onClose={onClose}>
      <div className="stack">
        <p className="muted">Fill in the timetable, then the syllabus, then exam dates. Your classmates see it all as you go.</p>
        <button type="button" className="btn block" onClick={() => onPick('timetable')}>1. Timetable</button>
        <button type="button" className="btn block" onClick={() => onPick('syllabus')}>2. Syllabus</button>
        <button type="button" className="btn block" onClick={() => onPick('exam')}>3. Exam dates</button>
        <button type="button" className="btn primary block" onClick={() => onPick('import')}>Import from a PDF or photo</button>
      </div>
    </Sheet>
  );
}
