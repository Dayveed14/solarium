import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { FilesBox, MultiRow, OptionRow } from './RegistrationParts.jsx';

const STEPS = ['About you', 'Experience', 'Capacity', 'Skills check', 'References', 'Finish'];
const STEP_OF = { about: 0, experience: 1, capacity: 2, skills: 3, references: 4 };
const blankRef = () => ({ name: '', phone: '', relationship: '' });

// Installer registration: six short steps. Each step is saved as you go, so you can leave and come back.
export default function InstallerRegister() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [st, setSt] = useState(null);
  const [form, setForm] = useState({});
  const [refs, setRefs] = useState([blankRef(), blankRef()]);
  const [agreed, setAgreed] = useState(false);
  const [declared, setDeclared] = useState(false);
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [step, setStep] = useState(0);
  const [error, setError] = useState(null);
  const [fields, setFields] = useState({});
  const [busy, setBusy] = useState(false);

  const apply = useCallback((r, first = false) => {
    setSt(r);
    if (first) {
      setForm({ ...r.registration, acceptsRepairs: r.registration.acceptsRepairs ?? true });
      if (r.references.length) setRefs(r.references.map(({ name, phone, relationship }) => ({ name, phone, relationship })));
      if (r.references.length >= r.options.minReferences) setAgreed(true);
      const first = Object.entries(STEP_OF).sort((a, b) => a[1] - b[1]).find(([k]) => r.missing.includes(k));
      setStep(first ? first[1] : 5);
    }
  }, []);

  useEffect(() => {
    api.installerRegistration().then((r) => {
      if (r.verification === 'verified' || (r.verification === 'pending' && r.submitted)) { navigate('/app', { replace: true }); return; }
      apply(r, true);
    }).catch((e) => setError(e.message));
  }, [apply, navigate]);

  useEffect(() => {
    if (step !== 3 || quiz || !st || st.quizSubmitted) return;
    api.installerQuiz().then(setQuiz).catch((e) => setError(e.message));
  }, [step, quiz, st]);

  const set = (patch) => { setForm((f) => ({ ...f, ...patch })); setFields({}); };
  const options = st?.options;
  const asOptions = useMemo(() => ({
    capacity: (options?.capacity ?? []).map((n) => ({ id: n, label: n === 1 ? '1 job' : n === 10 ? 'Up to 10 jobs' : `${n} jobs` })),
  }), [options]);

  if (error && !st) return <div className="wrap dash"><p className="form-error" role="alert">{error}</p></div>;
  if (!st) return <div className="wrap dash"><p className="muted" role="status">Loading…</p></div>;

  const need = (keys) => {
    const e = {};
    for (const k of keys) {
      const v = form[k];
      if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) e[k] = 'Please choose one';
    }
    setFields(e);
    return Object.keys(e).length === 0;
  };

  const run = async (fn) => {
    setBusy(true); setError(null);
    try { await fn(); return true; } catch (e) {
      setError(e.message);
      if (e.details?.fields) setFields(e.details.fields);
      return false;
    } finally { setBusy(false); }
  };
  const go = (n) => { setError(null); setFields({}); setStep(n); window.scrollTo?.({ top: 0 }); };
  const saveAnd = (required, optional, next) => async () => {
    if (!need(required)) return;
    const patch = {};
    for (const k of [...required, ...optional]) if (form[k] !== undefined && form[k] !== null) patch[k] = form[k];
    if (await run(async () => apply(await api.installerSaveRegistration(patch)))) go(next);
  };

  const sendQuiz = async () => {
    if (quiz.questions.some((q) => !answers[q.id])) { setError(`Please answer every question (${quiz.questions.filter((q) => !answers[q.id]).length} left).`); return; }
    if (await run(async () => { await api.installerSubmitQuiz(answers); apply(await api.installerRegistration()); })) go(4);
  };

  const sendRefs = async () => {
    if (!agreed) { setError('Please confirm these people agreed to be called.'); return; }
    const filled = refs.filter((r) => r.name.trim() || r.phone.trim() || r.relationship.trim());
    if (filled.length < st.options.minReferences) { setError(`Add at least ${st.options.minReferences} references.`); return; }
    if (await run(async () => apply(await api.installerSaveReferences(filled)))) go(5);
  };

  const submit = async () => {
    if (!declared) { setError('Please tick the box to confirm.'); return; }
    if (await run(async () => { await api.installerSubmitRegistration(); })) navigate('/app', { replace: true });
  };

  const refreshFiles = async () => apply(await api.installerRegistration());
  const left = quiz ? quiz.questions.filter((q) => !answers[q.id]).length : 0;

  return (
    <div className="wrap dash">
      <header className="dash-head">
        <div>
          <p className="eyebrow">Installer registration</p>
          <h1>Grow your energy business with TerraVoltix</h1>
          <p className="muted">Join a network of energy professionals and connect with customers looking for installation, maintenance, repairs and technical support.</p>
        </div>
      </header>

      {st.verification === 'rejected' && st.note && <p className="r-notice" role="note"><strong>Our team asked for changes:</strong> {st.note}</p>}

      <ol className="wiz-steps" aria-label="Steps">
        {STEPS.map((t, i) => (
          <li key={t}><button type="button" className={i === step ? 'on' : ''} aria-current={i === step ? 'step' : undefined} onClick={() => go(i)}>{i + 1}. {t}</button></li>
        ))}
      </ol>
      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="profile-form reg-step">
        {step === 0 && (
          <>
            <h2 className="dash-h3">About you</h2>
            <dl className="reg-facts">
              <div><dt>Name</dt><dd>{user.fullName}</dd></div>
              <div><dt>Email</dt><dd>{user.email}</dd></div>
              {user.phone && <div><dt>Phone</dt><dd>{user.phone}</dd></div>}
              {user.address && <div><dt>Based in</dt><dd>{user.address.areaName}, {user.address.stateName}</dd></div>}
            </dl>
            <p className="muted"><Link to="/app/profile">Change your phone or address</Link> if something is wrong.</p>
            <OptionRow label="Is your work registered as a business?" value={form.businessStatus} options={options.businessStatus} onChange={(v) => set({ businessStatus: v })} error={fields.businessStatus} hint="Being registered is not required. It only helps customers trust you." />
            <OptionRow label="How far will you travel for a job?" value={form.travelKm} options={options.travelKm} onChange={(v) => set({ travelKm: v })} error={fields.travelKm} />
            <div className="wiz-nav-plain"><button type="button" className="btn btn-primary" disabled={busy} onClick={saveAnd(['businessStatus', 'travelKm'], [], 1)}>Next</button></div>
          </>
        )}

        {step === 1 && (
          <>
            <h2 className="dash-h3">Your experience</h2>
            <OptionRow label="How many years have you worked on solar, inverters or batteries?" value={form.experienceBand} options={options.experience} onChange={(v) => set({ experienceBand: v })} error={fields.experienceBand} />
            <OptionRow label="Do you have a technical qualification?" value={form.qualification} options={options.qualification} onChange={(v) => set({ qualification: v })} error={fields.qualification} hint="A certificate is not required. Your skills and references matter most." />
            <MultiRow label="What kind of jobs do you take?" value={form.projectTypes} options={options.projectTypes} onChange={(v) => set({ projectTypes: v })} error={fields.projectTypes} />
            <label className="field">
              <span>Tell us about your work <em>(optional)</em></span>
              <textarea rows={4} maxLength={1000} value={form.about ?? ''} onChange={(e) => set({ about: e.target.value })} placeholder="What you have installed or repaired, and for whom." />
            </label>
            <div className="wiz-nav-plain">
              <button type="button" className="btn btn-quiet" onClick={() => go(0)}>Back</button>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={saveAnd(['experienceBand', 'qualification', 'projectTypes'], ['about'], 2)}>Next</button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="dash-h3">How much work can you take?</h2>
            <OptionRow label="How many jobs can you handle at the same time?" value={form.capacity} options={asOptions.capacity} onChange={(v) => set({ capacity: v })} error={fields.capacity} />
            <OptionRow label="How quickly do you usually answer a new enquiry?" value={form.responseTime} options={options.responseTime} onChange={(v) => set({ responseTime: v })} error={fields.responseTime} />
            <label className="check">
              <input type="checkbox" checked={form.acceptsRepairs !== false} onChange={(e) => set({ acceptsRepairs: e.target.checked })} />
              <span>I also take repair jobs, not only new installations.</span>
            </label>
            <div className="wiz-nav-plain">
              <button type="button" className="btn btn-quiet" onClick={() => go(1)}>Back</button>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={saveAnd(['capacity', 'responseTime'], ['acceptsRepairs'], 3)}>Next</button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="dash-h3">Skills check</h2>
            {st.quizSubmitted && st.verification !== 'rejected' ? (
              <>
                <p className="r-banner"><span><strong>Your answers are saved.</strong> Our team reads them. You do not see a score.</span></p>
                <div className="wiz-nav-plain"><button type="button" className="btn btn-quiet" onClick={() => go(2)}>Back</button><button type="button" className="btn btn-primary" onClick={() => go(4)}>Next</button></div>
              </>
            ) : !quiz ? <p className="muted" role="status">Loading the questions…</p> : (
              <>
                <p className="muted">About ten minutes. Answer on your own, the way you would on a real job. There is no pass mark you can see, and our team reads every answer.</p>
                {quiz.questions.map((q, i) => (
                  <fieldset key={q.id} className="quiz-q">
                    <legend><small>{q.topic}</small> {i + 1}. {q.prompt}</legend>
                    {q.options.map((o) => (
                      <label key={o.id} className={`choice choice-small${answers[q.id] === o.id ? ' on' : ''}`}>
                        <input type="radio" name={q.id} checked={answers[q.id] === o.id} onChange={() => setAnswers((a) => ({ ...a, [q.id]: o.id }))} />
                        <span>{o.text}</span>
                      </label>
                    ))}
                  </fieldset>
                ))}
                <div className="wiz-nav-plain">
                  <button type="button" className="btn btn-quiet" onClick={() => go(2)}>Back</button>
                  <button type="button" className="btn btn-primary" disabled={busy} onClick={sendQuiz}>{left ? `Save my answers (${left} left)` : 'Save my answers'}</button>
                </div>
              </>
            )}
          </>
        )}

        {step === 4 && (
          <>
            <h2 className="dash-h3">References</h2>
            <p className="muted">Give {st.options.minReferences} people who know your work: a past customer, an employer or a colleague. Our team phones them before approving you.</p>
            {refs.map((r, i) => (
              <fieldset key={i} className="ref-card">
                <legend>Reference {i + 1}</legend>
                <label className="field"><span>Name</span><input type="text" maxLength={120} value={r.name} onChange={(e) => setRefs((a) => a.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} /></label>
                <label className="field"><span>Phone number</span><input type="tel" inputMode="tel" maxLength={30} value={r.phone} onChange={(e) => setRefs((a) => a.map((x, j) => (j === i ? { ...x, phone: e.target.value } : x)))} placeholder="0803 123 4567" /></label>
                <label className="field"><span>How do they know you?</span><input type="text" maxLength={80} value={r.relationship} onChange={(e) => setRefs((a) => a.map((x, j) => (j === i ? { ...x, relationship: e.target.value } : x)))} placeholder="Past customer, employer, colleague…" /></label>
                {i >= st.options.minReferences && <button type="button" className="btn btn-quiet btn-small" onClick={() => setRefs((a) => a.filter((_, j) => j !== i))}>Remove</button>}
              </fieldset>
            ))}
            {fields.references && <small className="err">{fields.references}</small>}
            {refs.length < st.options.maxReferences && <button type="button" className="btn btn-ghost btn-small" onClick={() => setRefs((a) => [...a, blankRef()])}>Add another reference</button>}
            <label className="check">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
              <span>I have asked these people and they agree to be called.</span>
            </label>
            <div className="wiz-nav-plain">
              <button type="button" className="btn btn-quiet" onClick={() => go(3)}>Back</button>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={sendRefs}>Next</button>
            </div>
          </>
        )}

        {step === 5 && (
          <>
            <h2 className="dash-h3">Finish</h2>
            <p className="muted">These are optional. Skills and references matter more than papers. Only you and the TerraVoltix team can see these files.</p>
            <FilesBox kind="photo" title="Profile photo or logo" hint="A clear picture of you or your company logo." docs={st.documents} limit={st.options.docLimits.photo} onChange={refreshFiles} onError={setError} />
            <FilesBox kind="work" title="Pictures of past work" hint={`Up to ${st.options.docLimits.work} pictures.`} docs={st.documents} limit={st.options.docLimits.work} onChange={refreshFiles} onError={setError} />
            <FilesBox kind="certificate" title="Certificates or training records" hint="PDF or picture, up to 4 MB each." docs={st.documents} limit={st.options.docLimits.certificate} onChange={refreshFiles} onError={setError} />

            {st.missing.length > 0 && (
              <p className="r-notice" role="note">
                Still to do: {st.missing.map((k, n) => (
                  <span key={k}>{n > 0 && ', '}<button type="button" className="link-btn" onClick={() => go(STEP_OF[k])}>{STEPS[STEP_OF[k]]}</button></span>
                ))}.
              </p>
            )}
            <label className="check">
              <input type="checkbox" checked={declared} onChange={(e) => setDeclared(e.target.checked)} />
              <span>I confirm that the information I have given is accurate and that I am authorised to provide these services. I agree to the TerraVoltix Provider Terms and Verification Policy.</span>
            </label>
            <div className="wiz-nav-plain">
              <button type="button" className="btn btn-quiet" onClick={() => go(4)}>Back</button>
              <button type="button" className="btn btn-primary" disabled={busy || st.missing.length > 0} onClick={submit}>{busy ? 'Sending…' : 'Submit for review'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
