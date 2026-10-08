import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '../../../api/client';
import type { components } from '../../../api/schema';
import { Tabs } from '../../../ui/Tabs';
import { toast } from '../../../ui/Toast';

export type Profile = components['schemas']['PersonProfile'];
const AV = [['open', 'Open'], ['questions', 'Questions only'], ['focus', 'Focus']] as const;
const LINKS = ['github', 'leetcode', 'linkedin'] as const;
export const parseSkills = (v: string) => v.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 10);
const today = () => new Date().toISOString().slice(0, 10);

export function useSaveProfile(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => unwrap(api.PATCH('/me/profile', { body: body as never })),
    onSuccess: (p) => {
      qc.setQueryData(['commons', 'profile', id], p);
      qc.invalidateQueries({ queryKey: ['commons', 'people'] });
      toast('Saved.');
    },
    onError: (e) => toast(e.message),
  });
}

/** Availability card + profile form (PROTO rMe). Each availability control saves on change. */
export function ProfileForm({ p }: { p: Profile }) {
  const save = useSaveProfile(p.id);
  return (
    <>
      <div className="card stack">
        <h3>Availability</h3>
        <p className="small muted">Shown on your profile and in every list.</p>
        <Tabs tabs={AV} value={p.availability} onChange={(availability) => save.mutate({ availability })} />
        <label className="row between" style={{ minHeight: 'var(--s6)' }}>
          <span>Happy to help juniors<span className="small muted" style={{ display: 'block' }}>Juniors can find you, and matching Asks reach you first.</span></span>
          <input type="checkbox" className="sw" aria-label="Happy to help juniors" checked={p.helpsJuniors} onChange={(e) => save.mutate({ helpsJuniors: e.target.checked })} />
        </label>
        {p.availability === 'focus' && (
          <div className="field"><label htmlFor="focusUntil">In focus mode until</label>
            <input id="focusUntil" className="input" type="date" min={today()} defaultValue={p.focusUntil?.slice(0, 10) ?? ''}
              onChange={(e) => e.target.value && save.mutate({ availability: 'focus', focusUntil: e.target.value })} /></div>)}
      </div>
      <form className="card stack" style={{ marginTop: 'var(--s3)' }} onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const s = (k: string) => String(f.get(k) ?? '').trim();
        save.mutate({
          headline: s('headline'),
          skills: parseSkills(s('skills')),
          links: { ...Object.fromEntries(LINKS.map((k) => [k, s(k)])), other: p.links.other },
        });
      }}>
        <h3>Profile</h3>
        <div className="field"><label htmlFor="pf-headline">Headline</label><input id="pf-headline" className="input" name="headline" defaultValue={p.headline} maxLength={100} /></div>
        <div className="field"><label htmlFor="pf-skills">Skills (comma separated, up to 10)</label><input id="pf-skills" className="input" name="skills" defaultValue={p.skills.join(', ')} /></div>
        <div className="grid grid-3">{LINKS.map((k) => (
          <div key={k} className="field"><label htmlFor={`pf-${k}`}>{k[0]!.toUpperCase() + k.slice(1)} username</label><input id={`pf-${k}`} className="input" name={k} defaultValue={p.links[k]} /></div>))}</div>
        <div><button className="btn primary" type="submit" disabled={save.isPending}>Save profile</button></div>
      </form>
    </>
  );
}
