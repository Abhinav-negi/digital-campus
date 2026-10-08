import { useState, type FormEvent } from 'react';
import { Sheet } from './Sheet';
import { toast } from './Toast';
import { api, unwrap } from '../api/client';

// Typed port of PROTO student.html:131-143 formSheet.
type Base = { name: string; label: string };
export type Field =
  | (Base & { type?: 'text' | 'textarea' | 'date' | 'time' | 'number' | 'email' | 'url' | 'password'; value?: string | number; req?: boolean; ph?: string })
  | (Base & { type: 'select'; options: readonly (readonly [string, string])[]; value?: string })
  | (Base & { type: 'checkbox'; value?: boolean })
  | (Base & { type: 'file'; accept?: string; req?: boolean })
  | { type: 'note'; label: string };

export type FileRef = { key: string; name: string };
export type FormValues = Record<string, string | number | boolean | FileRef | null>;

export async function upload(file: File): Promise<FileRef> {
  const { uploadUrl, key } = await unwrap(api.POST('/files/presign', { body: { name: file.name, contentType: file.type as 'application/pdf', size: file.size } }));
  const put = await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
  if (!put.ok) throw new Error("Couldn't upload the file. Try again.");
  return { key, name: file.name };
}

export function FormSheet({ title, fields, label, onSubmit, onClose }: {
  title: string; fields: readonly Field[]; label: string;
  onSubmit: (v: FormValues) => void | Promise<void>; onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const v: FormValues = {};
      for (const f of fields) {
        if (f.type === 'note') continue;
        const raw = fd.get(f.name);
        if (f.type === 'checkbox') v[f.name] = raw != null;
        else if (f.type === 'file') v[f.name] = raw instanceof File && raw.size ? await upload(raw) : null;
        else if (f.type === 'number') v[f.name] = raw === '' || raw == null ? null : Number(raw);
        else v[f.name] = String(raw ?? '');
      }
      await onSubmit(v);
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet title={title} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        {fields.map((f, i) => {
          if (f.type === 'note') return <p key={i} className="small muted">{f.label}</p>;
          const id = `fs-${f.name}`;
          if (f.type === 'checkbox')
            return <label key={f.name} className="row"><input type="checkbox" name={f.name} defaultChecked={f.value} /> {f.label}</label>;
          return (
            <div key={f.name} className="field">
              <label htmlFor={id}>{f.label}</label>
              {f.type === 'textarea' ? (
                <textarea id={id} className="input" name={f.name} defaultValue={f.value} required={f.req} placeholder={f.ph} />
              ) : f.type === 'select' ? (
                <select id={id} className="input" name={f.name} defaultValue={f.value}>
                  {f.options.map(([a, b]) => <option key={a} value={a}>{b}</option>)}
                </select>
              ) : f.type === 'file' ? (
                <input id={id} className="input" type="file" name={f.name} accept={f.accept} required={f.req} />
              ) : (
                <input id={id} className="input" type={f.type ?? 'text'} name={f.name} defaultValue={f.value} required={f.req} placeholder={f.ph} />
              )}
            </div>
          );
        })}
        <button className="btn primary block" type="submit" disabled={busy}>{label}</button>
      </form>
    </Sheet>
  );
}
