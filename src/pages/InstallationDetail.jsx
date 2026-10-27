import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { formatDate, naira } from '../lib/format.js';
import { INSTALL_STATUS } from './Installations.jsx';

const EVENT_TEXT = {
  quoted: 'Quote created', paid: 'Payment received', sent: 'Sent to installers', no_installers: 'No installers available yet',
  accepted: 'An installer accepted', declined: 'An installer passed on the job', installer_done: 'Installer marked the job done',
  confirmed: 'You confirmed the job', auto_closed: 'Closed automatically', cancelled: 'Cancelled', sla_alert: 'Our team was alerted',
};
const STEPS = ['open', 'assigned', 'installer_done', 'completed'];

export default function InstallationDetail() {
  const { ref } = useParams();
  const [r, setR] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api.installGet(ref).then((x) => setR(x.request)).catch((e) => setError(e.message)), [ref]);
  useEffect(() => { load(); }, [load]);

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

  const step = STEPS.indexOf(r.status);
  return (
    <div className="app-page">
      <p><Link to="/app/installations">← My installations</Link></p>
      <header className="page-head"><h1>{r.ref}</h1><span className={`badge badge-${r.status === 'completed' ? 'verified' : r.status === 'cancelled' ? 'rejected' : 'pending'}`}>{INSTALL_STATUS[r.status]}</span></header>
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
          <p>This is the fixed price for a {r.bandLabel.toLowerCase()} system. Pay to send the job to approved installers near you. If nobody accepts, we refund you.</p>
          <div className="row-actions">
            <button type="button" className="btn btn-primary" disabled={busy} onClick={pay}>{busy ? 'Taking you to payment…' : `Accept and pay ${naira(r.price)}`}</button>
            <button type="button" className="btn btn-quiet" disabled={busy} onClick={() => act(() => api.installCancel(ref))}>Cancel request</button>
          </div>
        </section>
      )}

      {step >= 0 && (
        <ol className="steps-list">
          {[['Finding an installer', 'We sent your job to approved installers in your state. The first one free on your date takes it.'], ['Installer confirmed', 'They will contact you before the date.'], ['Installation done', 'Check the work, then confirm below.'], ['Completed', 'All done.']].map(([t, d], i) => (
            <li key={t} className={i < step || (i === step && r.status === 'completed') ? 'done' : ''}>
              <span className="step-badge" aria-hidden="true">{i < step || r.status === 'completed' ? '✓' : i + 1}</span>
              <div><strong>{t}</strong>{i === step && <p>{d}</p>}</div>
            </li>
          ))}
        </ol>
      )}

      {r.installer && <p><strong>Your installer:</strong> {r.installer.name}{r.installer.phone && <> · <a href={`tel:${r.installer.phone}`}>{r.installer.phone}</a></>}</p>}

      {r.status === 'installer_done' && (
        <section className="fee-gate">
          <h2>Is the work finished?</h2>
          <p>Your installer says the job is done. Please check it. If you do nothing, the job closes by itself on {formatDate(r.autoCloseAt)} and the installer is paid.</p>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => act(() => api.installConfirm(ref))}>Yes, it is complete</button>
        </section>
      )}
      {r.status === 'cancelled' && <p className="muted">This request was cancelled. If you had paid, you will be refunded.</p>}

      {r.timeline?.length > 0 && (
        <>
          <h3 className="dash-h3">History</h3>
          <ul className="doc-list">{r.timeline.map((e, i) => <li key={i}><div><strong>{EVENT_TEXT[e.type] ?? e.type}</strong>{e.note && <small>{e.note}</small>}</div><small>{formatDate(e.at)}</small></li>)}</ul>
        </>
      )}
    </div>
  );
}
