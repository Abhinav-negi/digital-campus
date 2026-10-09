import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '../../../api/client';
import { Board } from '../../student/class/Board';
import { EditToggle } from '../../student/class/edit/EditToggle';
import { History } from '../../student/class/edit/History';
import { Import } from '../../student/class/edit/Import';
import { Subjects } from '../../student/class/edit/Subjects';
import { WeekAhead } from '../../student/class/edit/WeekAhead';
import { WeekEditor } from '../../student/class/edit/WeekEditor';

/** PROTO tabBoard (teacher.html:332): read-only for subject teachers; the class teacher and admin get the ST-03 edit controls. */
export function BoardTab({ classId, crNames, canEdit }: { classId: string; crNames: string; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const terms = useQuery({ queryKey: ['classes', classId, 'terms'], queryFn: () => unwrap(api.GET('/classes/{id}/terms', { params: { path: { id: classId } } })) });
  if (!terms.data) return null;
  const termId = terms.data.items[0]?.id;
  return (
    <div className="stack-lg">
      {canEdit
        ? <EditToggle editing={editing} onChange={setEditing} />
        : <p className="muted small">Read-only. {crNames ? `The CR (${crNames}) maintains the board.` : 'The CR maintains the board.'}</p>}
      <Board classId={classId} termId={termId} current editing={canEdit && editing} />
      {canEdit && editing && <><Subjects classId={classId} /><WeekEditor classId={classId} /><WeekAhead classId={classId} /><Import classId={classId} /></>}
      <History classId={classId} />
    </div>
  );
}
