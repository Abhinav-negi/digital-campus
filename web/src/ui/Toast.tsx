import { useEffect, useState } from 'react';

// One toast at a time, 2.6s (PROTO data.js:336-337). `toast()` also works outside components (e.g. mutation callbacks).
let show: ((msg: string) => void) | null = null;
export const toast = (msg: string) => show?.(msg);
export const useToast = () => toast;

export function Toaster() {
  const [msg, setMsg] = useState('');
  const [on, setOn] = useState(false);
  useEffect(() => {
    let t: number | undefined;
    show = (m) => {
      setMsg(m);
      setOn(true);
      clearTimeout(t);
      t = window.setTimeout(() => setOn(false), 2600);
    };
    return () => {
      show = null;
      clearTimeout(t);
    };
  }, []);
  return <div className={on ? 'toast on' : 'toast'} role="status" aria-live="polite">{msg}</div>;
}
