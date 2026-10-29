import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../api.js';

const KINDS = {
  cac: 'CAC certificate',
  tax: 'Tax certificate (TIN)',
  id: "Owner's or director's ID",
  shop: 'Photo or proof of your shop',
  other: 'Other document',
};
const STATUS_TEXT = {
  pending: 'Waiting for review',
  verified: 'Approved',
  rejected: 'Not approved',
};
const kb = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

// Where a vendor sends the documents that prove their business, and sees where their application stands.
export default function VendorVerification() {
  const [st, setSt] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState(null);
  const fileRef = useRef(null);

  const load = useCallback(() => api.vendorVerification().then((r) => { setSt(r); setKind((k) => k ?? (r.vendorType === 'company' ? 'cac' : 'shop')); }).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const act = async (fn) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  };

  const upload = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) { setError('That file is too large. Use one under 4 MB.'); return; }
    act(() => api.vendorUploadDocument(file, kind, file.name.slice(0, 100)));
  };

  if (error && !st) return <p className="form-error" role="alert">{error}</p>;
  if (!st) return <p className="muted" role="status">Loading…</p>;

  const locked = st.status === 'verified';
  const waiting = st.status === 'pending' && st.submittedAt;
  const isCompany = st.vendorType === 'company';

  return (
    <>
      <div className="section-head">
        <div>
          <h2 className="dash-h2">Verification</h2>
          <p className="muted">{isCompany ? 'Company vendor' : 'Seller'} · {st.instructions}</p>
        </div>
        <span className={`badge badge-${st.status}`}>{STATUS_TEXT[st.status]}</span>
      </div>

      {st.status === 'verified' && <p className="form-ok" role="status">You are approved. You can post products and deals{isCompany ? ', and offer Energy-as-a-Service' : ''}.</p>}
      {waiting && <aside className="r-banner"><div><strong>Your documents are with our team.</strong><span>We will email you as soon as they are reviewed. You can still add documents until then.</span></div></aside>}
      {st.status === 'rejected' && <p className="form-error" role="alert">Not approved yet{st.note ? `: ${st.note}` : '.'} Fix the problem, upload new documents and send them again.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}

      <h3 className="dash-h3">Your documents</h3>
      {st.documents.length === 0 && <p className="muted">Nothing uploaded yet.</p>}
      <ul className="doc-list">
        {st.documents.map((d) => (
          <li key={d.id}>
            <div>
              <strong>{KINDS[d.kind] ?? d.kind}</strong>
              <small>{d.label ? `${d.label} · ` : ''}{kb(d.bytes)}</small>
            </div>
            <div className="row-actions">
              <a className="btn btn-ghost btn-small" href={`/api/vendor/documents/${d.id}/file`} target="_blank" rel="noopener noreferrer">View</a>
              {!locked && <button type="button" className="btn btn-quiet btn-small" disabled={busy} onClick={() => act(() => api.vendorDeleteDocument(d.id))}>Remove</button>}
            </div>
          </li>
        ))}
      </ul>
      {st.missing.length > 0 && <p className="muted">Still needed: {st.missing.map((k) => KINDS[k]).join(', ')}.</p>}

      {!locked && (
        <div className="doc-add">
          <label className="field">
            <span>Add a document</span>
            <select value={kind ?? ''} onChange={(e) => setKind(e.target.value)}>
              {(isCompany ? ['cac', 'tax', 'id', 'shop', 'other'] : ['shop', 'id', 'cac', 'tax', 'other']).map((k) => <option key={k} value={k}>{KINDS[k]}</option>)}
            </select>
            <small>PDF, JPEG, PNG or WebP, up to 4 MB. Only you and the Solariun team can see it.</small>
          </label>
          <input ref={fileRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" hidden onChange={upload} />
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => fileRef.current?.click()}>{busy ? 'Working…' : 'Choose file'}</button>
        </div>
      )}

      {!locked && (
        <div className="row-actions">
          <button type="button" className="btn btn-primary" disabled={busy || !st.canSubmit} onClick={() => act(() => api.vendorSubmitVerification())}>
            {waiting ? 'Already sent for review' : st.status === 'rejected' ? 'Send again for review' : 'Send for review'}
          </button>
        </div>
      )}
    </>
  );
}
