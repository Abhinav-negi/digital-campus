import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '../../../../api/client';
import { useMe } from '../../../../api/hooks';
import { Sheet } from '../../../../ui/Sheet';

export type TipKind = 'timetable' | 'syllabus' | 'exam' | 'import';

/** First-time CR tip (SPEC §6), shown only while the class board is empty (PARITY 9). ponytail: buttons only report the pick; ST-03b/c and ST-05 decide where timetable/syllabus/import lead. */
export function TipSheet({ onPick, onClose }: { onPick: (k: TipKind) => void; onClose: () => void }) {
  const id = useMe().data?.classes.find((c) => c.role === 'cr')?.id ?? '';
  const board = useQuery({ queryKey: ['classes', id, 'board', 'tip'], enabled: !!id, queryFn: () => unwrap(api.GET('/classes/{id}/board', { params: { path: { id }, query: {} } })) });
  if (!board.data || Object.values(board.data).some((a) => a.length)) return null;
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
