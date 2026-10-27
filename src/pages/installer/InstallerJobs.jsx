import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api.js';
import { formatDate, naira } from '../../lib/format.js';

const STATUS = { assigned: 'In progress', installer_done: 'Waiting for the customer', completed: 'Completed', cancelled: 'Cancelled' };

// An approved installer's jobs: new jobs sent to them, and the ones they took.
export default function InstallerJobs() {
  const [open, setOpen] = useState(null);
  const [mine, setMine] = useState(null);
  const [earn, setEarn] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const [sure, setSure] = useState(null);

  const load = useCallback(async () => {
    try {
      const [o, m] = await Promise.all([api.jobsOpen(), api.jobsMine()]);
      setOpen(o.jobs);
      setMine(m.jobs);
      setEarn(m.earnings);
    } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async (ref, fn) => {
    setBusy(ref);
    setError(null);
    try { await fn(ref); setSure(null); } catch (e) { setError(e.message); }
    await load();
    setBusy(null);
  };

  return (
    <>
      {error && <p className="form-error" role="alert">{error}</p>}
      {earn && (
        <div className="stat-row">
          <div className="stat-card"><span>Jobs completed</span><strong>{earn.completedJobs}</strong></div>
          <div className="stat-card"><span>Owed to you</span><strong>{naira(earn.owed)}</strong></div>
          <div className="stat-card"><span>Paid out</span><strong>{naira(earn.paid)}</strong></div>
        </div>
      )}

      <h2 className="dash-h2">New jobs</h2>
      {!open && !error && <p className="muted" role="status">Loading…</p>}
      {open?.length === 0 && <div className="empty-card"><h3>No new jobs right now</h3><p>When a customer in your state requests an installation you will get an email and the job will show here. The first approved installer to accept it gets it.</p></div>}
      <ul className="request-list">
        {open?.map((j) => (
          <li key={j.ref} className="request-card">
            <div className="deal-top"><h3>{j.systemKw} kW · {j.area}</h3><strong>You earn {naira(j.pay)}</strong></div>
            <p>{j.description}</p>
            <p className="muted">Customer&apos;s date: {formatDate(j.preferredDate)}. You will see the full address after you accept.</p>
            {sure === j.ref ? (
              <div className="review-box">
                <p><strong>Can you be there on {formatDate(j.preferredDate)}?</strong> By accepting you confirm you are available and will do the job.</p>
                <div className="row-actions">
                  <button type="button" className="btn btn-primary" disabled={busy === j.ref} onClick={() => act(j.ref, api.jobAccept)}>Yes, I am available. Accept</button>
                  <button type="button" className="btn btn-quiet" onClick={() => setSure(null)}>Not yet</button>
                </div>
              </div>
            ) : (
              <div className="row-actions">
                <button type="button" className="btn btn-primary" disabled={busy === j.ref} onClick={() => setSure(j.ref)}>Accept job</button>
                <button type="button" className="btn btn-quiet" disabled={busy === j.ref} onClick={() => act(j.ref, api.jobDecline)}>Decline</button>
              </div>
            )}
          </li>
        ))}
      </ul>

      <h2 className="dash-h2">My jobs</h2>
      {mine?.length === 0 && <p className="muted">You have not taken a job yet.</p>}
      <ul className="request-list">
        {mine?.map((j) => (
          <li key={j.ref} className="request-card">
            <div className="deal-top"><h3>{j.ref} · {j.systemKw} kW</h3><span className={`badge badge-${j.status === 'completed' ? 'verified' : 'pending'}`}>{STATUS[j.status] ?? j.status}</span></div>
            <p>{j.description}</p>
            <p className="muted">{j.address}</p>
            <p className="muted">Customer: {j.customer.name} · <a href={`tel:${j.customer.phone}`}>{j.customer.phone}</a> · Date: {formatDate(j.preferredDate)}</p>
            <p className="muted">You earn {naira(j.pay)}{j.status === 'completed' ? ` · payout ${j.payoutStatus === 'paid' ? 'sent' : 'on its way'}` : ''}</p>
            {j.status === 'assigned' && (
              <div className="row-actions"><button type="button" className="btn btn-primary" disabled={busy === j.ref} onClick={() => act(j.ref, api.jobDone)}>Mark as done</button></div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
