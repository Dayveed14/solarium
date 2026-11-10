import { useRef, useState } from 'react';
import { api } from '../../api.js';

// Pieces shared by the installer registration and the installer's working profile.

// One answer from a short list.
export function OptionRow({ label, hint, value, options, onChange, error }) {
  return (
    <div className="field">
      <span>{label}</span>
      <div className="choice-row" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button key={String(o.id)} type="button" role="radio" aria-checked={value === o.id} className={value === o.id ? 'chip on' : 'chip'} onClick={() => onChange(o.id)}>{o.label}</button>
        ))}
      </div>
      {hint && <small>{hint}</small>}
      {error && <small className="err">{error}</small>}
    </div>
  );
}

// Several answers from a short list.
export function MultiRow({ label, hint, value = [], options, onChange, error }) {
  const toggle = (id) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  return (
    <div className="field">
      <span>{label}</span>
      <div className="choice-row" role="group" aria-label={label}>
        {options.map((o) => (
          <button key={o.id} type="button" aria-pressed={value.includes(o.id)} className={value.includes(o.id) ? 'chip on' : 'chip'} onClick={() => toggle(o.id)}>{o.label}</button>
        ))}
      </div>
      {hint && <small>{hint}</small>}
      {error && <small className="err">{error}</small>}
    </div>
  );
}

const ACCEPT = { certificate: 'application/pdf,image/jpeg,image/png,image/webp', photo: 'image/jpeg,image/png,image/webp', work: 'image/jpeg,image/png,image/webp' };

// A private file area for one kind of upload: a profile photo, pictures of past work, or certificates.
export function FilesBox({ kind, title, hint, docs, limit, locked = false, onChange, onError }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const mine = docs.filter((d) => d.kind === kind);
  const full = kind !== 'photo' && mine.length >= limit;

  const add = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    onError(null);
    try {
      await api.installerUploadDocument(file, kind, file.name);
      await onChange();
    } catch (err) {
      onError(err.message);
    }
    setBusy(false);
  };
  const remove = async (id) => {
    setBusy(true);
    onError(null);
    try {
      await api.installerDeleteDocument(id);
      await onChange();
    } catch (err) {
      onError(err.message);
    }
    setBusy(false);
  };

  return (
    <div className="field files-box">
      <span>{title} <em>(optional)</em></span>
      {mine.length > 0 && (
        <ul className="doc-list">
          {mine.map((d) => (
            <li key={d.id}>
              {kind !== 'certificate' && <img src={`/api/installer/documents/${d.id}/file`} alt="" loading="lazy" className="doc-thumb" />}
              <span>{d.label || (kind === 'photo' ? 'Profile photo' : kind === 'work' ? 'Work picture' : 'Certificate')}</span>
              <a className="btn btn-ghost btn-small" href={`/api/installer/documents/${d.id}/file`} target="_blank" rel="noopener noreferrer">View</a>
              {!(locked && kind === 'certificate') && <button type="button" className="btn btn-quiet btn-small" disabled={busy} onClick={() => remove(d.id)}>Remove</button>}
            </li>
          ))}
        </ul>
      )}
      {!(locked && kind === 'certificate') && !full && (
        <>
          <input ref={ref} type="file" accept={ACCEPT[kind]} hidden onChange={add} />
          <button type="button" className="btn btn-ghost btn-small files-add" disabled={busy} onClick={() => ref.current?.click()}>{busy ? 'Working…' : kind === 'photo' && mine.length ? 'Replace photo' : 'Add file'}</button>
        </>
      )}
      <small>{hint}</small>
    </div>
  );
}
