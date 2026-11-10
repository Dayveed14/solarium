import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import { formatDate, naira } from '../../lib/format.js';
import { INSTALL_STATUS } from '../Installations.jsx';
import { PhotoPicker, PhotoTiles, statusTone } from '../repairs/shared.jsx';

const stamp = (iso) => new Date(iso).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Lagos' });

// Adds pictures to a job right away (before or after), then refreshes.
function PhotoStep({ job, kind, label, onChange, setError }) {
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const ids = kind === 'before' ? job.work.beforePhotos : job.work.afterPhotos;
  const send = async () => {
    setBusy(true); setError(null);
    try { for (const f of files) await api.jobPhoto(job.ref, kind, f.blob); setFiles([]); await onChange(); } catch (e) { setError(e.message); }
    setBusy(false);
  };
  const remove = async (id) => { setError(null); try { await api.jobPhotoDelete(job.ref, id); await onChange(); } catch (e) { setError(e.message); } };
  return (
    <div className="field">
      <span>{label}</span>
      <PhotoTiles base={`/installer/jobs/${job.ref}`} ids={ids} onRemove={remove} />
      {ids.length < 6 && <PhotoPicker files={files} setFiles={setFiles} max={6 - ids.length} label="Add a picture" disabled={busy} />}
      {files.length > 0 && <button type="button" className="btn btn-primary btn-small" disabled={busy} onClick={send}>{busy ? 'Saving…' : `Save ${files.length} picture${files.length === 1 ? '' : 's'}`}</button>}
    </div>
  );
}

// The completion report: what was installed. The after pictures are already saved above it.
function CompleteForm({ job, onDone, setError }) {
  const [summary, setSummary] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try { await api.jobComplete(job.ref, summary.trim()); await onDone(); } catch (err) { setError(err.message); setBusy(false); }
  };
  return (
    <form onSubmit={send} noValidate className="review-box">
      <h4 className="dash-h3">Completion report</h4>
      <label className="field">
        <span>What did you install?</span>
        <textarea rows={4} maxLength={2000} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="The equipment fitted, how it is wired, anything the customer should know." />
      </label>
      <p className="muted">The customer sees your report with the before and after pictures and confirms the work. You are paid when they do.</p>
      <button type="submit" className="btn btn-primary" disabled={busy || summary.trim().length < 10 || job.work.afterPhotos.length === 0}>{busy ? 'Sending…' : 'Send the completion report'}</button>
      {job.work.afterPhotos.length === 0 && <small className="muted"> Add at least one &quot;after&quot; picture first.</small>}
    </form>
  );
}

function JobCard({ job, onChange, setError }) {
  const [busy, setBusy] = useState(false);
  const act = async (fn) => {
    setBusy(true); setError(null);
    try { await fn(); await onChange(); } catch (e) { setError(e.message); }
    setBusy(false);
  };
  const w = job.work;
  return (
    <li className="request-card">
      <div className="deal-top"><h3>{job.ref} · {job.systemKw} kW</h3><span className={`badge badge-${statusTone(job.status)}`}>{INSTALL_STATUS[job.status] ?? job.status}</span></div>
      <p>{job.description}</p>
      <p><strong>{job.address}</strong><br /><span className="muted">{job.customer.name} · <a href={`tel:${job.customer.phone}`}>{job.customer.phone}</a> · Date: {formatDate(job.preferredDate)}</span></p>
      <p className="muted">You earn {naira(job.pay)} when the customer confirms.</p>
      <div className="row-actions">
        {job.status === 'assigned' && <button type="button" className="btn btn-primary" disabled={busy} onClick={() => act(() => api.jobOnMyWay(job.ref))}>I&apos;m on my way</button>}
        {job.status === 'on_the_way' && <button type="button" className="btn btn-primary" disabled={busy} onClick={() => act(() => api.jobArrived(job.ref))}>I have arrived</button>}
        {job.status === 'on_site' && <button type="button" className="btn btn-primary" disabled={busy || w.beforePhotos.length === 0} onClick={() => act(() => api.jobStart(job.ref))}>Start the installation</button>}
      </div>
      {job.status === 'on_site' && <PhotoStep job={job} kind="before" label="Pictures of the site before you start (at least one)" onChange={onChange} setError={setError} />}
      {job.status === 'in_progress' && (
        <>
          {w.beforePhotos.length > 0 && <div><span className="muted">Before</span><PhotoTiles base={`/installer/jobs/${job.ref}`} ids={w.beforePhotos} /></div>}
          <PhotoStep job={job} kind="after" label="Pictures of the finished installation (at least one)" onChange={onChange} setError={setError} />
          <CompleteForm job={job} onDone={onChange} setError={setError} />
        </>
      )}
      {job.status === 'installer_done' && !w.problem && <p className="muted">Waiting for the customer to confirm. It closes by itself if they do not reply.</p>}
      {job.status === 'installer_done' && w.problem && <p className="form-error">The customer reported a problem. TerraVoltix will contact you.</p>}
      {['installer_done', 'completed'].includes(job.status) && (
        <div className="review-box">
          {w.completion && <p className="request-message">{w.completion.summary}</p>}
          <PhotoTiles base={`/installer/jobs/${job.ref}`} ids={[...w.beforePhotos, ...w.afterPhotos]} />
        </div>
      )}
      {job.status === 'completed' && <p>Complete. Payout {naira(job.payoutAmount)}: <strong>{job.payoutStatus === 'paid' ? 'sent' : 'on its way'}</strong>.{w.review && <> Customer rating: {'★'.repeat(w.review.rating)}{'☆'.repeat(5 - w.review.rating)}{w.review.comment ? ` · "${w.review.comment}"` : ''}</>}</p>}
      {job.status === 'cancelled' && <p className="muted">Cancelled.{job.payoutStatus !== 'none' && <> You earn {naira(job.payoutAmount)} for the trip ({job.payoutStatus === 'paid' ? 'sent' : 'on its way'}).</>}</p>}
    </li>
  );
}

// An approved installer's installation work: offers to answer, and the jobs they have taken.
export default function InstallerJobs() {
  const [offers, setOffers] = useState(null);
  const [mine, setMine] = useState(null);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const [sure, setSure] = useState(null);

  const load = useCallback(async () => {
    try {
      const [o, m] = await Promise.all([api.jobsOpen(), api.jobsMine()]);
      setOffers(o.jobs); setMine(m.jobs); setSummary({ earnings: m.earnings, rating: m.rating });
    } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, [load]);

  const answer = async (ref, fn) => {
    setBusy(ref); setError(null);
    try { await fn(ref); setSure(null); } catch (e) { setError(e.message); }
    await load();
    setBusy(null);
  };

  return (
    <div className="wrap dash">
      <header className="dash-head"><div><p className="eyebrow">Installer account</p><h1>Installation jobs</h1></div></header>
      {error && <p className="form-error" role="alert">{error}</p>}
      {!offers && !error && <p className="muted" role="status">Loading…</p>}

      <h2 className="dash-h2">Waiting for your answer</h2>
      {offers?.length === 0 && <div className="empty-card"><h3>No offers right now</h3><p>When our team picks you for an installation near you, it shows here and you get an email. You have a limited time to answer before it goes to the next installer. <Link to="/app/installer-profile">Update your work profile</Link> to change how far you travel or how many jobs you take.</p></div>}
      <ul className="request-list">
        {offers?.map((j) => (
          <li key={j.ref} className="request-card">
            <div className="deal-top"><h3>{j.systemKw} kW · {j.area}</h3><strong>You earn {naira(j.pay)}</strong></div>
            <p>{j.description}</p>
            <p className="muted">Customer&apos;s date: {formatDate(j.preferredDate)}.{j.answerBy ? ` Answer by ${stamp(j.answerBy)}.` : ''} You will see the full address after you accept.</p>
            {sure === j.ref ? (
              <div className="review-box">
                <p><strong>Can you be there on {formatDate(j.preferredDate)}?</strong> By accepting you confirm you are available and will do the job.</p>
                <div className="row-actions">
                  <button type="button" className="btn btn-primary" disabled={busy === j.ref} onClick={() => answer(j.ref, api.jobAccept)}>Yes, I am available. Accept</button>
                  <button type="button" className="btn btn-quiet" onClick={() => setSure(null)}>Not yet</button>
                </div>
              </div>
            ) : (
              <div className="row-actions">
                <button type="button" className="btn btn-primary" disabled={busy === j.ref} onClick={() => setSure(j.ref)}>Accept job</button>
                <button type="button" className="btn btn-quiet" disabled={busy === j.ref} onClick={() => answer(j.ref, api.jobDecline)}>Decline</button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {summary && (
        <div className="stat-row">
          <div className="stat-card"><span>Jobs completed</span><strong>{summary.earnings.completedJobs}</strong></div>
          <div className="stat-card"><span>Payouts on their way</span><strong>{naira(summary.earnings.owed)}</strong></div>
          <div className="stat-card"><span>Paid out so far</span><strong>{naira(summary.earnings.paid)}</strong></div>
          <div className="stat-card"><span>Customer rating</span><strong>{summary.rating.count ? `${summary.rating.average} ★ (${summary.rating.count})` : 'No reviews yet'}</strong></div>
        </div>
      )}
      <h2 className="dash-h2">My installation jobs</h2>
      {mine?.length === 0 && <p className="muted">You have not taken an installation job yet.</p>}
      <ul className="request-list">{mine?.map((j) => <JobCard key={j.ref} job={j} onChange={load} setError={setError} />)}</ul>
    </div>
  );
}
