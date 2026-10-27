import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import InstallerJobs from './InstallerJobs.jsx';

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

      {s && s.verification === 'verified' && <InstallerJobs />}

      {s && s.verification === 'pending' && !s.quizSubmitted && (
        <section className="fee-gate">
          <p className="eyebrow">First step</p>
          <h2>Answer a few technical questions</h2>
          <p>It takes about ten minutes. Our team reads your answers and approves you before you receive jobs. Answer on your own, the way you would on a real job.</p>
          <Link to="/app/quiz" className="btn btn-primary">Start the questions</Link>
        </section>
      )}

      {s && s.verification === 'pending' && s.quizSubmitted && (
        <aside className="r-banner"><div><strong>Thank you. Your answers are with our team.</strong><span>We will email you as soon as you are approved or if we need more from you.</span></div></aside>
      )}

      {s && s.verification === 'rejected' && (
        <section className="fee-gate">
          <p className="eyebrow">Not approved yet</p>
          <h2>We could not approve you this time</h2>
          {s.note && <p>{s.note}</p>}
          <Link to="/app/quiz" className="btn btn-primary">Answer the questions again</Link>
        </section>
      )}
    </div>
  );
}
