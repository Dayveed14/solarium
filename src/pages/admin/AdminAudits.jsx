import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api.js';
import { AUDIT_STATUS, EVENT_LABEL, PHOTO_LABEL } from '../../lib/audit.js';
import { formatDate, kwh } from '../../lib/format.js';
import AuditExtras from '../audit/AuditExtras.jsx';

const FILTERS = [['', 'All'], ['requested', 'Waiting for an agent'], ['assigned', 'Assigned'], ['in_progress', 'In progress'], ['completed', 'Completed'], ['reopened', 'Reopened']];
const BADGE = { requested: 'badge-new', assigned: 'badge-pending', in_progress: 'badge-pending', completed: 'badge-active', reopened: 'badge-rejected' };

// Every business site assessment: who asked, which agent has it, what the result is, and the button to send one back.
export default function AdminAudits() {
  const [filter, setFilter] = useState('');
  const [data, setData] = useState(null);
  const [agents, setAgents] = useState([]);
  const [open, setOpen] = useState(null);
  const [detail, setDetail] = useState(null);
  const [pick, setPick] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(() => api.adminAudits(filter).then(setData).catch((e) => setError(e.message)), [filter]);
  useEffect(() => { setData(null); load(); }, [load]);
  useEffect(() => { api.adminAgents().then((r) => setAgents(r.agents.filter((a) => a.active))).catch(() => {}); }, []);

  const show = async (ref) => {
    if (open === ref) { setOpen(null); return; }
    setOpen(ref); setDetail(null); setNote(''); setPick('');
    try { setDetail((await api.adminAudit(ref)).audit); } catch (e) { setError(e.message); }
  };
  const act = async (fn) => {
    setBusy(true); setError(null);
    try { await fn(); setDetail((await api.adminAudit(open)).audit); await load(); setNote(''); setPick(''); } catch (e) { setError(e.message); }
    setBusy(false);
  };

  return (
    <>
      <div className="section-head"><div><h2 className="dash-h2">Site audits</h2><p className="muted">Businesses that asked for a field assessment. Assign an agent; send a finished result back if something looks wrong.</p></div></div>
      <div className="choice-row" role="group" aria-label="Filter">
        {FILTERS.map(([k, l]) => <button key={k} type="button" className={filter === k ? 'chip on' : 'chip'} onClick={() => setFilter(k)}>{l}</button>)}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {!data && !error && <p className="muted" role="status">Loading…</p>}
      {data && data.audits.length === 0 && <p className="muted">Nothing here.</p>}

      <ul className="order-list">
        {data?.audits.map((a) => (
          <li key={a.ref}>
            <button type="button" className="order-row" onClick={() => show(a.ref)} aria-expanded={open === a.ref}>
              <span><strong>{a.companyName}</strong><small>{a.ref} · {formatDate(a.createdAt)}</small></span>
              <span>{a.address.place}<small>{a.agentName ? `Agent: ${a.agentName}` : 'No agent yet'}{a.kwhPerDay ? ` · ${kwh(a.kwhPerDay)} kWh/day` : ''}</small></span>
              <span className={`badge ${BADGE[a.status]}`}>{AUDIT_STATUS[a.status]}</span>
            </button>
            {open === a.ref && (
              <div className="order-part">
                {!detail ? <p className="muted" role="status">Loading…</p> : (
                  <>
                    <p><strong>{detail.companyName}</strong> · {detail.businessEmail}</p>
                    <p>{detail.address.place}</p>
                    <p>Contact: {detail.contact.name}, <a href={`tel:${detail.contact.phone}`}>{detail.contact.phone}</a>{detail.preferredDate && <> · wants {formatDate(detail.preferredDate)}</>}</p>
                    {detail.notes && <p className="muted">Note: {detail.notes}</p>}

                    {['requested', 'assigned', 'reopened'].includes(detail.status) && (
                      <div className="row-actions">
                        <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Field agent">
                          <option value="">{detail.status === 'requested' ? 'Choose an agent…' : 'Change agent…'}</option>
                          {agents.map((g) => <option key={g.id} value={g.id}>{g.fullName} ({g.openJobs} open)</option>)}
                        </select>
                        <button type="button" className="btn btn-primary btn-small" disabled={busy || !pick} onClick={() => act(() => api.adminAuditAssign(detail.ref, Number(pick)))}>{detail.status === 'requested' ? 'Assign' : 'Hand over'}</button>
                      </div>
                    )}
                    {agents.length === 0 && detail.status === 'requested' && <p className="muted">No field agents yet. Add one under Field agents.</p>}

                    <h3 className="dash-h3">Timeline</h3>
                    <ul className="plain-list">{detail.timeline.map((e, i) => <li key={i}>{EVENT_LABEL[e.type] ?? e.type} · {new Date(e.at).toLocaleString('en-NG')}{e.note && <> · <em>{e.note}</em></>}</li>)}</ul>

                    {detail.result && (
                      <>
                        <h3 className="dash-h3">Result (version {detail.version})</h3>
                        <dl className="r-stats">
                          <div><dt>Energy a day</dt><dd>{kwh(detail.result.usage.kwhPerDay)} kWh</dd></div>
                          <div><dt>Panels</dt><dd>{detail.result.solar.kwp} kWp</dd></div>
                          <div><dt>Battery</dt><dd>{detail.result.solar.batteryKwh} kWh</dd></div>
                          <div><dt>Inverter</dt><dd>{detail.result.solar.inverterKva} kVA</dd></div>
                        </dl>
                        <AuditExtras result={detail.result} />
                      </>
                    )}

                    {detail.form && (detail.form.business?.shopName || detail.form.site?.plazaName) && (
                      <>
                        <h3 className="dash-h3">What the agent recorded</h3>
                        <ul className="plain-list">
                          <li>Plaza: {detail.form.site.plazaName} ({detail.form.site.section}), shop {detail.form.site.shopNumber || '–'}, {detail.form.site.shopStatus}</li>
                          {detail.form.site.gps && <li>GPS: <a href={`https://www.google.com/maps?q=${detail.form.site.gps.lat},${detail.form.site.gps.lng}`} target="_blank" rel="noreferrer noopener">{detail.form.site.gps.lat}, {detail.form.site.gps.lng}</a></li>}
                          <li>Owner: {detail.form.business.ownerFirstName} {detail.form.business.ownerLastName}, {detail.form.business.ownerPhone}; {detail.form.business.businessType}, {detail.form.business.yearsInPlaza ?? '–'} years</li>
                          <li>Generator: {detail.form.power.usesGenerator ? `${detail.form.power.generatorType ?? ''} ${detail.form.power.generatorKva ?? ''} kVA` : 'none'}; landlord {detail.form.power.landlordContact || '–'}; manager {detail.form.power.managerContact || '–'}</li>
                          {detail.form.comments && <li>Comments: {detail.form.comments}</li>}
                        </ul>
                      </>
                    )}

                    {detail.photos && Object.keys(detail.photos).length > 0 && (
                      <div className="photo-grid">
                        {Object.entries(detail.photos).map(([slot, p]) => <figure key={slot}><a href={p.url} target="_blank" rel="noreferrer noopener"><img src={p.url} alt={PHOTO_LABEL[slot]} loading="lazy" /></a><figcaption>{PHOTO_LABEL[slot]}</figcaption></figure>)}
                      </div>
                    )}

                    {detail.status === 'completed' && (
                      <div className="reopen-box">
                        <label className="field"><span>Something wrong? Flag it and send it back to {detail.agentName ?? 'the agent'}</span>
                          <textarea rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What should they recheck?" /></label>
                        <button type="button" className="btn btn-quiet btn-small" disabled={busy || note.trim().length < 5} onClick={() => act(() => api.adminAuditReopen(detail.ref, note.trim()))}>Flag and reopen</button>
                        <p className="muted small">The business is told it is being rechecked. Their earlier result stays visible and a new version replaces it when the agent resubmits.</p>
                      </div>
                    )}
                    {detail.status === 'reopened' && detail.reviewNote && <p className="warn-line">Waiting for the agent. Your note: {detail.reviewNote}</p>}
                  </>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
