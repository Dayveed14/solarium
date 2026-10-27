import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api.js';
import { formatDate } from '../../lib/format.js';

const FILTERS = [['pending', 'Waiting'], ['verified', 'Verified'], ['rejected', 'Rejected'], ['', 'All']];
const LABEL = { pending: 'Pending', verified: 'Verified', rejected: 'Rejected' };

export default function AdminVendors() {
  const [filter, setFilter] = useState('pending');
  const [vendors, setVendors] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const [open, setOpen] = useState(null);
  const [review, setReview] = useState(null);
  const [note, setNote] = useState('');

  const load = useCallback(() => {
    api.adminVendors(filter).then((r) => setVendors(r.vendors)).catch((e) => setError(e.message));
  }, [filter]);
  useEffect(() => {
    setVendors(null);
    load();
  }, [load]);

  const toggle = async (id) => {
    if (open === id) { setOpen(null); return; }
    setOpen(id); setReview(null); setNote('');
    try { setReview(await api.adminVendorReview(id)); } catch (e) { setError(e.message); }
  };

  const set = async (id, status) => {
    setBusy(id);
    setError(null);
    try {
      await api.adminVendorVerification(id, status, note.trim() || undefined);
      setOpen(null);
      load();
    } catch (e) {
      setError(e.message);
    }
    setBusy(null);
  };

  return (
    <>
      <div className="section-head">
        <div>
          <h2 className="dash-h2">Vendors</h2>
          <p className="muted">Open each vendor&apos;s documents and check they are real before verifying. Vendors cannot post until you verify them, and rejected vendors disappear from the shop straight away.</p>
        </div>
      </div>
      <div className="tabs" role="tablist" aria-label="Filter vendors">
        {FILTERS.map(([value, label]) => (
          <button key={label} type="button" role="tab" aria-selected={filter === value} className={filter === value ? 'is-active' : ''} onClick={() => setFilter(value)}>{label}</button>
        ))}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {!vendors && !error && <p className="muted" role="status">Loading…</p>}
      {vendors?.length === 0 && <div className="empty-card"><h3>Nobody here</h3><p>No vendors in this list.</p></div>}
      <ul className="request-list">
        {(vendors ?? []).map((v) => (
          <li key={v.userId} className="request-card">
            <div className="deal-top">
              <h3>{v.companyName}</h3>
              <span className={`badge badge-${v.verification}`}>{LABEL[v.verification]}</span>
            </div>
            <p className="muted">
              {v.contactName} · <a href={`mailto:${v.email}`}>{v.email}</a>
              {v.phone && <> · <a href={`tel:${v.phone}`}>{v.phone}</a></>} · joined {formatDate(v.createdAt)}
            </p>
            <p className="muted">{v.vendorType === 'company' ? 'Company' : 'Seller'} · {v.documents} document{v.documents === 1 ? '' : 's'}{v.submittedAt ? ` · sent ${formatDate(v.submittedAt)}` : ' · nothing sent yet'}</p>
            <p className="muted">{v.products} products · {v.activeDeals} live deals{v.accountStatus !== 'active' ? ' · account suspended' : ''}</p>
            <div className="row-actions">
              <button type="button" className="btn btn-ghost btn-small" onClick={() => toggle(v.userId)}>{open === v.userId ? 'Close' : 'Review documents'}</button>
              {v.verification !== 'pending' && <button type="button" className="btn btn-quiet btn-small" disabled={busy === v.userId} onClick={() => set(v.userId, 'pending')}>Back to pending</button>}
            </div>
            {open === v.userId && (
              <div className="review-box">
                {!review && <p className="muted" role="status">Loading…</p>}
                {review && review.documents.length === 0 && <p className="muted">No documents uploaded.</p>}
                {review && (
                  <ul className="doc-list">
                    {review.documents.map((d) => (
                      <li key={d.id}>
                        <div><strong>{d.kind.toUpperCase()}</strong><small>{d.label ?? ''}</small></div>
                        <a className="btn btn-ghost btn-small" href={`/api/admin/documents/${d.id}/file`} target="_blank" rel="noopener noreferrer">Open</a>
                      </li>
                    ))}
                  </ul>
                )}
                {review?.required?.length > 0 && <p className="muted">Must include: {review.required.map((k) => k.toUpperCase()).join(', ')}.</p>}
                <label className="field"><span>Note to the vendor (needed to reject)</span><input type="text" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} /></label>
                <div className="row-actions">
                  {v.verification !== 'verified' && <button type="button" className="btn btn-primary" disabled={busy === v.userId} onClick={() => set(v.userId, 'verified')}>Verify</button>}
                  {v.verification !== 'rejected' && <button type="button" className="btn btn-quiet" disabled={busy === v.userId || !note.trim()} onClick={() => set(v.userId, 'rejected')}>Reject</button>}
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
