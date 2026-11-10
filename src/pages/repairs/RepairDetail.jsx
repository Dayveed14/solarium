import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api.js';
import { formatDate, naira } from '../../lib/format.js';
import { PROGRESS, PayNotice, PhotoPicker, PhotoTiles, REPAIR_STATUS, progressIndex, statusTone } from './shared.jsx';

const stamp = (iso) => new Date(iso).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Lagos' });

// One repair: the call-out fee to pay, then the technician, the visit, the inspection report and the cost, with a history of every step.
export default function RepairDetail() {
  const { ref } = useParams();
  const [r, setR] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [extra, setExtra] = useState([]);
  const [sure, setSure] = useState(false);

  const load = useCallback(() => api.repairGet(ref).then((x) => setR(x.request)).catch((e) => setError(e.message)), [ref]);
  useEffect(() => { load(); }, [load]);
  // While the job is moving, check for news now and then.
  useEffect(() => {
    if (!r || ['quote', 'awaiting_payment', 'completed', 'cancelled'].includes(r.status)) return undefined;
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [r, load]);

  const act = async (fn) => {
    setBusy(true); setError(null);
    try { await fn(); await load(); } catch (e) { setError(e.message); }
    setBusy(false);
  };
  const pay = () => act(async () => { const p = await api.repairPay(ref); window.location.assign(p.authorizationUrl); });
  const addPictures = () => act(async () => { for (const f of extra) await api.repairPhoto(ref, f.blob); setExtra([]); });

  if (error && !r) return <div className="app-page"><p className="form-error" role="alert">{error}</p><Link to="/app/repairs">Back</Link></div>;
  if (!r) return <div className="app-page"><p className="muted" role="status">Loading…</p></div>;

  const unpaid = ['quote', 'awaiting_payment'].includes(r.status);
  const step = progressIndex(r.status);
  const canCancel = ['finding', 'assigned', 'on_the_way'].includes(r.status);
  const refundText = r.status === 'on_the_way' ? `Because the technician has already set off, half of your call-out fee (${naira(Math.round(r.callOutFee / 2))}) is refunded.` : `You get your full call-out fee (${naira(r.callOutFee)}) back.`;

  return (
    <div className="app-page">
      <p><Link to="/app/repairs">← My repairs</Link></p>
      <header className="page-head"><div><h1>{r.fault}</h1><p className="muted">{r.ref}</p></div><span className={`badge badge-${statusTone(r.status)}`}>{REPAIR_STATUS[r.status]}</span></header>
      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="stat-row">
        <div className="stat-card"><span>Call-out fee</span><strong>{naira(r.callOutFee)}</strong></div>
        <div className="stat-card"><span>Distance band</span><strong>{r.feeBand}</strong></div>
        <div className="stat-card"><span>Urgency</span><strong>{r.urgency === 'urgent' ? 'Urgent' : 'Normal'}</strong></div>
      </div>
      <p>{r.description}</p>
      <p className="muted">{r.address.line}, {r.address.place}</p>
      <PhotoTiles base={`/repairs/${r.ref}`} ids={r.photos} onRemove={unpaid ? (id) => act(() => api.repairPhotoDelete(ref, id)) : null} />

      {unpaid && (
        <section className="fee-gate">
          <h2>Pay the call-out fee: {naira(r.callOutFee)}</h2>
          <p>This sends a technician to inspect the fault. It is fixed for your address and is credited against the repair if you go ahead. If we cannot send anyone, you are refunded.</p>
          <PayNotice text={r.payNotice} />
          <div className="field">
            <span>Add more pictures</span>
            <PhotoPicker files={extra} setFiles={setExtra} max={Math.max(0, 4 - (r.photos?.length ?? 0))} label="Add a picture" disabled={busy} />
            {extra.length > 0 && <button type="button" className="btn btn-ghost btn-small" disabled={busy} onClick={addPictures}>Upload these pictures</button>}
          </div>
          <div className="row-actions">
            <button type="button" className="btn btn-primary" disabled={busy} onClick={pay}>{busy ? 'Please wait…' : `Pay ${naira(r.callOutFee)}`}</button>
            <button type="button" className="btn btn-quiet" disabled={busy} onClick={() => act(() => api.repairCancel(ref))}>Cancel request</button>
          </div>
        </section>
      )}

      {step >= 0 && r.status !== 'cancelled' && (
        <ol className="steps-list">
          {PROGRESS.map(([key, title], i) => (
            <li key={key} className={i < step || (i === step && r.status === 'inspected') ? 'done' : ''}>
              <span className="step-badge" aria-hidden="true">{i < step || (i === step && r.status === 'inspected') ? '✓' : i + 1}</span>
              <div><strong>{title}</strong>{i === step && r.status === 'finding' && <p>We are choosing the best technician near you. You will get an email as soon as one accepts.</p>}</div>
            </li>
          ))}
        </ol>
      )}

      {r.technician && <p><strong>Your technician:</strong> {r.technician.name}{r.technician.phone && <> · <a href={`tel:${r.technician.phone}`}>{r.technician.phone}</a></>}</p>}
      {r.status === 'on_the_way' && <aside className="r-banner"><div><strong>Your technician is on the way.</strong><span>Please make sure someone is at the address.</span></div></aside>}

      {r.report && (
        <section className="fee-gate" aria-label="Inspection report">
          <h2>Inspection report</h2>
          <p><strong>What the technician found</strong></p>
          <p className="request-message">{r.report.findings}</p>
          <PhotoTiles base={`/repairs/${r.ref}`} ids={r.report.photos} />
          <table className="cost-table">
            <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Amount</th></tr></thead>
            <tbody>
              {r.report.parts.map((p, i) => <tr key={i}><td>{p.name}</td><td>{p.qty}</td><td>{naira(p.unitPrice)}</td><td>{naira(p.amount)}</td></tr>)}
              <tr><td colSpan="3">Labour</td><td>{naira(r.report.labour)}</td></tr>
            </tbody>
            <tfoot>
              <tr><th colSpan="3">Total repair cost</th><th>{naira(r.report.total)}</th></tr>
              <tr><td colSpan="3">Call-out fee already paid (credited)</td><td>− {naira(r.report.callOutCredit)}</td></tr>
              <tr><th colSpan="3">Still to pay if you go ahead</th><th>{naira(r.report.amountDue)}</th></tr>
            </tfoot>
          </table>
          <p className="muted">Estimated time to fix: about {r.report.estimatedHours} hour{r.report.estimatedHours === 1 ? '' : 's'}.</p>
          <PayNotice text={r.payNotice} />
          <p className="muted">Approving and paying for the repair in the app comes next. Nothing is charged until you approve.</p>
        </section>
      )}

      {canCancel && !sure && <p><button type="button" className="btn btn-quiet" disabled={busy} onClick={() => setSure(true)}>Cancel this repair</button></p>}
      {canCancel && sure && (
        <div className="review-box">
          <p><strong>Cancel this repair?</strong> {refundText}</p>
          <div className="row-actions">
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => act(async () => { await api.repairCancel(ref); setSure(false); })}>Yes, cancel</button>
            <button type="button" className="btn btn-quiet" onClick={() => setSure(false)}>Keep it</button>
          </div>
        </div>
      )}
      {r.status === 'cancelled' && <p className="muted">This request was cancelled.{r.refund?.amount > 0 && <> A refund of <strong>{naira(r.refund.amount)}</strong> is {r.refund.pending ? 'being processed by our team' : 'on its way to you'}.</>}</p>}

      {r.timeline?.length > 0 && (
        <>
          <h3 className="dash-h3">History</h3>
          <ul className="doc-list">{r.timeline.map((e, i) => <li key={i}><div><strong>{e.text}</strong>{e.note && <small>{e.note}</small>}</div><small>{stamp(e.at)}</small></li>)}</ul>
        </>
      )}
    </div>
  );
}
