import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api.js';
import ResultsView from '../../components/ResultsView.jsx';
import { formatDate } from '../../lib/format.js';
import { AUDIT_STEPS, EVENT_LABEL, PHOTO_LABEL, stepIndex } from '../../lib/audit.js';
import AuditExtras from './AuditExtras.jsx';

// A business follows one site assessment: where it is, who is coming, the results, and the next step.
export default function SiteAssessmentDetail() {
  const { ref } = useParams();
  const navigate = useNavigate();
  const [a, setA] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let live = true;
    const load = () => api.auditGet(ref).then((r) => live && setA(r.audit)).catch((e) => live && setError(e.message));
    load();
    // Pages left open while the agent works pick up each step on their own.
    const t = setInterval(load, 30000);
    return () => { live = false; clearInterval(t); };
  }, [ref]);

  if (error) return <section className="wrap page-narrow empty-state"><h1>We couldn&apos;t open that</h1><p className="lede">{error}</p><Link to="/app/site-assessment" className="btn btn-primary">Back</Link></section>;
  if (!a) return <div className="page-loading" role="status">Loading…</div>;

  const step = stepIndex(a.status);
  const when = Object.fromEntries((a.timeline ?? []).map((e) => [e.type, e.at]));
  const photos = Object.entries(a.photos ?? {});

  return (
    <div className="app-page">
      <p className="muted"><Link to="/app/site-assessment">← Site assessments</Link></p>
      <header className="page-head">
        <p className="eyebrow">{a.ref}</p>
        <h1>Site assessment</h1>
        <p className="muted">{a.address.place}</p>
      </header>

      {a.underReview && <p className="r-notice" role="status"><strong>We are rechecking some details.</strong> Your earlier numbers are shown below, marked as under review. You will get an email when the updated result is ready.</p>}

      <ol className="steps-list">
        {AUDIT_STEPS.map(([key, title, text], i) => (
          <li key={key} className={i < step || (i === step && a.status === 'completed') ? 'done' : ''}>
            <span className="step-badge" aria-hidden="true">{i < step || a.status === 'completed' ? '✓' : i + 1}</span>
            <div>
              <strong>{title}</strong>{when[key === 'in_progress' ? 'started' : key] && <small> · {formatDate(when[key === 'in_progress' ? 'started' : key])}</small>}
              {i === step && <p>{a.status === 'assigned' && a.agent ? `${a.agent.name} will visit you.` : text}</p>}
            </div>
          </li>
        ))}
      </ol>

      {a.agent && (
        <p><strong>Your field agent:</strong> {a.agent.name}{a.agent.phone && <> · <a href={`tel:${a.agent.phone}`}>{a.agent.phone}</a></>}</p>
      )}

      {a.result ? (
        <div className="results-page">
          <ResultsView result={a.result} mode="saved" onChoose={(plan) => navigate(`/app/assessments/${a.assessmentId}/offers?plan=${plan}`)} />
          <AuditExtras result={a.result} />
        </div>
      ) : (
        <p className="muted">Your results appear here, and by email, the moment the agent submits the visit.</p>
      )}

      {photos.length > 0 && (
        <section>
          <h2 className="dash-h3">Photos from the visit</h2>
          <div className="photo-grid">
            {photos.map(([slot, p]) => <figure key={slot}><img src={p.url} alt={PHOTO_LABEL[slot]} loading="lazy" /><figcaption>{PHOTO_LABEL[slot]}</figcaption></figure>)}
          </div>
        </section>
      )}
    </div>
  );
}
