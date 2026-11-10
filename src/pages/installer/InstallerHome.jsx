import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import { useAuth } from '../../auth/AuthContext.jsx';

// The installer's dashboard. Until the admin approves them there is one job: answer the technical questions.
// The installer is never shown a score or which answers were right.
export default function InstallerHome() {
  const { user } = useAuth();
  const [s, setS] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.installerSummary().then(setS).catch((e) => setError(e.message));
  }, []);

  return (
    <div className="wrap dash">
      <header className="dash-head">
        <div>
          <p className="eyebrow">Installer account</p>
          <h1>Hello, {user.fullName.split(' ')[0]}</h1>
        </div>
        {s && <span className={`badge badge-${s.verification}`}>{s.verification === 'verified' ? 'Approved installer' : s.verification === 'rejected' ? 'Not approved' : 'Awaiting approval'}</span>}
      </header>

      {error && <p className="form-error" role="alert">{error}</p>}
      {!s && !error && <p className="muted" role="status">Loading…</p>}

      {s && s.verification === 'verified' && (
        <>
          {s.acceptsRepairs === false && <aside className="r-banner"><div><strong>Repairs are switched off.</strong><span>You only get new installation jobs. <Link to="/app/installer-profile">Change this in your work profile.</Link></span></div></aside>}
          <p>Your offers and jobs are under <Link to="/app/installer-jobs">Installation jobs</Link> and <Link to="/app/repair-jobs">Repair jobs</Link>.</p>
        </>
      )}

      {s && s.verification === 'pending' && !s.registrationSubmitted && (
        <section className="fee-gate">
          <p className="eyebrow">First step</p>
          <h2>Finish your registration</h2>
          <p>Six short steps: your work, how much you can take, a skills check and two references. Pictures and certificates are optional. Our team reviews it and approves you before you receive jobs. Your progress is saved as you go.</p>
          <Link to="/app/register" className="btn btn-primary">Continue registration</Link>
        </section>
      )}

      {s && s.verification === 'pending' && s.registrationSubmitted && (
        <aside className="r-banner"><div><strong>Thank you. Your registration is with our team.</strong><span>We will phone your references and email you as soon as you are approved or if we need more from you.</span></div></aside>
      )}

      {s && s.verification === 'rejected' && (
        <section className="fee-gate">
          <p className="eyebrow">Not approved yet</p>
          <h2>We could not approve you this time</h2>
          {s.note && <p>{s.note}</p>}
          <Link to="/app/register" className="btn btn-primary">Update my registration</Link>
        </section>
      )}
    </div>
  );
}
