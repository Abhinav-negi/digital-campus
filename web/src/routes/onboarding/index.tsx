// FS-07: /invite/:token, PROTO index.html:123-201 (mail → password → three questions → "You're in.") inside the FS-06 AuthCard.
import { useState, type CSSProperties, type FormEvent, type KeyboardEvent } from 'react';
import { Link, useLoaderData, useNavigate, useParams, type LoaderFunctionArgs } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { meQuery } from '../../api/hooks';
import { homeOf } from '../../router';
import type { components } from '../../api/schema';
import { Avatar } from '../../ui/Avatar';
import { toast } from '../../ui/Toast';
import { today } from '../../lib/dates';
import { AuthCard } from '../auth/card';
import { checkPassword } from '../auth/reset';

const SKILLS = ['React', 'Node.js', 'Python', 'C++', 'UI design', 'Figma', 'Arduino', 'ML', 'Flutter', 'SQL', 'Java', 'Writing', 'Video editing', 'DSA', 'Linux', 'IoT'];
const AVAIL = { Yes: 'open', 'Maybe later': 'questions', 'Not now': 'focus' } as const;
type Choice = keyof typeof AVAIL;
// The PROTO demo card's inline palette (index.html:100), per role; DESIGN.md §2 values.
const PALETTE = {
  student: { '--primary': '#4F46E5', '--secondary': '#7C3AED', '--accent': '#F97316', '--tint': '#EEF0FF' },
  staff: { '--primary': '#172554', '--secondary': '#0F766E', '--accent': '#D97706', '--tint': '#EEF2F7' },
} as Record<string, CSSProperties>;

/** "https://github.com/riya", "linkedin.com/in/riya-p/", "@riya" → "riya": the server takes handles only (`[\w.-]`). */
export const handleOf = (v: string) =>
  v.trim().replace(/^(https?:\/\/)?([\w-]+\.)+[a-z]+\/((in|u)\/)?/i, '').replace(/^@/, '').replace(/[/?#].*$/, '');

export async function loader({ params }: LoaderFunctionArgs) {
  const { data, error, response } = await api.GET('/auth/invite/{token}', { params: { path: { token: params.token ?? '' } } });
  return { invite: data, gone: response?.status === 410, error: error?.message };
}

export function Component() {
  const loaded = useLoaderData<typeof loader>();
  return loaded.invite ? <Flow invite={loaded.invite} /> : <Gone error={loaded.gone ? undefined : loaded.error} />;
}

function Gone({ error }: { error?: string }) {
  return (
    <AuthCard>
      <div className="stack">
        {error ? <p className="err" role="alert">{error}</p> : <><h3>This invite has expired.</h3><p className="muted">Ask your teacher to resend it.</p></>}
        <p className="small">Already set a password? <Link to="/login">Log in</Link></p>
      </div>
    </AuthCard>
  );
}

type Invite = { email: string; studentIdNo?: string; className?: string; invitedBy: string };

function Flow({ invite }: { invite: Invite }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { token = '' } = useParams();
  const [step, setStep] = useState(1);
  const [gone, setGone] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [avail, setAvail] = useState<Choice>('Yes');
  const [skills, setSkills] = useState<string[]>([]);
  const [profile, setProfile] = useState<components['schemas']['PersonProfile']>();
  if (gone) return <Gone />;

  async function accept(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const password = String(f.get('password'));
    const msg = checkPassword(password, String(f.get('confirm')));
    setErr(msg);
    if (msg) return;
    setBusy(true);
    const { error, response } = await api.POST('/auth/invite/{token}/accept', { params: { path: { token } }, body: { password, client: 'web' } });
    if (error) {
      setBusy(false);
      return response?.status === 410 ? setGone(true) : setErr(error.message);
    }
    // Now logged in: refetch `me` so the area guard doesn't serve the cached null.
    const me = await qc.fetchQuery({ ...meQuery, staleTime: 0 });
    setBusy(false);
    if (!me) return setErr('Something went wrong. Try again.');
    if (me.user.role !== 'student') return navigate(homeOf(me), { replace: true });
    setStep(3);
  }

  const toggle = (s: string) => {
    if (skills.includes(s)) setSkills(skills.filter((x) => x !== s));
    else if (skills.length >= 5) toast('Up to 5 skills');
    else setSkills([...skills, s]);
  };
  const typed = (e: KeyboardEvent<HTMLInputElement>) => {
    const v = e.currentTarget.value.trim();
    if (e.key !== 'Enter' || !v) return;
    const s = SKILLS.find((x) => x.toLowerCase() === v.toLowerCase()) ?? v;
    if (!skills.some((x) => x.toLowerCase() === s.toLowerCase())) toggle(s);
    e.currentTarget.value = '';
  };

  async function finish() {
    const f = (id: string) => handleOf((document.getElementById(id) as HTMLInputElement).value);
    const availability = AVAIL[avail];
    const until = new Date();
    until.setDate(until.getDate() + 14);
    setBusy(true);
    const { data, error } = await api.PATCH('/me/profile', {
      body: {
        availability,
        ...(availability === 'focus' && { focusUntil: today(until) }),
        skills,
        links: { github: f('gh'), leetcode: f('lc'), linkedin: f('li') },
      },
    });
    setBusy(false);
    if (error) return setErr(error.message);
    toast('Welcome aboard');
    setProfile(data);
    setStep(4);
  }

  const dots = <div className="dots">{[1, 2, 3, 4].map((n) => <i key={n} className={n === step ? 'on' : ''} />)}</div>;
  const first = (name: string) => name.split(' ')[0];

  return (
    <AuthCard>
      <div style={PALETTE[invite.className ? 'student' : 'staff']}>
        {dots}
        {step === 1 && (
          <div className="stack">
            <div className="mail stack">
              <p className="tiny muted">From Digital Campus · To {invite.email}</p>
              <h3>{invite.className ? `Your class ${invite.className} is on Digital Campus` : 'You are invited to Digital Campus'}</h3>
              <p className="muted small">Hi, {invite.invitedBy} {invite.className ? 'added you' : 'invited you to join the staff'}. It takes about 60 seconds.</p>
              <button className="btn primary" onClick={() => setStep(2)}>{invite.className ? 'Join your class' : 'Set a password'}</button>
            </div>
          </div>
        )}
        {step === 2 && (
          <form className="stack" onSubmit={accept} noValidate>
            <h3>Set a password</h3>
            {invite.studentIdNo && <div className="field"><label htmlFor="sid">Student ID</label><input className="input" id="sid" readOnly value={invite.studentIdNo} /></div>}
            <div className="field"><label htmlFor="em">Email</label><input className="input" id="em" readOnly value={invite.email} /></div>
            <div className="field"><label htmlFor="pw">Password</label><input className="input" id="pw" name="password" type="password" autoComplete="new-password" placeholder="At least 8 characters" /></div>
            <div className="field"><label htmlFor="pw2">Confirm password</label><input className="input" id="pw2" name="confirm" type="password" autoComplete="new-password" /></div>
            <p className="err" role="alert">{err}</p>
            <button className="btn primary block" disabled={busy}>Continue</button>
          </form>
        )}
        {step === 3 && (
          <div className="stack-lg">
            <div className="stack">
              <h3>Contribute to student projects?</h3>
              <div className="choices">
                {(Object.keys(AVAIL) as Choice[]).map((k) => (
                  <button key={k} type="button" className={avail === k ? 'btn on' : 'btn'} aria-pressed={avail === k} onClick={() => setAvail(k)}>{k}</button>
                ))}
              </div>
            </div>
            <div className="stack">
              <h3>What are you good at or learning?</h3>
              <p className="muted small">{skills.length} of 5 picked</p>
              <div className="row wrap">
                {[...SKILLS, ...skills.filter((s) => !SKILLS.includes(s))].map((s) => (
                  <button key={s} type="button" className={skills.includes(s) ? 'chip on' : 'chip'} aria-pressed={skills.includes(s)} style={{ minHeight: 'var(--s5)' }} onClick={() => toggle(s)}>{s}</button>
                ))}
              </div>
              <input className="input" aria-label="Type your own skill" placeholder="Or type your own and press Enter" maxLength={40} onKeyDown={typed} />
            </div>
            <div className="stack">
              <h3>Link your work <span className="muted small">(optional)</span></h3>
              <input className="input" id="gh" aria-label="GitHub username" placeholder="GitHub username" />
              <input className="input" id="lc" aria-label="LeetCode username" placeholder="LeetCode username" />
              <input className="input" id="li" aria-label="LinkedIn handle" placeholder="LinkedIn handle" />
            </div>
            {err && <p className="err" role="alert">{err}</p>}
            <button className="btn primary block" disabled={busy} onClick={finish}>Finish</button>
          </div>
        )}
        {step === 4 && profile && (
          <div className="stack" style={{ textAlign: 'center', alignItems: 'center' }}>
            <Avatar user={profile} size="xl" />
            <h2>You're in.</h2>
            <p className="muted">Welcome to {invite.className}, {first(profile.name)}{profile.label && ` · ${profile.label}`}.</p>
            <Link className="btn primary" to="/s" replace>Go to Today</Link>
          </div>
        )}
      </div>
    </AuthCard>
  );
}
