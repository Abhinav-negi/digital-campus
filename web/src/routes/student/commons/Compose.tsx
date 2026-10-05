import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '../../../api/client';
import type { components } from '../../../api/schema';
import { FormSheet, type Field, type FormValues } from '../../../ui/FormSheet';
import { Icon } from '../../../ui/Icon';
import { Sheet } from '../../../ui/Sheet';
import { toast } from '../../../ui/Toast';
import { today } from '../../../lib/dates';
import { KIND, type Post } from './BoardCard';

type Kind = Post['kind'];
type Create = components['schemas']['BoardPostCreate'];

const BLURB: Record<Kind, string> = { ask: 'Get free help', gig: 'Paid small task', market: 'Sell, buy, give, lend', lost: 'I lost something', found: 'I found something' };
const SPOTS = ['Library entrance', 'Canteen', 'Department lobby'].map((x) => [x, x] as const);
const t = { name: 'title', req: true } as const;
const addDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return today(d); };
const tags = (v: FormValues) => String(v.tags ?? '').split(',').map((x) => x.trim()).filter(Boolean);

const FIELDS: Record<Kind, Field[]> = {
  ask: [{ ...t, label: 'Your question' }, { name: 'body', label: 'Details', type: 'textarea' }, { name: 'tags', label: 'Tags (comma separated)', ph: 'Arduino, DSA' }],
  gig: [
    { type: 'note', label: 'No graded work: assignments, lab records, exams. Tutoring and explaining are fine.' },
    { ...t, label: 'Title' }, { name: 'body', label: 'What is needed', type: 'textarea', req: true }, { name: 'tags', label: 'Skills (comma separated)' },
    { name: 'price', label: 'Price (₹)', type: 'number', req: true }, { name: 'negotiable', label: 'Price is negotiable', type: 'checkbox' },
    { name: 'deadline', label: 'Deadline', type: 'date', value: addDays(7), req: true },
  ],
  market: [
    { type: 'note', label: 'No alcohol, tobacco, drugs, weapons, exam papers, stolen or institution property. Meet in public spots like the library or canteen.' },
    { name: 'marketType', label: 'Type', type: 'select', options: [['sell', 'Sell'], ['buy', 'Wanted'], ['give', 'Give away'], ['lend', 'Lend']] },
    { ...t, label: 'Item' }, { name: 'price', label: 'Price (₹, 0 = Free)', type: 'number', value: 0, req: true },
    { name: 'condition', label: 'Condition', type: 'select', options: ['New', 'Good', 'Used', 'Any'].map((x) => [x, x] as const) },
    { name: 'place', label: 'Meet at', type: 'select', options: SPOTS },
  ],
  lost: [{ ...t, label: 'What did you lose?' }, { name: 'place', label: 'Where', req: true }, { name: 'happenedOn', label: 'When', type: 'date', value: today() }, { name: 'body', label: 'Details', type: 'textarea' }],
  found: [
    { ...t, label: 'What did you find?' }, { name: 'place', label: 'Where', req: true },
    { name: 'holder', label: 'Who is holding it?', ph: 'With me, or the department office', req: true },
    { name: 'hiddenDetail', label: 'Hidden detail (the owner must describe it)', req: true },
  ],
};

const STAYS: Record<Kind, string> = { ask: '14 days', gig: 'until the deadline', market: '30 days', lost: '30 days', found: '30 days' };

export function toBody(kind: Kind, v: FormValues): Create {
  const s = (k: string) => String(v[k] ?? '').trim();
  const body = s('body') || undefined;
  switch (kind) {
    case 'ask': return { kind, title: s('title'), body, tags: tags(v) };
    case 'gig': return { kind, title: s('title'), body: s('body'), tags: tags(v), price: Number(v.price), priceType: v.negotiable ? 'negotiable' : 'fixed', deadline: s('deadline') };
    case 'market': return { kind, title: s('title'), body, marketType: s('marketType') as 'sell', price: Number(v.price), condition: s('condition') as 'New', place: s('place') };
    case 'lost': return { kind, title: s('title'), body, place: s('place'), happenedOn: s('happenedOn') || undefined };
    case 'found': return { kind, title: s('title'), body, place: s('place'), holder: s('holder'), hiddenDetail: s('hiddenDetail'), happenedOn: today() };
  }
}

/** "+ Post" flow: the "What do you need?" picker, then the per-kind form. */
export function Compose({ onClose }: { onClose: () => void }) {
  const [kind, setKind] = useState<Kind>();
  const qc = useQueryClient();
  const post = useMutation({
    mutationFn: (b: Create) => unwrap(api.POST('/commons/board-posts', { body: b })),
    onSuccess: (_, b) => { qc.invalidateQueries({ queryKey: ['commons', 'board'] }); toast(`Posted. It stays up ${STAYS[b.kind]}`); },
  });

  if (!kind) {
    return (
      <Sheet title="What do you need?" onClose={onClose}>
        <div className="pick">
          {(Object.keys(KIND) as Kind[]).map((k) => (
            <button key={k} type="button" className={`k-${k}`} onClick={() => setKind(k)}>
              <span className="kico"><Icon name={KIND[k][1]} /></span><b>{KIND[k][0]}</b><span className="small muted">{BLURB[k]}</span>
            </button>))}
        </div>
      </Sheet>
    );
  }
  // FormSheet toasts a thrown error and keeps the sheet open; 429 carries no body, so name it here.
  return <FormSheet title={`New ${KIND[kind][0].toLowerCase()}`} fields={FIELDS[kind]} label="Post" onClose={onClose}
    onSubmit={async (v) => {
      try { await post.mutateAsync(toBody(kind, v)); } catch (e) {
        const err = e as { code?: string; message: string };
        throw new Error(err.code === 'HTTP_429' ? 'You have used your 5 posts for today' : err.message);
      }
    }} />;
}
