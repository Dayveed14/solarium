import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, api } from '../../api.js';
import { formatDate, naira } from '../../lib/format.js';
import { PhotoPicker, PhotoTiles, REPAIR_STATUS, statusTone } from '../repairs/shared.jsx';

const blankPart = () => ({ name: '', qty: '1', unitPrice: '' });
const num = (v) => (v === '' || v == null ? NaN : Number(v));

// The inspection report: findings, parts, labour and a time estimate. The system adds the total; the customer sees it itemised.
function ReportForm({ job, onDone }) {
  const [findings, setFindings] = useState('');
  const [parts, setParts] = useState([blankPart()]);
  const [labour, setLabour] = useState('');
  const [hours, setHours] = useState('');
  const [files, setFiles] = useState([]);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const used = parts.filter((p) => p.name.trim() || p.unitPrice !== '');
  const total = used.reduce((s, p) => s + (num(p.qty) || 0) * (num(p.unitPrice) || 0), 0) + (num(labour) || 0);
  const setPart = (i, patch) => setParts((a) => a.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  const send = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null); setErrors({});
    try {
      for (const f of files) await api.techPhoto(job.ref, f.blob);
      await api.techReport(job.ref, {
        findings: findings.trim(), labour: num(labour) || 0, estimatedHours: num(hours),
        parts: used.map((p) => ({ name: p.name.trim(), qty: num(p.qty), unitPrice: num(p.unitPrice) })),
      });
      onDone();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'VALIDATION_ERROR') setErrors(err.details?.fields ?? {});
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={send} noValidate className="review-box">
      <h4 className="dash-h3">Inspection report</h4>
      <label className="field">
        <span>What did you find?</span>
        <textarea rows={4} maxLength={2000} value={findings} onChange={(e) => setFindings(e.target.value)} placeholder="The cause of the fault, what is damaged, what needs replacing or fixing." aria-invalid={Boolean(errors.findings)} />
        {errors.findings && <small className="err">{errors.findings}</small>}
      </label>
      <div className="field">
        <span>Parts needed (leave empty if none)</span>
        {parts.map((p, i) => (
          <div className="part-row" key={i}>
            <input type="text" aria-label={`Part ${i + 1} name`} placeholder="Part name" maxLength={120} value={p.name} onChange={(e) => setPart(i, { name: e.target.value })} />
            <input type="number" inputMode="numeric" aria-label={`Part ${i + 1} quantity`} min="1" max="999" value={p.qty} onChange={(e) => setPart(i, { qty: e.target.value })} />
            <input type="number" inputMode="numeric" aria-label={`Part ${i + 1} price each (naira)`} placeholder="₦ each" min="0" value={p.unitPrice} onChange={(e) => setPart(i, { unitPrice: e.target.value })} />
            {parts.length > 1 && <button type="button" className="btn btn-quiet btn-small" onClick={() => setParts((a) => a.filter((_, j) => j !== i))}>Remove</button>}
          </div>
        ))}
        {parts.length < 20 && <button type="button" className="btn btn-ghost btn-small" onClick={() => setParts((a) => [...a, blankPart()])}>Add another part</button>}
        {errors['parts.0.unitPrice'] && <small className="err">Check the part prices.</small>}
      </div>
      <div className="field-row">
        <label className="field"><span>Your labour (₦)</span><input type="number" inputMode="numeric" min="0" value={labour} onChange={(e) => setLabour(e.target.value)} placeholder="0" /></label>
        <label className="field"><span>Time to fix (hours)</span><input type="number" inputMode="numeric" min="1" max="720" value={hours} onChange={(e) => setHours(e.target.value)} aria-invalid={Boolean(errors.estimatedHours)} />{errors.estimatedHours && <small className="err">{errors.estimatedHours}</small>}</label>
      </div>
      <div className="field">
        <span>Pictures of what you found</span>
        <PhotoPicker files={files} setFiles={setFiles} max={6} label="Add a picture" disabled={busy} />
      </div>
      <p className="cost-total">Total the customer will see: <strong>{naira(total)}</strong> <small>(their call-out fee of {naira(job.fee)} is credited)</small></p>
      <p className="muted">All payment happens inside TerraVoltix. Never ask the customer to pay you directly.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button type="submit" className="btn btn-primary" disabled={busy || findings.trim().length < 10 || !(num(hours) >= 1)}>{busy ? 'Sending…' : 'Send report to the customer'}</button>
    </form>
  );
}


// A change to the estimate found during the repair. The customer must approve and pay before it counts.
function VariationForm({ job, onDone, onCancel }) {
  const [reason, setReason] = useState('');
  const [parts, setParts] = useState([blankPart()]);
  const [labour, setLabour] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const used = parts.filter((p) => p.name.trim() || p.unitPrice !== '');
  const total = used.reduce((x, p) => x + (num(p.qty) || 0) * (num(p.unitPrice) || 0), 0) + (num(labour) || 0);
  const setPart = (i, patch) => setParts((a) => a.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const send = async (e) => {
    e.preventDefault(); setBusy(true); setError(null);
    try {
      await api.techVariation(job.ref, { reason: reason.trim(), labour: num(labour) || 0, parts: used.map((p) => ({ name: p.name.trim(), qty: num(p.qty), unitPrice: num(p.unitPrice) })) });
      onDone();
    } catch (err) { setError(err.message); setBusy(false); }
  };
  return (
    <form onSubmit={send} noValidate className="review-box">
      <h4 className="dash-h3">Ask the customer to approve extra work</h4>
      <label className="field"><span>Why does the cost change?</span><textarea rows={3} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
      <div className="field">
        <span>Extra parts (leave empty if none)</span>
        {parts.map((p, i) => (
          <div className="part-row" key={i}>
            <input type="text" aria-label={`Extra part ${i + 1} name`} placeholder="Part name" maxLength={120} value={p.name} onChange={(e) => setPart(i, { name: e.target.value })} />
            <input type="number" inputMode="numeric" aria-label={`Extra part ${i + 1} quantity`} min="1" max="999" value={p.qty} onChange={(e) => setPart(i, { qty: e.target.value })} />
            <input type="number" inputMode="numeric" aria-label={`Extra part ${i + 1} price each (naira)`} placeholder="₦ each" min="0" value={p.unitPrice} onChange={(e) => setPart(i, { unitPrice: e.target.value })} />
            {parts.length > 1 && <button type="button" className="btn btn-quiet btn-small" onClick={() => setParts((a) => a.filter((_, j) => j !== i))}>Remove</button>}
          </div>
        ))}
        {parts.length < 20 && <button type="button" className="btn btn-ghost btn-small" onClick={() => setParts((a) => [...a, blankPart()])}>Add another part</button>}
      </div>
      <label className="field"><span>Extra labour (₦)</span><input type="number" inputMode="numeric" min="0" value={labour} onChange={(e) => setLabour(e.target.value)} placeholder="0" /></label>
      <p className="cost-total">Extra cost the customer will see: <strong>{naira(total)}</strong></p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="row-actions">
        <button type="submit" className="btn btn-primary" disabled={busy || reason.trim().length < 10 || total <= 0}>{busy ? 'Sending…' : 'Send to the customer'}</button>
        <button type="button" className="btn btn-quiet" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

// Finished: pictures of the work and a short summary. The customer then has a set time to confirm.
function CompleteForm({ job, onDone, onCancel }) {
  const [summary, setSummary] = useState('');
  const [files, setFiles] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const have = job.work?.completionPhotos ?? [];
  const send = async (e) => {
    e.preventDefault(); setBusy(true); setError(null);
    try {
      for (const f of files) await api.techCompletionPhoto(job.ref, f.blob);
      await api.techComplete(job.ref, summary.trim());
      onDone();
    } catch (err) { setError(err.message); setBusy(false); }
  };
  return (
    <form onSubmit={send} noValidate className="review-box">
      <h4 className="dash-h3">Report the repair as finished</h4>
      <label className="field"><span>What did you do?</span><textarea rows={3} maxLength={2000} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="What you fixed or replaced and how you tested it." /></label>
      <div className="field">
        <span>Pictures of the finished work (at least one)</span>
        <PhotoTiles base={`/installer/repairs/${job.ref}`} ids={have} />
        <PhotoPicker files={files} setFiles={setFiles} max={Math.max(0, 6 - have.length)} label="Add a picture" disabled={busy} />
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="row-actions">
        <button type="submit" className="btn btn-primary" disabled={busy || summary.trim().length < 10 || (files.length + have.length) === 0}>{busy ? 'Sending…' : 'Send to the customer'}</button>
        <button type="button" className="btn btn-quiet" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function JobCard({ job, onChange, setError }) {
  const [busy, setBusy] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [panel, setPanel] = useState(null); // 'variation' | 'finish' | 'parts'
  const [note, setNote] = useState('');
  const act = async (fn) => {
    setBusy(true); setError(null);
    try { await fn(); await onChange(); } catch (e) { setError(e.message); }
    setBusy(false);
  };
  return (
    <li className="request-card">
      <div className="deal-top"><h3>{job.ref} · {job.fault}</h3><span className={`badge badge-${statusTone(job.status)}`}>{REPAIR_STATUS[job.status] ?? job.status}</span></div>
      <p>{job.description}</p>
      <p className="muted">Equipment: {job.equipment.join(', ')} · {job.urgent ? 'URGENT' : 'Normal'}</p>
      {job.address && <p><strong>{job.address}</strong><br /><span className="muted">{job.customer.name} · <a href={`tel:${job.customer.phone}`}>{job.customer.phone}</a></span></p>}
      <PhotoTiles base={`/installer/repairs/${job.ref}`} ids={job.faultPhotos} />
      <p className="muted">Your share of the call-out fee: {naira(job.youEarn)}</p>
      <div className="row-actions">
        {job.status === 'assigned' && <button type="button" className="btn btn-primary" disabled={busy} onClick={() => act(() => api.techOnMyWay(job.ref))}>I&apos;m on my way</button>}
        {job.status === 'on_the_way' && <button type="button" className="btn btn-primary" disabled={busy} onClick={() => act(() => api.techArrived(job.ref))}>I have arrived</button>}
        {job.status === 'on_site' && !reporting && <button type="button" className="btn btn-primary" onClick={() => setReporting(true)}>Write the inspection report</button>}
      </div>
      {job.status === 'on_site' && reporting && <ReportForm job={job} onDone={onChange} />}
      {job.status === 'inspected' && <p className="muted">The customer has your estimate. When they approve and pay, you can start.</p>}
      {job.work && job.status !== 'inspected' && <RepairProgress job={job} act={act} busy={busy} panel={panel} setPanel={setPanel} note={note} setNote={setNote} onChange={onChange} />}
      {job.status === 'cancelled' && <p className="muted">Cancelled.{job.payoutStatus !== 'none' && <> You earn {naira(job.payoutAmount)} for the visit ({job.payoutStatus === 'paid' ? 'sent' : 'on its way'}).</>}</p>}
      {job.report && (
        <div className="review-box">
          <p><strong>Your report</strong></p>
          <p className="request-message">{job.report.findings}</p>
          <PhotoTiles base={`/installer/repairs/${job.ref}`} ids={job.report.photos} />
          <p>Total {naira(job.report.total)} · estimated {job.report.estimatedHours} h · you earn {naira(job.report.youEarn)} if the customer goes ahead.</p>
          
        </div>
      )}
    </li>
  );
}

// Work in progress: start, parts, changes, finishing, and what is owed.
function RepairProgress({ job, act, busy, panel, setPanel, note, setNote, onChange }) {
  const w = job.work;
  const pending = w.variations.find((v) => v.status === 'proposed');
  const close = () => { setPanel(null); onChange(); };
  return (
    <div className="review-box">
      <p><strong>The repair</strong> · agreed {naira(w.agreedTotal)} · you earn {naira(w.youEarn)} when the customer confirms</p>
      {job.status === 'approved' && <div className="row-actions"><button type="button" className="btn btn-primary" disabled={busy} onClick={() => act(() => api.techStart(job.ref))}>Start repair</button></div>}
      {job.status === 'awaiting_parts' && <><p className="muted">Waiting for parts: {w.partsNote}</p><div className="row-actions"><button type="button" className="btn btn-primary" disabled={busy} onClick={() => act(() => api.techPartsArrived(job.ref))}>Parts arrived: continue</button></div></>}
      {pending && (
        <p>You asked for {naira(pending.extraTotal)} extra. Waiting for the customer. <button type="button" className="btn btn-quiet btn-small" disabled={busy} onClick={() => act(() => api.techVariationWithdraw(job.ref, pending.id))}>Withdraw</button></p>
      )}
      {w.variations.filter((v) => v.status !== 'proposed').map((v) => <p className="muted" key={v.id}>Revision {naira(v.extraTotal)}: {v.status}</p>)}
      {['in_repair', 'awaiting_parts'].includes(job.status) && !panel && (
        <div className="row-actions">
          {job.status === 'in_repair' && <button type="button" className="btn btn-ghost btn-small" onClick={() => setPanel('parts')}>Waiting for parts</button>}
          {!pending && <button type="button" className="btn btn-ghost btn-small" onClick={() => setPanel('variation')}>Extra work needed</button>}
          {job.status === 'in_repair' && <button type="button" className="btn btn-primary btn-small" onClick={() => setPanel('finish')}>Repair finished</button>}
        </div>
      )}
      {panel === 'parts' && (
        <div className="review-box">
          <label className="field"><span>Which parts are you waiting for?</span><input type="text" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} /></label>
          <div className="row-actions">
            <button type="button" className="btn btn-primary" disabled={busy || note.trim().length < 5} onClick={() => act(async () => { await api.techAwaitingParts(job.ref, note.trim()); setNote(''); setPanel(null); })}>Tell the customer</button>
            <button type="button" className="btn btn-quiet" onClick={() => setPanel(null)}>Cancel</button>
          </div>
        </div>
      )}
      {panel === 'variation' && <VariationForm job={job} onDone={close} onCancel={() => setPanel(null)} />}
      {panel === 'finish' && <CompleteForm job={job} onDone={close} onCancel={() => setPanel(null)} />}
      {job.status === 'repair_done' && !w.problem && <p className="muted">Waiting for the customer to confirm{w.confirmDueAt ? `; it closes by itself on ${new Date(w.confirmDueAt).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Lagos' })}` : ''}.</p>}
      {job.status === 'repair_done' && w.problem && <p className="form-error">The customer reported a problem. TerraVoltix will contact you.</p>}
      {w.completion && <PhotoTiles base={`/installer/repairs/${job.ref}`} ids={w.completionPhotos} />}
      {job.status === 'completed' && <p>Complete. Payout {naira(job.payoutAmount)}: <strong>{job.payoutStatus === 'paid' ? 'sent' : 'on its way'}</strong>.{w.review && <> Customer rating: {'★'.repeat(w.review.rating)}{'☆'.repeat(5 - w.review.rating)}{w.review.comment ? ` · "${w.review.comment}"` : ''}</>}</p>}
    </div>
  );
}

// An approved technician's repair work: offers to answer, and the jobs they have taken.
export default function RepairJobs() {
  const [offers, setOffers] = useState(null);
  const [mine, setMine] = useState(null);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    try {
      const [o, m] = await Promise.all([api.techOffers(), api.techRepairs()]);
      setOffers(o.offers); setMine(m.jobs); setSummary({ earnings: m.earnings, rating: m.rating });
    } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, [load]);

  const answer = async (ref, fn) => {
    setBusy(ref); setError(null);
    try { await fn(ref); } catch (e) { setError(e.message); }
    await load();
    setBusy(null);
  };

  return (
    <div className="wrap dash">
      <header className="dash-head"><div><p className="eyebrow">Installer account</p><h1>Repair jobs</h1></div></header>
      {error && <p className="form-error" role="alert">{error}</p>}
      {!offers && !error && <p className="muted" role="status">Loading…</p>}

      <h2 className="dash-h2">Waiting for your answer</h2>
      {offers?.length === 0 && <div className="empty-card"><h3>No offers right now</h3><p>When our team picks you for a repair near you, it shows here and you get an email. You have a limited time to answer before it goes to the next technician. <Link to="/app/installer-profile">Update your work profile</Link> to change how far you travel or switch repairs on or off.</p></div>}
      <ul className="request-list">
        {offers?.map((o) => (
          <li key={o.ref} className="request-card">
            <div className="deal-top"><h3>{o.fault} · {o.area}</h3><strong>You earn {naira(o.youEarn)}</strong></div>
            <p>{o.description}</p>
            <p className="muted">Equipment: {o.equipment.join(', ')} · {o.urgent ? 'URGENT' : 'Normal'} · about {o.distanceKm} km from you</p>
            <p className="muted">Answer by {new Date(o.answerBy).toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Lagos' })} ({formatDate(o.answerBy)}). You see the address after you accept.</p>
            <div className="row-actions">
              <button type="button" className="btn btn-primary" disabled={busy === o.ref} onClick={() => answer(o.ref, api.techAccept)}>Accept the job</button>
              <button type="button" className="btn btn-quiet" disabled={busy === o.ref} onClick={() => answer(o.ref, api.techDecline)}>Decline</button>
            </div>
          </li>
        ))}
      </ul>

      {summary && (
        <div className="stat-row">
          <div className="stat-card"><span>Payouts on their way</span><strong>{naira(summary.earnings.owed)}</strong></div>
          <div className="stat-card"><span>Paid out so far</span><strong>{naira(summary.earnings.paid)}</strong></div>
          <div className="stat-card"><span>Customer rating</span><strong>{summary.rating.count ? `${summary.rating.average} ★ (${summary.rating.count})` : 'No reviews yet'}</strong></div>
        </div>
      )}
      <h2 className="dash-h2">My repair jobs</h2>
      {mine?.length === 0 && <p className="muted">You have not taken a repair job yet.</p>}
      <ul className="request-list">{mine?.map((j) => <JobCard key={j.ref} job={j} onChange={load} setError={setError} />)}</ul>
    </div>
  );
}
