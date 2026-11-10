import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api.js';
import { formatDate, naira } from '../../lib/format.js';
import { INSTALL_STATUS } from '../Installations.jsx';
import { PhotoTiles } from '../repairs/shared.jsx';

const FILTERS = [['needs_action', 'Needs you'], ['', 'All active'], ['finding', 'Finding'], ['assigned', 'Assigned'], ['in_progress', 'In progress'], ['installer_done', 'Finished'], ['completed', 'Completed'], ['cancelled', 'Cancelled']];
const MATCH = { queued: 'Waiting its turn', recommended: 'Recommended: your decision', offered: 'Offered to the installer', accepted: 'Accepted', declined: 'Declined', timed_out: 'Did not answer', passed: 'Passed over' };
const at = (iso) => new Date(iso).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Lagos' });
const CANCELLABLE = ['finding', 'assigned', 'on_the_way', 'on_site', 'in_progress', 'installer_done'];

function Detail({ refId, onChanged, setError }) {
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const load = useCallback(() => api.adminInstall(refId).then(setD).catch((e) => setError(e.message)), [refId, setError]);
  useEffect(() => { load(); }, [load]);
  const act = async (fn) => {
    setBusy(true); setError(null);
    try { await fn(); setCancelling(false); setReason(''); await load(); await onChanged(); } catch (e) { setError(e.message); }
    setBusy(false);
  };
  if (!d) return <p className="muted" role="status">Loading…</p>;
  const r = d.request;
  const w = d.work;
  const rec = d.matches.find((m) => m.status === 'recommended');
  const offered = d.matches.find((m) => m.status === 'offered');
  const base = `/admin/installations/${r.ref}`;
  const ids = (kind) => d.photos.filter((p) => p.kind === kind).map((p) => p.id);
  return (
    <div className="review-box">
      <p>{r.description}</p>
      <p className="muted">{r.systemKw} kW · {r.addressLine}, {r.place} · {r.customer?.name} · {r.customer?.phone} · date {formatDate(r.preferredDate)}</p>
      <p className="muted">Customer paid {naira(r.price)} · installer share {naira(r.installerPayout)}{r.installer ? ` · installer: ${r.installer.name} (${r.installer.phone ?? 'no phone'})` : ''}</p>

      {r.status === 'finding' && (
        <>
          {rec && (
            <div className="fee-gate">
              <h4 className="dash-h3">Recommended: {rec.installerName}</h4>
              <p className="muted">Score {rec.score} · about {rec.distanceKm} km away · if you do nothing it is approved automatically at {at(rec.adminDueAt)} ({d.adminMinutes} minutes after it was recommended).</p>
              <div className="row-actions">
                <button type="button" className="btn btn-primary" disabled={busy} onClick={() => act(() => api.adminInstallApprove(r.ref))}>Approve {rec.installerName}</button>
                <button type="button" className="btn btn-quiet" disabled={busy} onClick={() => act(() => api.adminInstallDecline(r.ref))}>Decline: recommend the next one</button>
              </div>
            </div>
          )}
          {offered && <p className="muted">Offered to <strong>{offered.installerName}</strong>{offered.decidedBy === 'auto' ? ' (approved automatically)' : ''}. They must answer by {at(offered.techDueAt)}, then it moves on.</p>}
          {!rec && !offered && <p className="form-error" role="alert">Nobody is waiting on this job. Choose an installer below or cancel and refund.</p>}
          <h4 className="dash-h3">Choose another installer</h4>
          {d.choices.length === 0 ? <p className="muted">No installer is in range right now.</p> : (
            <ul className="doc-list">
              {d.choices.map((c) => (
                <li key={c.id}>
                  <div><strong>{c.name}</strong><small>Score {c.score} · {c.distanceKm} km · {c.activeJobs} active · {c.completedJobs} completed{c.atCapacity ? ' · AT CAPACITY' : ''}</small></div>
                  <button type="button" className="btn btn-ghost btn-small" disabled={busy} onClick={() => act(() => api.adminInstallAssign(r.ref, c.id))}>Offer the job</button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {d.matches.length > 0 && (
        <>
          <h4 className="dash-h3">Ranked list</h4>
          <ol className="doc-list">
            {d.matches.map((m) => <li key={m.id}><div><strong>{m.rank || '·'}. {m.installerName}</strong><small>Score {m.score} · {m.distanceKm} km{m.decidedBy ? ` · ${m.decidedBy === 'auto' ? 'automatic' : 'admin'}` : ''}</small></div><small>{MATCH[m.status]}</small></li>)}
          </ol>
        </>
      )}

      {w && (
        <>
          {(w.beforePhotos.length > 0 || w.afterPhotos.length > 0) && <><h4 className="dash-h3">Before</h4><PhotoTiles base={base} ids={ids('before')} /><h4 className="dash-h3">After</h4><PhotoTiles base={base} ids={ids('after')} /></>}
          {w.completion && <><h4 className="dash-h3">Completion report</h4><p className="request-message">{w.completion.summary}</p></>}
          {w.problem && <p className="form-error" role="alert">Customer reported a problem on {at(w.problem.at)}: {w.problem.note}</p>}
          {r.status === 'installer_done' && !w.problem && <p className="muted">Closes automatically if the customer does not reply.</p>}
          {w.review && <p className="muted">Customer review: {'★'.repeat(w.review.rating)}{'☆'.repeat(5 - w.review.rating)}{w.review.comment ? ` · "${w.review.comment}"` : ''}</p>}
          <p className="muted">Payout: <strong>{w.payoutStatus === 'none' ? 'not yet' : `${naira(w.payoutAmount)} ${w.payoutStatus === 'paid' ? '(sent)' : '(owed)'}`}</strong></p>
        </>
      )}

      <h4 className="dash-h3">History</h4>
      <ul className="doc-list">{d.timeline.map((e, i) => <li key={i}><div><strong>{e.type.replace(/_/g, ' ')}</strong><small>{e.actor}{e.note ? ` · ${e.note}` : ''}</small></div><small>{at(e.at)}</small></li>)}</ul>

      <div className="row-actions">
        {r.status === 'installer_done' && <button type="button" className="btn btn-primary btn-small" disabled={busy} onClick={() => act(() => api.adminInstallConfirm(r.ref))}>Close the job (confirm for the customer)</button>}
        {r.payoutStatus === 'owed' && <button type="button" className="btn btn-primary btn-small" disabled={busy} onClick={() => act(() => api.adminInstallPayout(r.ref))}>Mark payout sent ({naira(r.payoutAmount)})</button>}
        {r.refundNeeded && <button type="button" className="btn btn-primary btn-small" disabled={busy} onClick={() => act(() => api.adminInstallRefunded(r.ref))}>Mark refund sent ({naira(r.refundAmount)})</button>}
        {CANCELLABLE.includes(r.status) && <button type="button" className="btn btn-quiet btn-small" onClick={() => setCancelling(!cancelling)}>Cancel and refund {naira(r.price)}</button>}
      </div>
      {cancelling && (
        <div className="review-box">
          <label className="field"><span>Why? (the customer is told)</span><input type="text" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
          <button type="button" className="btn btn-quiet" disabled={busy || reason.trim().length < 3} onClick={() => act(() => api.adminInstallCancel(r.ref, reason.trim()))}>Confirm cancellation</button>
        </div>
      )}
    </div>
  );
}

// Every installation request: the ranked installer waiting for your approval, and the follow-through.
export default function AdminInstallations() {
  const [filter, setFilter] = useState('needs_action');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(null);
  const load = useCallback(() => api.adminInstalls(filter).then(setData).catch((e) => setError(e.message)), [filter]);
  useEffect(() => { setData(null); load(); }, [load]);
  useEffect(() => { const t = setInterval(load, 60000); return () => clearInterval(t); }, [load]);
  const s = data?.stats;
  return (
    <>
      <div className="section-head"><div><h2 className="dash-h2">Installations</h2><p className="muted">Approve the installer the system recommends, or choose another; close finished jobs, send refunds and payouts. Change prices and the waiting times under Pricing &amp; rules → Installation.</p></div></div>
      {s && (
        <div className="stat-row">
          <div className="stat-card"><span>Finding an installer</span><strong>{s.finding}</strong></div>
          <div className="stat-card"><span>In progress</span><strong>{s.active}</strong></div>
          <div className="stat-card"><span>Waiting for the customer</span><strong>{s.waitingConfirm}</strong></div>
          <div className="stat-card"><span>Refunds to send</span><strong>{s.refundsNeeded}</strong></div>
          <div className="stat-card"><span>Payouts to send</span><strong>{s.payoutsOwed}</strong></div>
          <div className="stat-card"><span>Problems reported</span><strong>{s.problems}</strong></div>
        </div>
      )}
      <div className="tabs" role="tablist" aria-label="Filter installations">
        {FILTERS.map(([v, l]) => <button key={l} type="button" role="tab" aria-selected={filter === v} className={filter === v ? 'is-active' : ''} onClick={() => setFilter(v)}>{l}</button>)}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {!data && !error && <p className="muted" role="status">Loading…</p>}
      {data?.requests.length === 0 && <div className="empty-card"><h3>Nothing here</h3><p>{filter === 'needs_action' ? 'No installation is waiting for your decision.' : 'No installations in this list.'}</p></div>}
      <ul className="request-list">
        {data?.requests.filter((r) => filter || !['completed', 'cancelled'].includes(r.status) || r.refundNeeded || r.payoutStatus === 'owed').map((r) => (
          <li key={r.ref} className="request-card">
            <div className="deal-top"><h3>{r.ref} · {r.systemKw} kW</h3><span className="badge badge-pending">{INSTALL_STATUS[r.status]}</span></div>
            <p className="muted">{r.customerName} · {r.areaId}, {r.state} · {naira(r.price)} · {formatDate(r.createdAt)}{r.installerName ? ` · installer: ${r.installerName}` : ''}{r.matchState === 'recommended' ? ' · WAITING FOR YOUR APPROVAL' : ''}{r.matchState === 'offered' ? ' · offered, waiting for the installer' : ''}</p>
            <div className="row-actions"><button type="button" className="btn btn-ghost btn-small" onClick={() => setOpen(open === r.ref ? null : r.ref)}>{open === r.ref ? 'Close' : 'Open'}</button></div>
            {open === r.ref && <Detail refId={r.ref} onChanged={load} setError={setError} />}
          </li>
        ))}
      </ul>
    </>
  );
}
