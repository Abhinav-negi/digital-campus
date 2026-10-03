// Verbatim port of PROTO index.html:46-121 (styles in styles/landing.css, scoped to body.landing).
import { useEffect, type CSSProperties } from 'react';
import { Link } from 'react-router';
import { Icon, type IconName } from '../../ui/Icon';

const img = (seed: string, bg = 'eef0ff,fde7d9,e6f7f1,f3e8ff') => `https://api.dicebear.com/9.x/notionists/svg?seed=${seed}&backgroundColor=${bg}`;
// Inline custom properties (--primary etc.) aren't in CSSProperties.
const css = (s: Record<string, string>) => s as CSSProperties;

const CAST = ['Felix', 'Aria', 'Milo', 'Zoe', 'Kai', 'Nina'];
const STEPS: [string, string, string][] = [
  ['Teacher creates the class', 'Pastes student IDs and emails, taps Send invites.', 'Teacher'],
  ['Picks a CR', 'One tap on a name. The CR keeps the board current.', 'Captain'],
  ['Students join and build', 'Set a password, answer three questions, and you are in.', 'Builder'],
];
// Static list from PROTO data.js; FS-05/auth swaps in GET /branches when logged in.
const BRANCHES = ['CSE', 'IT', 'ECE', 'ME', 'IE'];
const KINDS: [IconName, string, string][] = [
  ['chat', 'Ask', 'How do I flash an ESP32?'],
  ['code', 'Gig', 'Logo for our team, ₹500'],
  ['star', 'Market', 'Casio calculator, ₹900'],
  ['search', 'Lost', 'Blue ID-card holder'],
  ['check', 'Found', 'Calculator in LH-2'],
];

export function Component() {
  useEffect(() => {
    document.body.className = 'landing';
    return () => void (document.body.className = '');
  }, []);

  return (
    <main className="wrap">
      <section className="hero">
        <div className="brand" style={{ justifyContent: 'center', marginBottom: 'var(--s5)' }}><span className="dot"></span>Digital Campus</div>
        <h1>Your class, run by your class.</h1>
        <p className="sub">One school, five branches, four years. Teachers create it, the CR keeps it current, students build together.</p>
        <div className="cast" aria-hidden="true">
          {CAST.map((s) => <img key={s} alt="" src={img(s)} />)}
        </div>
        <div className="grid grid-2" style={{ textAlign: 'left' }}>
          <div className="card role" style={css({ '--primary': '#4F46E5', '--secondary': '#7C3AED', '--accent': '#F97316', '--tint': '#EEF0FF' })}>
            <img className="avatar" alt="" src="https://api.dicebear.com/9.x/notionists/svg?seed=Riya&backgroundColor=fde7d9" />
            <h2>For students</h2>
            <ul><li>Today: your timetable and deadlines</li><li>Attendance: know where you stand</li><li>Commons: ask, trade and build across SoET</li></ul>
            <Link className="btn primary" to="/login">Open student app</Link>
          </div>
          <div className="card role" style={css({ '--primary': '#172554', '--secondary': '#0F766E', '--accent': '#D97706', '--tint': '#E6F4F1' })}>
            <img className="avatar" alt="" src="https://api.dicebear.com/9.x/notionists/svg?seed=Meera&backgroundColor=e6f7f1" />
            <h2>For teachers</h2>
            <ul><li>Attendance: tap the absent, done in 20 seconds</li><li>Post once to many classes</li><li>See who has read it</li></ul>
            <Link className="btn primary" to="/login">Open teacher app</Link>
          </div>
        </div>
        <p className="quiet"><Link className="small muted" to="/login">Admin</Link></p>
      </section>

      <section className="band">
        <p className="eyebrow">How it works</p>
        <h2>Three steps. No hard-coding.</h2>
        <div className="grid grid-3">
          {STEPS.map(([t, d, s], i) => (
            <div key={s} className="step"><img alt="" src={img(s)} /><p className="n">{i + 1}</p><h3>{t}</h3><p className="muted small">{d}</p></div>
          ))}
        </div>
      </section>

      <section className="band">
        <p className="eyebrow">Two spaces</p>
        <h2>One app, two rooms.</h2>
        <div className="grid grid-2">
          <div className="card" style={css({ '--tint': '#E6F4F1' })}><p className="eyebrow">Class space</p><h3>The official room</h3><p className="muted" style={{ marginTop: 'var(--s1)' }}>Timetable, syllabus, exam dates, announcements and attendance. Teachers, the CR and students.</p></div>
          <div className="card" style={css({ '--tint': '#EEF0FF' })}><p className="eyebrow">Commons</p><h3>The student community</h3><p className="muted" style={{ marginTop: 'var(--s1)' }}>A Board, projects and people, shared by every branch. Students only.</p></div>
        </div>
        <p className="wall muted">The wall: teachers never see the Commons.</p>
      </section>

      <section className="band">
        <p className="eyebrow">The Commons</p>
        <h2>One block for all of SoET.</h2>
        <div className="row wrap" style={{ justifyContent: 'center', gap: 'var(--s2)' }}>
          {BRANCHES.map((code) => (
            <div key={code} className="card" style={{ textAlign: 'center', padding: 'var(--s2) var(--s3)' }}><h3>{code}</h3><p className="tiny muted">Years 1–4</p></div>
          ))}
        </div>
        <p className="wall muted">Every class has its own space. Above them, one Commons everyone shares.</p>
        <div className="grid grid-3" style={{ marginTop: 'var(--s5)' }}>
          {KINDS.map(([i, k, ex]) => (
            <div key={k} className="row" style={{ gap: 'var(--s2)' }}><span className="icon-btn" style={{ color: 'var(--accent)' }}><Icon name={i} /></span><div><h4>{k}</h4><p className="muted small">{ex}</p></div></div>
          ))}
        </div>
        <div className="card tint lift" style={css({ '--tint': '#EEF0FF', textAlign: 'center', marginTop: 'var(--s5)', padding: 'var(--s5) var(--s3)' })}>
          <p className="eyebrow">Flagship</p><h3>SoET Open Source</h3>
          <p className="muted" style={{ margin: 'var(--s1) 0 var(--s3)' }}>This semester, we build Digital Campus together.</p>
          <Link className="btn primary" to="/login">See the project</Link></div>
      </section>

      <footer>
        <p className="muted small">Digital Campus · School of Engineering &amp; Technology</p>
      </footer>
    </main>
  );
}
