import { useState } from 'react';

// DiceBear notionists (CC0), seeded by name; initials when offline (PROTO data.js:329-334).
export const notionists = (seed: string, bg = true) =>
  `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(seed)}${bg ? '&backgroundColor=eef0ff,fde7d9,e6f7f1,f3e8ff' : ''}`;

const initials = (name: string) => name.replace(/^(Dr\.|Prof\.)\s*/, '').split(' ').map((w) => w[0]).slice(0, 2).join('');

export function Avatar({ user, size }: { user: { name: string }; size?: 'sm' | 'lg' | 'xl' }) {
  const [failed, setFailed] = useState(false);
  const cls = size ? `avatar ${size}` : 'avatar';
  if (failed) return <span className={cls}>{initials(user.name)}</span>;
  return <img className={cls} alt="" loading="lazy" src={notionists(user.name)} onError={() => setFailed(true)} />;
}
