import { Icon } from '../../../../ui/Icon';

/** CR-only bar above the board (PROTO student.html:204). */
export function EditToggle({ editing, onChange }: { editing: boolean; onChange: (on: boolean) => void }) {
  return (
    <div className="row between">
      <p className="small muted">{editing ? 'Editing is on. Every change is logged.' : 'You can edit this board as CR.'}</p>
      <button type="button" className={editing ? 'btn primary' : 'btn'} onClick={() => onChange(!editing)}>
        <Icon name="edit" size={16} /> {editing ? 'Done' : 'Edit'}
      </button>
    </div>
  );
}
