import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api.js';

const FILTERS = [['pending', 'Waiting'], ['draft', 'Not finished'], ['verified', 'Approved'], ['rejected', 'Declined'], ['', 'All']];
const LABEL = { pending: 'Pending', verified: 'Approved', rejected: 'Declined' };

// Installers: the admin reads each registration, phones the references, and approves or declines. The installer never sees their quiz score.
export default function AdminInstallers() {
  const [filter, setFilter] = useState('pending');
  const [list, setList] = useState(null);
  const [open, setOpen] = useState(null);
  const [detail, setDetail] = useState(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [callNote, setCallNote] = useState('');

  const load = useCallback(() => api.adminInstallers(filter).then((r) => setList(r.installers)).catch((e) => setError(e.message)), [filter]);
  useEffect(() => { setList(null); load(); }, [load]);

  const toggle = async (id) => {
    if (open === id) { setOpen(null); return; }
    setOpen(id); setDetail(null); setNote(''); setCallNote('');
    try { setDetail(await api.adminInstaller(id)); } catch (e) { setError(e.message); }
  };

  const tick = async (id, refId, called) => {
    setBusy(true); setError(null);
    try {
      await api.adminInstallerReference(id, refId, called, callNote.trim() || undefined);
      setCallNote('');
      setDetail(await api.adminInstaller(id));
      await load();
    } catch (e) { setError(e.message); }
    setBusy(false);
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
      <div className="section-head"><div><h2 className="dash-h2">Installers</h2><p className="muted">Read each registration, phone both references and tick them off, then approve or decline. Only approved installers receive jobs.</p></div></div>
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
            <p className="muted">{i.total ? `Skills check: ${i.score}/${i.total}` : 'Has not answered the questions yet'}{i.flowVersion >= 2 && ` · References phoned: ${i.referencesCalled}/${i.references}`}{!i.registrationSubmittedAt && i.verification === 'pending' && ' · Registration not sent yet'}</p>
            <div className="row-actions"><button type="button" className="btn btn-ghost btn-small" onClick={() => toggle(i.userId)}>{open === i.userId ? 'Close' : 'Review registration'}</button></div>
            {open === i.userId && (
              <div className="review-box">
                {!detail && <p className="muted" role="status">Loading…</p>}
                {detail?.registration && detail.registration.flowVersion >= 2 && (
                  <>
                    <h4 className="dash-h3">Registration</h4>
                    <dl className="reg-facts">
                      <div><dt>Business</dt><dd>{detail.registration.business ?? '—'}</dd></div>
                      <div><dt>Experience</dt><dd>{detail.registration.experience ?? '—'}</dd></div>
                      <div><dt>Qualification</dt><dd>{detail.registration.qualification ?? '—'}</dd></div>
                      <div><dt>Travels</dt><dd>{detail.registration.travelKm ? `up to ${detail.registration.travelKm} km` : '—'}</dd></div>
                      <div><dt>Jobs taken</dt><dd>{detail.registration.projectTypes.join(', ') || '—'}</dd></div>
                      <div><dt>At once</dt><dd>{detail.registration.capacity ?? '—'}</dd></div>
                      <div><dt>Answers within</dt><dd>{detail.registration.responseTime ?? '—'}</dd></div>
                      <div><dt>Repairs</dt><dd>{detail.registration.acceptsRepairs ? 'Yes' : 'No'}</dd></div>
                    </dl>
                    {detail.registration.about && <p className="request-message">{detail.registration.about}</p>}
                    <h4 className="dash-h3">References</h4>
                    {detail.references.length === 0 && <p className="muted">No references yet.</p>}
                    <ul className="doc-list">
                      {detail.references.map((r) => (
                        <li key={r.id}>
                          <div><strong>{r.name}</strong><small>{r.relationship} · <a href={`tel:${r.phone}`}>{r.phone}</a>{r.calledAt ? ` · phoned ${new Date(r.calledAt).toLocaleDateString('en-NG')}` : ''}{r.callNote ? ` · ${r.callNote}` : ''}</small></div>
                          <label className="check ref-tick"><input type="checkbox" checked={Boolean(r.calledAt)} disabled={busy} onChange={(e) => tick(i.userId, r.id, e.target.checked)} /> <span>Phoned</span></label>
                        </li>
                      ))}
                    </ul>
                    <label className="field"><span>Note about the call (saved with the next tick)</span><input type="text" value={callNote} maxLength={300} onChange={(e) => setCallNote(e.target.value)} placeholder="e.g. Confirmed he did the job in 2024" /></label>
                    {detail.documents.length > 0 && (
                      <>
                        <h4 className="dash-h3">Files</h4>
                        <ul className="doc-list">
                          {detail.documents.map((d) => (
                            <li key={d.id}><span>{{ photo: 'Profile photo', work: 'Work picture', certificate: 'Certificate' }[d.kind] ?? d.kind}{d.label ? ` · ${d.label}` : ''}</span><a className="btn btn-ghost btn-small" href={`/api/admin/documents/${d.id}/file`} target="_blank" rel="noopener noreferrer">Open</a></li>
                          ))}
                        </ul>
                      </>
                    )}
                  </>
                )}
                <h4 className="dash-h3">Skills check</h4>
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
                  {i.verification !== 'verified' && <button type="button" className="btn btn-primary" disabled={busy || !i.total || (i.flowVersion >= 2 && (!i.registrationSubmittedAt || i.references < 2 || i.referencesCalled < i.references))} onClick={() => decide(i.userId, 'verified')}>Approve</button>}
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
