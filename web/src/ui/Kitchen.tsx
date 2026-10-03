// Dev-only test page (/ui): every component in every personality, for side-by-side checks against the prototype.
import { useEffect, useState } from 'react';
import { Avatar } from './Avatar';
import { Badge, Chip } from './Badge';
import { Bar, Stat } from './Bar';
import { CrWillAdd, Empty } from './Empty';
import { FormSheet, type Field } from './FormSheet';
import { Icon, iconNames } from './Icon';
import { Sheet } from './Sheet';
import { Tabs } from './Tabs';
import { useToast } from './Toast';

const BODY = [['student', 'Student'], ['teacher', 'Teacher'], ['teacher admin', 'Admin'], ['landing', 'Neutral']] as const;
const people = [{ name: 'Riya Sharma' }, { name: 'Arjun Mehta' }, { name: 'Dr. Kavita Rao' }, { name: 'Sana Khan' }];
const fields: Field[] = [
  { name: 'title', label: 'Title', req: true, ph: 'What is it?' },
  { name: 'body', label: 'Details', type: 'textarea' },
  { name: 'kind', label: 'Kind', type: 'select', options: [['exam', 'Exam'], ['deadline', 'Deadline']], value: 'exam' },
  { name: 'date', label: 'Date', type: 'date' },
  { name: 'time', label: 'Time', type: 'time' },
  { name: 'price', label: 'Price', type: 'number' },
  { name: 'file', label: 'File', type: 'file' },
  { type: 'note', label: 'Be honest about the scope: it keeps gigs fair.' },
  { name: 'pin', label: 'Pin to the top', type: 'checkbox' },
];

export function Component() {
  const [body, setBody] = useState<(typeof BODY)[number][0]>('student');
  const [tab, setTab] = useState<'a' | 'b' | 'c'>('a');
  const [chips, setChips] = useState(['Python']);
  const [sheet, setSheet] = useState<'plain' | 'form' | null>(null);
  const toast = useToast();

  useEffect(() => {
    document.body.className = body;
    return () => void (document.body.className = '');
  }, [body]);

  return (
    <main className="main">
      <div className="page-head">
        <div><div className="eyebrow">UI kit</div><h1>Components</h1><p className="muted">Every class from style.css, rendered by the React kit.</p></div>
        <Tabs tabs={BODY} value={body} onChange={setBody} />
      </div>

      <div className="stack-lg">
        <section className="stack">
          <h2>Type</h2>
          <h1>Heading one</h1><h3>Heading three</h3><h4>Heading four</h4>
          <p>Body 17px. <span className="small">Small 15px.</span> <span className="tiny">Tiny 13px.</span> <span className="muted">Muted.</span></p>
          <div className="brand"><span className="dot" /> Digital Campus</div>
        </section>

        <section className="grid grid-3">
          <div className="card"><h4>Card</h4><p className="small muted">Flat with a hairline.</p></div>
          <div className="card lift"><h4>Lift</h4><p className="small muted">One shadow.</p></div>
          <div className="card click"><h4>Click</h4><p className="small muted">Hover me.</p></div>
          <div className="card tint"><h4>Tint</h4><p className="small muted">No border.</p></div>
          <div className="card hero"><div className="eyebrow">Up next</div><h3>Maths at 10:00</h3><p className="muted">LH-2 · Dr. Rao</p></div>
          <div className="card"><div className="list"><div>List row one</div><div>List row two</div><div>List row three</div></div></div>
        </section>

        <section className="row wrap">
          <button className="btn">Default</button>
          <button className="btn primary"><Icon name="plus" size={16} /> Primary</button>
          <button className="btn accent">Accent</button>
          <button className="btn ghost">Ghost</button>
          <button className="btn sm">Small</button>
          <button className="btn" disabled>Disabled</button>
          <button className="icon-btn" aria-label="Notifications"><Icon name="bell" /></button>
          <button className="btn primary block">Block</button>
        </section>

        <section className="row wrap">
          {['Python', 'Design', 'Tutoring'].map((c) => (
            <Chip key={c} on={chips.includes(c)} onClick={() => setChips((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]))}>{c}</Chip>
          ))}
          <Chip>Tag</Chip><Chip tone="due">Due tomorrow</Chip><Chip tone="vio">New</Chip>
        </section>

        <section className="row wrap">
          <Badge kind="open">Open</Badge><Badge kind="questions">Questions only</Badge><Badge kind="focus">Focus</Badge>
          <Badge kind="danger">Absent</Badge><Badge kind="warn">Same device</Badge><Badge kind="warn" plain>Plain</Badge><Badge kind="clash" />
        </section>

        <section className="row wrap">
          <Avatar user={people[0]!} size="sm" /><Avatar user={people[1]!} /><Avatar user={people[2]!} size="lg" /><Avatar user={people[3]!} size="xl" />
          <div className="avatars">{people.map((p) => <Avatar key={p.name} user={p} size="sm" />)}</div>
          <span className="avatar">RS</span>
        </section>

        <section className="row wrap">{iconNames.map((n) => <span key={n} title={n}><Icon name={n} /></span>)}</section>

        <section className="grid grid-2">
          <div className="stack">
            <Tabs tabs={[['a', 'Today'], ['b', 'Board'], ['c', 'People']]} value={tab} onChange={setTab} />
            <Bar pct={86} /><Bar pct={76} status="warn" /><Bar pct={61} status="below" />
          </div>
          <div className="grid grid-3"><Stat num={58} lbl="students" /><Stat num="82%" lbl="avg attendance" /><Stat num="71%" lbl="last post seen" /></div>
        </section>

        <section className="grid grid-2">
          <div className="field"><label htmlFor="k-in">Input</label><input id="k-in" className="input" placeholder="Type here" /></div>
          <div className="field"><label htmlFor="k-sel">Select</label><select id="k-sel" className="input"><option>One</option></select></div>
        </section>

        <section className="row wrap">
          <button className="btn" onClick={() => setSheet('plain')}>Open sheet</button>
          <button className="btn" onClick={() => setSheet('form')}>Open form sheet</button>
          <button className="btn" onClick={() => toast('Attendance saved · students updated')}>Show toast</button>
        </section>

        <section className="grid grid-3">
          <div className="card"><Empty text="You're all caught up." /></div>
          <div className="card"><CrWillAdd what="timetable" /></div>
          <div className="card"><CrWillAdd what="timetable" isCr onAdd={() => toast('Add timetable')} /></div>
        </section>

        <section className="card">
          <table className="preview-table">
            <thead><tr><th>Day</th><th>Time</th><th>Subject</th><th>Room</th></tr></thead>
            <tbody><tr><td>Mon</td><td>10:00</td><td>Maths</td><td>LH-2</td></tr><tr><td>Tue</td><td>11:00</td><td>Physics</td><td>LH-1</td></tr></tbody>
          </table>
        </section>
      </div>

      {sheet === 'plain' && (
        <Sheet title="Sheet" onClose={() => setSheet(null)}>
          <div className="stack"><p>Esc, the backdrop and the x all close this. Tab stays inside.</p><button className="btn primary block" onClick={() => setSheet(null)}>Done</button></div>
        </Sheet>
      )}
      {sheet === 'form' && (
        <FormSheet title="New post" label="Post" fields={fields} onClose={() => setSheet(null)}
          onSubmit={(v) => void toast(`Posted · ${JSON.stringify(v).slice(0, 60)}`)} />
      )}
    </main>
  );
}
