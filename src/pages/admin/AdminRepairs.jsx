import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api.js';
import { formatDate, naira } from '../../lib/format.js';
import { PhotoTiles, REPAIR_STATUS } from '../repairs/shared.jsx';

const FILTERS = [['needs_action', 'Needs you'], ['', 'All active'], ['assigned', 'Assigned'], ['on_the_way', 'On the way'], ['inspected', 'Inspected'], ['cancelled', 'Cancelled']];
const MATCH = { queued: 'Waiting its turn', recommended: 'Recommended: your decision', offered: 'Offered to the technician', accepted: 'Accepted', declined: 'Declined', timed_out: 'Did not answer', passed: 'Passed over' };
const at = (iso) => new Date(iso).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Lagos' });

function Detail({ refId, onChanged, setError }) {
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const load = useCallback(() => api.adminRepair(refId).then(setD).catch((e) => setError(e.message)), [refId, setError]);
  useEffect(() => { load(); }, [load]);
  const act = async (fn) => {
    setBusy(true); setError(null);
    try { await fn(); setCancelling(false); setReason(''); await load(); await onChanged(); } catch (e) { setError(e.message); }
    setBusy(false);
  };
  if (!d) return <p className="muted" role="status">Loading…</p>;
  const r = d.request;
  const rec = d.matches.find((m) => m.status === 'recommended');
  const offered = d.matches.find((m) => m.status === 'offered');
  return (
    <div className="review-box">
      <p><strong>{r.fault}</strong> · {r.equipment.join(', ')} · {r.urgency === 'urgent' ? 'URGENT' : 'normal'}</p>
      <p>{r.description}</p>
      <p className="muted">{r.addressLine}, {r.place} · {r.customer?.name} · {r.customer?.phone} · {r.distanceKm} km to the nearest technician when quoted</p>
      <PhotoTiles base={`/admin/repairs/${r.ref}`} ids={d.photos.filter((p) => p.kind === 'fault').map((p) => p.id)} />

      {r.status === 'finding' && (
        <>
          {rec && (
            <div className="fee-gate">
              <h4 className="dash-h3">Recommended: {rec.technicianName}</h4>
              <p className="muted">Score {rec.score} · about {rec.distanceKm} km away · if you do nothing it is approved automatically at {at(rec.adminDueAt)} ({d.adminMinutes} minutes after it was recommended).</p>
              <div className="row-actions">
                <button type="button" className="btn btn-primary" disabled={busy} onClick={() => act(() => api.adminRepairApprove(r.ref))}>Approve {rec.technicianName}</button>
                <button type="button" className="btn btn-quiet" disabled={busy} onClick={() => act(() => api.adminRepairDecline(r.ref))}>Decline: recommend the next one</button>
              </div>
            </div>
          )}
          {offered && <p className="muted">Offered to <strong>{offered.technicianName}</strong>{offered.decidedBy === 'auto' ? ' (approved automatically)' : ''}. They must answer by {at(offered.techDueAt)}, then it moves on.</p>}
          {!rec && !offered && <p className="form-error" role="alert">Nobody is waiting on this job. Choose a technician below or cancel and refund.</p>}
          <h4 className="dash-h3">Choose another technician</h4>
          {d.choices.length === 0 ? <p className="muted">No technician is in range right now.</p> : (
            <ul className="doc-list">
              {d.choices.map((c) => (
                <li key={c.id}>
                  <div><strong>{c.name}</strong><small>Score {c.score} · {c.distanceKm} km · {c.activeJobs} active · {c.completedJobs} completed{c.atCapacity ? ' · AT CAPACITY' : ''}</small></div>
                  <button type="button" className="btn btn-ghost btn-small" disabled={busy} onClick={() => act(() => api.adminRepairAssign(r.ref, c.id))}>Offer the job</button>
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
            {d.matches.map((m) => <li key={m.id}><div><strong>{m.rank || '·'}. {m.technicianName}</strong><small>Score {m.score} · {m.distanceKm} km{m.decidedBy ? ` · ${m.decidedBy === 'auto' ? 'automatic' : 'admin'}` : ''}</small></div><small>{MATCH[m.status]}</small></li>)}
          </ol>
        </>
      )}

      {d.report && (
        <>
          <h4 className="dash-h3">Technician&apos;s report</h4>
          <p className="request-message">{d.report.findings}</p>
          <p>Total {naira(d.report.total)} (parts {d.report.parts.map((p) => `${p.qty}× ${p.name}`).join(', ') || 'none'}; labour {naira(d.report.labour)}) · about {d.report.estimatedHours} h</p>
          <PhotoTiles base={`/admin/repairs/${r.ref}`} ids={d.report.photos} />
        </>
      )}

      <h4 className="dash-h3">History</h4>
      <ul className="doc-list">{d.timeline.map((e, i) => <li key={i}><div><strong>{e.type.replace(/_/g, ' ')}</strong><small>{e.actor}{e.note ? ` · ${e.note}` : ''}</small></div><small>{at(e.at)}</small></li>)}</ul>

      <div className="row-actions">
        {r.refundNeeded && <button type="button" className="btn btn-primary btn-small" disabled={busy} onClick={() => act(() => api.adminRepairRefunded(r.ref))}>Mark refund sent ({naira(r.refundAmount)})</button>}
        {['finding', 'assigned', 'on_the_way', 'on_site'].includes(r.status) && <button type="button" className="btn btn-quiet btn-small" onClick={() => setCancelling(!cancelling)}>Cancel and refund {naira(r.callOutFee)}</button>}
      </div>
      {cancelling && (
        <div className="review-box">
          <label className="field"><span>Why? (the customer is told)</span><input type="text" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
          <button type="button" className="btn btn-quiet" disabled={busy || reason.trim().length < 3} onClick={() => act(() => api.adminRepairCancel(r.ref, reason.trim()))}>Confirm cancellation</button>
        </div>
      )}
    </div>
  );
}

// Every repair request: the ranked technician waiting for your approval, and the follow-through.
export default function AdminRepairs() {
  const [filter, setFilter] = useState('needs_action');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(null);
  const load = useCallback(() => api.adminRepairs(filter).then(setData).catch((e) => setError(e.message)), [filter]);
  useEffect(() => { setData(null); load(); }, [load]);
  useEffect(() => { const t = setInterval(load, 60000); return () => clearInterval(t); }, [load]);
  const s = data?.stats;
  return (
    <>
      <div className="section-head"><div><h2 className="dash-h2">Repairs</h2><p className="muted">Approve the technician the system recommends, or choose another. Change call-out fees, the commission and the waiting times under Pricing &amp; rules → Repairs.</p></div></div>
      {s && (
        <div className="stat-row">
          <div className="stat-card"><span>Finding a technician</span><strong>{s.byStatus.finding ?? 0}</strong></div>
          <div className="stat-card"><span>In progress</span><strong>{(s.byStatus.assigned ?? 0) + (s.byStatus.on_the_way ?? 0) + (s.byStatus.on_site ?? 0)}</strong></div>
          <div className="stat-card"><span>Estimates sent</span><strong>{s.byStatus.inspected ?? 0}</strong></div>
          <div className="stat-card"><span>Refunds to send</span><strong>{s.refundsDue}</strong></div>
        </div>
      )}
      <div className="tabs" role="tablist" aria-label="Filter repairs">
        {FILTERS.map(([v, l]) => <button key={l} type="button" role="tab" aria-selected={filter === v} className={filter === v ? 'is-active' : ''} onClick={() => setFilter(v)}>{l}</button>)}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {!data && !error && <p className="muted" role="status">Loading…</p>}
      {data?.requests.length === 0 && <div className="empty-card"><h3>Nothing here</h3><p>{filter === 'needs_action' ? 'No repair is waiting for your decision.' : 'No repairs in this list.'}</p></div>}
      <ul className="request-list">
        {data?.requests.filter((r) => filter || !['completed', 'cancelled'].includes(r.status) || r.refundNeeded).map((r) => (
          <li key={r.ref} className="request-card">
            <div className="deal-top"><h3>{r.ref} · {r.faultType.replace(/_/g, ' ')}</h3><span className="badge badge-pending">{REPAIR_STATUS[r.status]}</span></div>
            <p className="muted">{r.customerName} · {r.areaId}, {r.state} · {r.urgency === 'urgent' ? 'URGENT · ' : ''}fee {naira(r.callOutFee)} · {formatDate(r.createdAt)}{r.technicianName ? ` · technician: ${r.technicianName}` : ''}{r.matchState === 'recommended' ? ' · WAITING FOR YOUR APPROVAL' : ''}{r.matchState === 'offered' ? ' · offered, waiting for the technician' : ''}</p>
            <div className="row-actions"><button type="button" className="btn btn-ghost btn-small" onClick={() => setOpen(open === r.ref ? null : r.ref)}>{open === r.ref ? 'Close' : 'Open'}</button></div>
            {open === r.ref && <Detail refId={r.ref} onChanged={load} setError={setError} />}
          </li>
        ))}
      </ul>
    </>
  );
}
