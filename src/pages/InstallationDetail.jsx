import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { formatDate, naira } from '../lib/format.js';
import { INSTALL_STATUS } from './Installations.jsx';
import { PayNotice, PhotoTiles, Stars, statusTone } from './repairs/shared.jsx';

const stamp = (iso) => new Date(iso).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Lagos' });
const PROGRESS = [['finding', 'Finding an installer', 'We are choosing the best approved installer near you.'], ['assigned', 'Installer assigned', 'They will contact you before the date.'], ['on_the_way', 'On the way', 'Your installer has set off.'], ['on_site', 'At your site', 'They are taking pictures of the site before they begin.'], ['in_progress', 'Installing', 'The work is under way.'], ['installer_done', 'Please confirm', 'Check the work, then confirm below.'], ['completed', 'Completed', 'All done.']];
const idx = (s) => PROGRESS.findIndex(([k]) => k === s);

// The customer's view of an installation: pay, follow the installer, see the before and after pictures, confirm and review.
export default function InstallationDetail() {
  const { ref } = useParams();
  const [r, setR] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [problem, setProblem] = useState('');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(() => api.installGet(ref).then((x) => setR(x.request)).catch((e) => setError(e.message)), [ref]);
  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, [load]);

  const act = async (fn) => {
    setBusy(true);
    setError(null);
    try { await fn(); await load(); } catch (e) { setError(e.message); }
    setBusy(false);
  };
  const pay = () => act(async () => {
    const p = await api.installPay(ref);
    window.location.assign(p.authorizationUrl);
  });

  if (error && !r) return <div className="app-page"><p className="form-error" role="alert">{error}</p><Link to="/app/installations">Back</Link></div>;
  if (!r) return <div className="app-page"><p className="muted" role="status">Loading…</p></div>;

  const step = idx(r.status);
  const w = r.work;
  const noShowReady = r.noShowAfter && new Date(r.noShowAfter) <= new Date();
  const half = r.status === 'on_the_way';
  return (
    <div className="app-page">
      <p><Link to="/app/installations">← My installations</Link></p>
      <header className="page-head"><h1>{r.ref}</h1><span className={`badge badge-${statusTone(r.status)}`}>{INSTALL_STATUS[r.status]}</span></header>
      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="stat-row">
        <div className="stat-card"><span>Size</span><strong>{r.systemKw} kW</strong></div>
        <div className="stat-card"><span>Fee</span><strong>{naira(r.price)}</strong></div>
        <div className="stat-card"><span>Your date</span><strong>{formatDate(r.preferredDate)}</strong></div>
      </div>
      <p>{r.description}</p>
      <p className="muted">{r.address.line}, {r.address.place}</p>

      {(r.status === 'quote' || r.status === 'awaiting_payment') && (
        <section className="fee-gate">
          <h2>Your quote: {naira(r.price)}</h2>
          <p>This is the fixed price for a {r.bandLabel.toLowerCase()} system. We then pick the best approved installer near you. If nobody can take the job, we refund you in full.</p>
          <PayNotice text="If you pay an installer directly, we cannot protect your money or help if something goes wrong." />
          <div className="row-actions">
            <button type="button" className="btn btn-primary" disabled={busy} onClick={pay}>{busy ? 'Taking you to payment…' : `Accept and pay ${naira(r.price)}`}</button>
            <button type="button" className="btn btn-quiet" disabled={busy} onClick={() => act(() => api.installCancel(ref))}>Cancel request</button>
          </div>
        </section>
      )}

      {step >= 0 && (
        <ol className="steps-list">
          {PROGRESS.map(([k, t, d], i) => (
            <li key={k} className={i < step || r.status === 'completed' ? 'done' : ''}>
              <span className="step-badge" aria-hidden="true">{i < step || r.status === 'completed' ? '✓' : i + 1}</span>
              <div><strong>{t}</strong>{i === step && r.status !== 'completed' && <p>{d}</p>}</div>
            </li>
          ))}
        </ol>
      )}

      {r.installer && <p><strong>Your installer:</strong> {r.installer.name}{r.installer.phone && <> · <a href={`tel:${r.installer.phone}`}>{r.installer.phone}</a></>}</p>}

      {r.canCancel && step >= 0 && (
        <div className="row-actions">
          {!cancelling && <button type="button" className="btn btn-quiet btn-small" disabled={busy} onClick={() => setCancelling(true)}>Cancel this installation</button>}
          {noShowReady && <button type="button" className="btn btn-primary btn-small" disabled={busy} onClick={() => act(() => api.installNoShow(ref))}>The installer did not come: cancel for a full refund</button>}
        </div>
      )}
      {cancelling && (
        <div className="review-box">
          <p><strong>Cancel this installation?</strong> {half ? `Your installer has already set off, so only half the fee (${naira(Math.round(r.price / 2))}) is refunded.` : `You will be refunded the full ${naira(r.price)}.`}</p>
          <div className="row-actions">
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => act(async () => { await api.installCancel(ref); setCancelling(false); })}>Yes, cancel</button>
            <button type="button" className="btn btn-quiet" onClick={() => setCancelling(false)}>Keep it</button>
          </div>
        </div>
      )}
      {['on_site', 'in_progress'].includes(r.status) && <p className="muted">The installer is at your site, so it can no longer be cancelled here. Please talk to them, or contact TerraVoltix support.</p>}

      {w && (w.beforePhotos.length > 0 || w.afterPhotos.length > 0) && (
        <section className="review-box" aria-label="Pictures of the work">
          {w.beforePhotos.length > 0 && <><h3 className="dash-h3">Before</h3><PhotoTiles base={`/installations/${r.ref}`} ids={w.beforePhotos} /></>}
          {w.afterPhotos.length > 0 && <><h3 className="dash-h3">After</h3><PhotoTiles base={`/installations/${r.ref}`} ids={w.afterPhotos} /></>}
        </section>
      )}

      {r.status === 'installer_done' && (
        <section className="fee-gate">
          <h2>Is the work finished?</h2>
          {w?.completion && <p className="request-message">{w.completion.summary}</p>}
          {!w?.problem && <p>Please check it against the pictures above. If you do nothing, the job closes by itself on {stamp(r.autoCloseAt)} and the installer is paid.</p>}
          {w?.problem && <aside className="r-banner"><div><strong>You reported a problem.</strong><span>Our team is looking into it and will be in touch.</span></div></aside>}
          <div className="row-actions">
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => act(() => api.installConfirm(ref))}>{w?.problem ? 'It is sorted: confirm' : 'Yes, it is complete'}</button>
            {!w?.problem && !reporting && <button type="button" className="btn btn-quiet" disabled={busy} onClick={() => setReporting(true)}>Report a problem</button>}
          </div>
          {reporting && (
            <div className="review-box">
              <label className="field"><span>What is wrong?</span><textarea rows={3} maxLength={500} value={problem} onChange={(e) => setProblem(e.target.value)} /></label>
              <p className="muted">Reporting a problem stops the automatic close. Our team will contact you and the installer.</p>
              <div className="row-actions">
                <button type="button" className="btn btn-primary" disabled={busy || problem.trim().length < 10} onClick={() => act(async () => { await api.installProblem(ref, problem.trim()); setReporting(false); })}>Send to TerraVoltix</button>
                <button type="button" className="btn btn-quiet" onClick={() => setReporting(false)}>Never mind</button>
              </div>
            </div>
          )}
        </section>
      )}

      {r.status === 'completed' && w?.completion && <div className="review-box"><p><strong>Completion report</strong></p><p className="request-message">{w.completion.summary}</p></div>}
      {r.status === 'completed' && w && !w.review && (
        <div className="review-box">
          <p><strong>All done. How was your installer?</strong></p>
          <Stars value={rating} onChange={setRating} />
          <label className="field"><span>Anything to add? (optional)</span><input type="text" maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} /></label>
          <button type="button" className="btn btn-primary" disabled={busy || rating === 0} onClick={() => act(() => api.installReview(ref, { rating, ...(comment.trim() ? { comment: comment.trim() } : {}) }))}>Send review</button>
        </div>
      )}
      {w?.review && <p className="muted">Your review: {'★'.repeat(w.review.rating)}{'☆'.repeat(5 - w.review.rating)}{w.review.comment ? ` · "${w.review.comment}"` : ''}</p>}

      {r.status === 'cancelled' && <p className="muted">This request was cancelled.{r.refund?.amount > 0 && <> {r.refund.pending ? `Your refund of ${naira(r.refund.amount)} is being sent.` : `Your refund of ${naira(r.refund.amount)} has been sent.`}</>}</p>}

      {r.timeline?.length > 0 && (
        <>
          <h3 className="dash-h3">History</h3>
          <ul className="doc-list">{r.timeline.map((e, i) => <li key={i}><div><strong>{e.text}</strong>{e.note && <small>{e.note}</small>}</div><small>{formatDate(e.at)}</small></li>)}</ul>
        </>
      )}
    </div>
  );
}
