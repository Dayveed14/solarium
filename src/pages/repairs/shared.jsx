import { useRef, useState } from 'react';
import { apiUrl } from '../../api.js';
import { shrink } from '../../lib/shrink.js';

export const REPAIR_STATUS = {
  quote: 'Awaiting your payment', awaiting_payment: 'Awaiting your payment', finding: 'Finding a technician', assigned: 'Technician assigned',
  on_the_way: 'Technician on the way', on_site: 'Inspection in progress', inspected: 'Estimate ready', approved: 'Repair approved', in_repair: 'Being repaired',
  awaiting_parts: 'Waiting for parts', repair_done: 'Waiting for your confirmation', completed: 'Completed', cancelled: 'Cancelled',
};
export const statusTone = (s) => (s === 'completed' ? 'verified' : s === 'cancelled' ? 'rejected' : 'pending');

// The customer's progress, as a short row of steps.
export const PROGRESS = [['finding', 'Finding a technician'], ['assigned', 'Technician assigned'], ['on_the_way', 'On the way'], ['on_site', 'Inspecting'], ['inspected', 'Estimate ready']];
export const progressIndex = (status) => ({ finding: 0, assigned: 1, on_the_way: 2, on_site: 3, inspected: 4, approved: 5, in_repair: 5, awaiting_parts: 5, repair_done: 5, completed: 5 }[status] ?? -1);

// "Pay only in the app" notice, shown wherever money is mentioned.
export function PayNotice({ text }) {
  return <p className="pay-notice" role="note"><strong>Pay only inside TerraVoltix.</strong> {text?.replace(/^Pay only inside TerraVoltix\.\s*/, '') ?? 'If you pay a technician directly, we cannot protect your money or help if something goes wrong.'}</p>;
}

// Private pictures, shown as small tiles that open the full picture.
export function PhotoTiles({ base, ids, onRemove }) {
  if (!ids?.length) return null;
  return (
    <ul className="photo-tiles">
      {ids.map((id) => (
        <li key={id}>
          <a href={apiUrl(`${base}/photos/${id}`)} target="_blank" rel="noopener noreferrer"><img src={apiUrl(`${base}/photos/${id}`)} alt="Uploaded picture" loading="lazy" /></a>
          {onRemove && <button type="button" className="btn btn-quiet btn-small" onClick={() => onRemove(id)}>Remove</button>}
        </li>
      ))}
    </ul>
  );
}

// Chooses pictures (from the camera or gallery on a phone) and shrinks them. `files` are held by the parent until it sends them.
export function PhotoPicker({ files, setFiles, max, label = 'Add a picture', disabled = false }) {
  const ref = useRef(null);
  const [error, setError] = useState(null);
  const add = async (e) => {
    const picked = [...(e.target.files ?? [])];
    e.target.value = '';
    setError(null);
    const room = max - files.length;
    const out = [];
    for (const f of picked.slice(0, room)) {
      if (!f.type.startsWith('image/')) { setError('Please choose pictures only.'); continue; }
      try { const blob = await shrink(f); out.push({ blob, url: URL.createObjectURL(blob), key: `${f.name}-${f.size}-${Math.random()}` }); } catch { setError('We could not read one of those pictures.'); }
    }
    if (picked.length > room) setError(`You can add up to ${max} pictures.`);
    if (out.length) setFiles((a) => [...a, ...out]);
  };
  return (
    <div className="photo-picker">
      {files.length > 0 && (
        <ul className="photo-tiles">
          {files.map((f) => (
            <li key={f.key}><img src={f.url} alt="Chosen picture" /><button type="button" className="btn btn-quiet btn-small" onClick={() => setFiles((a) => a.filter((x) => x.key !== f.key))}>Remove</button></li>
          ))}
        </ul>
      )}
      {files.length < max && (
        <>
          <input ref={ref} type="file" accept="image/*" multiple capture={undefined} hidden onChange={add} aria-label={label} />
          <button type="button" className="btn btn-ghost btn-small" disabled={disabled} onClick={() => ref.current?.click()}>{label}</button>
        </>
      )}
      <small>Up to {max} pictures. We shrink them for you.</small>
      {error && <small className="err">{error}</small>}
    </div>
  );
}
