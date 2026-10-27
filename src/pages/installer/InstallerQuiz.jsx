import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api.js';

export default function InstallerQuiz() {
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [years, setYears] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.installerQuiz().then((q) => {
      if (q.verification === 'verified' || (q.submitted && q.verification === 'pending')) navigate('/app', { replace: true });
      else setQuiz(q);
    }).catch((e) => setError(e.message));
  }, [navigate]);

  if (error && !quiz) return <div className="wrap dash"><p className="form-error" role="alert">{error}</p></div>;
  if (!quiz) return <div className="wrap dash"><p className="muted" role="status">Loading…</p></div>;

  const left = quiz.questions.filter((q) => !answers[q.id]).length;

  const submit = async (e) => {
    e.preventDefault();
    if (left) { setError(`Please answer every question (${left} left).`); return; }
    setSaving(true);
    setError(null);
    try {
      await api.installerSubmitQuiz(answers, years === '' ? undefined : Number.parseInt(years, 10));
      navigate('/app', { replace: true });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <div className="wrap dash">
      <header className="dash-head"><div><p className="eyebrow">Installer</p><h1>Technical questions</h1></div></header>
      <form onSubmit={submit} className="quiz-form" noValidate>
        <label className="field">
          <span>Years of installation experience</span>
          <input type="number" min="0" max="60" inputMode="numeric" value={years} onChange={(e) => setYears(e.target.value)} />
        </label>
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
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Sending…' : 'Send my answers'}</button>
      </form>
    </div>
  );
}
