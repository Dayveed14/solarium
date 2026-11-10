import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { formatDate } from '../../lib/format.js';

const LABEL = { assigned: 'New job', in_progress: 'In progress', reopened: 'Sent back to you', submitted: 'With the admin', technical_review: 'With the admin', completed: 'Approved' };
const BADGE = { assigned: 'badge-new', in_progress: 'badge-pending', reopened: 'badge-rejected', submitted: 'badge-pending', technical_review: 'badge-pending', completed: 'badge-active' };
const FINISHED = ['submitted', 'technical_review', 'completed'];

// A field agent's home: the jobs the admin has given them. Today there is one kind of task, the energy audit.
export default function AgentHome() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { api.agentJobs().then((r) => setJobs(r.jobs)).catch((e) => setError(e.message)); }, []);

  const todo = jobs?.filter((j) => !FINISHED.includes(j.status)) ?? [];
  const done = jobs?.filter((j) => FINISHED.includes(j.status)) ?? [];
  const row = (j) => (
    <li key={j.ref}>
      <Link to={`/app/jobs/${j.ref}`} className="order-row">
        <span><strong>{j.businessName}</strong><small>{j.ref}{j.preferredDate ? ` · wanted ${formatDate(j.preferredDate)}` : ''}</small></span>
        <span>{j.address.place}{j.reviewNote && <small className="warn-line">Recheck: {j.reviewNote}</small>}</span>
        <span className={`badge ${BADGE[j.status]}`}>{LABEL[j.status]}</span>
      </Link>
    </li>
  );

  return (
    <div className="wrap dash">
      <header className="dash-head">
        <div><p className="eyebrow">Field agent</p><h1>Hello, {user.fullName.split(' ')[0]}</h1></div>
      </header>
      {error && <p className="form-error" role="alert">{error}</p>}
      {!jobs && !error && <p className="muted" role="status">Loading your jobs…</p>}

      {jobs && (
        <>
          <h2 className="dash-h3">Your jobs</h2>
          {todo.length === 0 ? <p className="muted">Nothing waiting. You will get an email when the admin assigns you a site.</p> : <ul className="order-list">{todo.map(row)}</ul>}
          {done.length > 0 && (<><h2 className="dash-h3">Submitted</h2><ul className="order-list">{done.map(row)}</ul></>)}
        </>
      )}

      <h2 className="dash-h3">Coming later</h2>
      <ul className="plain-list muted">
        <li>PPA signing visits</li>
        <li>Installation and monitoring checks</li>
      </ul>
    </div>
  );
}
