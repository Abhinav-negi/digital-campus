import { Avatar } from '../../../ui/Avatar';
import type { AttendanceSession } from '../queries';

// PROTO teacher.html:228-229. Everyone starts present; a tap toggles absent.
export function Roster({ roster, absent, onToggle }: { roster: AttendanceSession['roster']; absent: Set<string>; onToggle: (id: string) => void }) {
  return (
    <div className="roster">
      {roster.map((s) => {
        const abs = absent.has(s.id);
        return (
          <button key={s.id} type="button" className={abs ? 'tile absent' : 'tile'} aria-pressed={abs} onClick={() => onToggle(s.id)}>
            <Avatar user={s} size="sm" />
            <span className="roll">{(s.rollNo ?? '').slice(-3)}</span>
            <span className="nm">{s.name.split(' ')[0]}</span>
            <span className="st">{abs ? 'Absent' : 'Present'}</span>
          </button>
        );
      })}
    </div>
  );
}
