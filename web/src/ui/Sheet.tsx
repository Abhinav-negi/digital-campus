import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Modal on desktop, bottom sheet at ≤720px (CSS). Esc / backdrop close, focus trapped, focus restored on close. */
export function Sheet({ title, onClose, children }: { title?: ReactNode; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const downOnBg = useRef(false);

  useEffect(() => {
    const el = ref.current!;
    const prev = document.activeElement as HTMLElement | null;
    const items = () => [...el.querySelectorAll<HTMLElement>(FOCUSABLE)];
    items()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return close.current();
      if (e.key !== 'Tab') return;
      const f = items();
      const first = f[0], last = f[f.length - 1];
      if (!first || !last) return;
      const a = document.activeElement;
      if (!el.contains(a) || (e.shiftKey && a === first) || (!e.shiftKey && a === last)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus();
    };
  }, []);

  return createPortal(
    // Close only when the press both starts and ends on the backdrop, so a text selection dragged out of a field doesn't close a form.
    <div className="sheet-bg" onPointerDown={(e) => (downOnBg.current = e.target === e.currentTarget)}
      onClick={(e) => downOnBg.current && e.target === e.currentTarget && close.current()}>
      <div className="sheet" ref={ref} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
        {title != null && (
          <div className="head">
            <h3>{title}</h3>
            <button type="button" className="icon-btn" aria-label="Close" onClick={() => close.current()}><Icon name="x" /></button>
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}
