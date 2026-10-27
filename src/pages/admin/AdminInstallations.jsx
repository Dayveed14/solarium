import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api.js';
import { formatDate, naira } from '../../lib/format.js';
import { INSTALL_STATUS } from '../Installations.jsx';

const FILTERS = [['', 'Active'], ['open', 'Finding installer'], ['assigned', 'Assigned'], ['installer_done', 'Awaiting customer'], ['completed', 'Completed'], ['cancelled', 'Cancelled']];

export default function AdminInstallations() {
  const [filter, setFilter] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const [reasonFor, setReasonFor] = useState(null);
  const [reason, setReason] = useState('');

  const load = useCallback(() => api.adminInstalls(filter).then(setData).catch((e) => setError(e.message)), [filter]);
  useEffect(() => { setData(null); load(); }, [load]);

  const act = async (ref, fn) => {
    setBusy(ref); setError(null);
    try { await fn(); setReasonFor(null); setReason(''); await load(); } catch (e) { setError(e.message); }
    setBusy(null);
  };

  const s = data?.stats;
  return (
    <>
      <div className="section-head"><div><h2 className="dash-h2">Installations</h2><p className="muted">Customers&apos; installation jobs. Change the prices and the installer share under Pricing &amp; rules.</p></div></div>
      {s && (
        <div className="stat-row">
          <div className="stat-card"><span>Finding installer</span><strong>{s.open}</strong></div>
          <div className="stat-card"><span>In progress</span><strong>{s.assigned}</strong></div>
          <div className="stat-card"><span>Payouts owed</span><strong>{s.payoutsOwed}</strong></div>
          <div className="stat-card"><span>Refunds to send</span><strong>{s.refundsNeeded}</strong></div>
        </div>
      )}
      <div className="tabs" role="tablist" aria-label="Filter installations">
        {FILTERS.map(([v, l]) => <button key={l} type="button" role="tab" aria-selected={filter === v} className={filter === v ? 'is-active' : ''} onClick={() => setFilter(v)}>{l}</button>)}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {!data && !error && <p className="muted" role="status">Loading…</p>}
      {data?.requests.length === 0 && <div className="empty-card"><h3>Nothing here</h3><p>No installations in this list.</p></div>}
      <ul className="request-list">
        {data?.requests.filter((r) => filter || !['completed', 'cancelled'].includes(r.status) || r.payoutStatus === 'owed' || r.refundNeeded).map((r) => (
          <li key={r.ref} className="request-card">
            <div className="deal-top"><h3>{r.ref} · {r.systemKw} kW</h3><span className="badge badge-pending">{INSTALL_STATUS[r.status]}</span></div>
            <p>{r.description}</p>
            <p className="muted">{r.customerName} · {r.addressLine}, {r.areaId}, {r.state} · date {formatDate(r.preferredDate)}</p>
            <p className="muted">Fee {naira(r.price)} · installer gets {naira(r.installerPayout)}{r.installerName ? ` · installer: ${r.installerName}` : ' · no installer yet'}{r.alertedAt && r.status === 'open' ? ' · ALERTED: nobody has accepted' : ''}</p>
            <div className="row-actions">
              {r.payoutStatus === 'owed' && <button type="button" className="btn btn-primary btn-small" disabled={busy === r.ref} onClick={() => act(r.ref, () => api.adminInstallPayout(r.ref))}>Mark payout sent ({naira(r.installerPayout)})</button>}
              {r.refundNeeded && <button type="button" className="btn btn-primary btn-small" disabled={busy === r.ref} onClick={() => act(r.ref, () => api.adminInstallRefunded(r.ref))}>Mark refund sent ({naira(r.price)})</button>}
              {['open', 'assigned', 'installer_done'].includes(r.status) && <button type="button" className="btn btn-quiet btn-small" onClick={() => setReasonFor(reasonFor === r.ref ? null : r.ref)}>Cancel and refund</button>}
            </div>
            {reasonFor === r.ref && (
              <div className="review-box">
                <label className="field"><span>Why? (the customer is told)</span><input type="text" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
                <button type="button" className="btn btn-quiet" disabled={busy === r.ref || reason.trim().length < 3} onClick={() => act(r.ref, () => api.adminInstallCancel(r.ref, reason.trim()))}>Confirm cancellation</button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
