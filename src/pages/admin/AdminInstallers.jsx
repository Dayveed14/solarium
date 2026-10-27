import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api.js';

const FILTERS = [['pending', 'Waiting'], ['verified', 'Approved'], ['rejected', 'Declined'], ['', 'All']];
const LABEL = { pending: 'Pending', verified: 'Approved', rejected: 'Declined' };

// Installers: the admin sees each person's quiz summary (the installer never does) and approves or declines.
export default function AdminInstallers() {
  const [filter, setFilter] = useState('pending');
  const [list, setList] = useState(null);
  const [open, setOpen] = useState(null);
  const [detail, setDetail] = useState(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api.adminInstallers(filter).then((r) => setList(r.installers)).catch((e) => setError(e.message)), [filter]);
  useEffect(() => { setList(null); load(); }, [load]);

  const toggle = async (id) => {
    if (open === id) { setOpen(null); return; }
    setOpen(id); setDetail(null); setNote('');
    try { setDetail(await api.adminInstaller(id)); } catch (e) { setError(e.message); }
  };

  const decide = async (id, status) => {
    setBusy(true); setError(null);
    try {
      await api.adminInstallerDecision(id, status, note.trim() || undefined);
      setOpen(null);
      await load();
    } catch (e) { setError(e.message); }
    setBusy(false);
  };

  return (
    <>
      <div className="section-head"><div><h2 className="dash-h2">Installers</h2><p className="muted">Read each person&apos;s answers, then approve or decline. Only approved installers receive jobs.</p></div></div>
      <div className="tabs" role="tablist" aria-label="Filter installers">
        {FILTERS.map(([v, label]) => <button key={label} type="button" role="tab" aria-selected={filter === v} className={filter === v ? 'is-active' : ''} onClick={() => setFilter(v)}>{label}</button>)}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {!list && !error && <p className="muted" role="status">Loading…</p>}
      {list?.length === 0 && <div className="empty-card"><h3>Nobody here</h3><p>No installers in this list.</p></div>}
      <ul className="request-list">
        {(list ?? []).map((i) => (
          <li key={i.userId} className="request-card">
            <div className="deal-top"><h3>{i.fullName}</h3><span className={`badge badge-${i.verification}`}>{LABEL[i.verification]}</span></div>
            <p className="muted"><a href={`mailto:${i.email}`}>{i.email}</a>{i.phone && <> · <a href={`tel:${i.phone}`}>{i.phone}</a></>}{i.state ? ` · ${i.state}` : ''}{i.yearsExperience != null ? ` · ${i.yearsExperience} yrs` : ''}</p>
            <p className="muted">{i.total ? `Quiz: ${i.score}/${i.total}` : 'Has not answered the questions yet'}</p>
            <div className="row-actions"><button type="button" className="btn btn-ghost btn-small" onClick={() => toggle(i.userId)}>{open === i.userId ? 'Close' : 'Review answers'}</button></div>
            {open === i.userId && (
              <div className="review-box">
                {!detail && <p className="muted" role="status">Loading…</p>}
                {detail && !detail.quiz && <p className="muted">No answers yet.</p>}
                {detail?.quiz && (
                  <ol className="quiz-review">
                    {detail.quiz.detail.map((d) => (
                      <li key={d.id} className={d.correct ? 'ok' : 'bad'}>
                        <small>{d.topic}</small>
                        <strong>{d.prompt}</strong>
                        <span>{d.correct ? '✓' : '✗'} {d.chosenText ?? 'No answer'}</span>
                        {!d.correct && <em>Right answer: {d.correctText}</em>}
                      </li>
                    ))}
                  </ol>
                )}
                <label className="field"><span>Note to the installer (needed to decline)</span><input type="text" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} /></label>
                <div className="row-actions">
                  {i.verification !== 'verified' && <button type="button" className="btn btn-primary" disabled={busy || !i.total} onClick={() => decide(i.userId, 'verified')}>Approve</button>}
                  {i.verification !== 'rejected' && <button type="button" className="btn btn-quiet" disabled={busy || !note.trim()} onClick={() => decide(i.userId, 'rejected')}>Decline</button>}
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
