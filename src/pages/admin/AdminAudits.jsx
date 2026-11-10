import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api.js';
import { EVENT_LABEL, PHOTO_LABEL, SITE_TYPE_LABEL, SOURCE_LABEL, STAFF_STATUS } from '../../lib/audit.js';
import { formatDate, kwh } from '../../lib/format.js';
import AuditExtras from '../audit/AuditExtras.jsx';

const FILTERS = [['needs_action', 'Needs you'], ['', 'All'], ['requested', 'Waiting for an agent'], ['assigned', 'Assigned'], ['in_progress', 'In progress'], ['submitted', 'To review'], ['technical_review', 'Technical review'], ['completed', 'Completed'], ['reopened', 'Reopened']];
const BADGE = { requested: 'badge-new', assigned: 'badge-pending', in_progress: 'badge-pending', submitted: 'badge-new', technical_review: 'badge-rejected', completed: 'badge-active', reopened: 'badge-rejected' };

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
      <div className="section-head"><div><h2 className="dash-h2">Site audits</h2><p className="muted">Businesses that asked for a field assessment. Assign an agent, check what the agent submitted, send it to a technical review if flagged, and approve it. The business sees results only after you approve.</p></div></div>
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
              <span className={`badge ${BADGE[a.status]}`}>{STAFF_STATUS[a.status]}{a.needsTechnical ? ' ⚑' : ''}</span>
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

                    {detail.needsTechnical && <p className="warn-line" role="note">The agent flagged this site for technical review{detail.form?.review?.reason ? `: ${detail.form.review.reason}` : ''}.{detail.technicalNote && <> Technical note: {detail.technicalNote}</>}</p>}
                    {detail.gpsCheck && (
                      <p className={detail.gpsCheck.far ? 'warn-line' : 'muted'}>
                        GPS accuracy {detail.gpsCheck.accuracyM ?? '?'} m{detail.gpsCheck.capturedAt ? `, taken ${new Date(detail.gpsCheck.capturedAt).toLocaleString('en-NG')}` : ''}
                        {detail.gpsCheck.offKm != null && <> · {detail.gpsCheck.offKm} km from the centre of the area the business chose{detail.gpsCheck.far ? '. That is far: phone the agent or the client.' : '.'}</>}
                      </p>
                    )}

                    {detail.pending && (
                      <>
                        <h3 className="dash-h3">Waiting for approval (version {detail.pending.version})</h3>
                        <ResultStats result={detail.pending.result} />
                        <AuditExtras result={detail.pending.result} />
                      </>
                    )}
                    {detail.result && (
                      <>
                        <h3 className="dash-h3">{detail.pending ? 'Currently shown to the business' : `Approved result (version ${detail.version})`}</h3>
                        <ResultStats result={detail.result} />
                        {!detail.pending && <AuditExtras result={detail.result} />}
                      </>
                    )}

                    {detail.form && <FormSummary form={detail.form} upgraded={detail.formUpgraded} />}

                    {detail.photos && Object.keys(detail.photos).length > 0 && (
                      <div className="photo-grid">
                        {Object.entries(detail.photos).map(([slot, p]) => <figure key={slot}><a href={p.url} target="_blank" rel="noreferrer noopener"><img src={p.url} alt={PHOTO_LABEL[slot]} loading="lazy" /></a><figcaption>{PHOTO_LABEL[slot]}</figcaption></figure>)}
                      </div>
                    )}

                    {['submitted', 'technical_review'].includes(detail.status) && (
                      <div className="reopen-box">
                        <label className="field"><span>Note {detail.needsTechnical || detail.status === 'technical_review' ? '(required)' : '(optional for approval; required to send on or back)'}</span>
                          <textarea rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} /></label>
                        <div className="row-actions">
                          <button type="button" className="btn btn-primary btn-small" disabled={busy || (detail.needsTechnical && (detail.status !== 'technical_review' || note.trim().length < 5))} onClick={() => act(() => api.adminAuditApprove(detail.ref, note.trim()))}>Approve and release the result</button>
                          {detail.status === 'submitted' && <button type="button" className="btn btn-ghost btn-small" disabled={busy || note.trim().length < 5} onClick={() => act(() => api.adminAuditTechnical(detail.ref, note.trim()))}>Send to technical review</button>}
                          <button type="button" className="btn btn-quiet btn-small" disabled={busy || note.trim().length < 5} onClick={() => act(() => api.adminAuditReopen(detail.ref, note.trim()))}>Send back to the agent</button>
                        </div>
                        {detail.needsTechnical && detail.status === 'submitted' && <p className="muted small">The agent flagged this one, so it must go through technical review before it can be approved.</p>}
                      </div>
                    )}
                    {detail.status === 'completed' && (
                      <div className="reopen-box">
                        <label className="field"><span>Something wrong? Flag it and send it back to {detail.agentName ?? 'the agent'}</span>
                          <textarea rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What should they recheck?" /></label>
                        <button type="button" className="btn btn-quiet btn-small" disabled={busy || note.trim().length < 5} onClick={() => act(() => api.adminAuditReopen(detail.ref, note.trim()))}>Flag and reopen</button>
                        <p className="muted small">The business is told it is being rechecked. Their earlier result stays visible and a new version replaces it once you approve the resubmission.</p>
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

function ResultStats({ result }) {
  return (
    <dl className="r-stats">
      <div><dt>Energy a day</dt><dd>{kwh(result.usage.kwhPerDay)} kWh</dd></div>
      <div><dt>Panels</dt><dd>{result.solar.kwp} kWp</dd></div>
      <div><dt>Battery</dt><dd>{result.solar.batteryKwh} kWh</dd></div>
      <div><dt>Inverter</dt><dd>{result.solar.inverterKva} kVA</dd></div>
    </dl>
  );
}

// What the agent recorded. Older (plaza) audits are shown through the same layout; a note says so.
function FormSummary({ form, upgraded }) {
  const { site, client, power } = form;
  const who = [client.firstName, client.lastName].filter(Boolean).join(' ');
  return (
    <>
      <h3 className="dash-h3">What the agent recorded</h3>
      {upgraded && <p className="muted small">Recorded on the older plaza form and shown here in the new layout.</p>}
      <ul className="plain-list">
        <li>Site: {site.siteName || '–'} ({SITE_TYPE_LABEL[site.siteType] ?? '–'}){site.unit ? `, unit ${site.unit}` : ''}{site.occupancy ? `, ${site.occupancy}` : ''}{site.accessNotes ? `. Access: ${site.accessNotes}` : ''}</li>
        {site.legacy && <li>Old plaza answers: {site.legacy.section ?? '–'}, shop {site.legacy.shopNumber ?? '–'}</li>}
        {site.gps && <li>GPS: <a href={`https://www.google.com/maps?q=${site.gps.lat},${site.gps.lng}`} target="_blank" rel="noreferrer noopener">{site.gps.lat}, {site.gps.lng}</a></li>}
        <li>Client: {who || '–'}{client.organisation ? `, ${client.organisation}` : ''}, {client.phone || '–'}{client.role ? ` (${client.role})` : ''}; {client.businessType || '–'}, {client.yearsAtSite ?? '–'} years</li>
        <li>Grid: {power.disco || '–'}{power.supplyBand ? `, band ${power.supplyBand}` : ''}</li>
        {power.sources.length === 0 ? <li>Other power: {power.noOtherSources ? 'nothing besides the grid' : '–'}</li> : power.sources.map((x, i) => (
          <li key={i}>{SOURCE_LABEL[x.kind] ?? x.kind}: {[x.fuel, x.kva != null && `${x.kva} kVA`, x.kwp != null && `${x.kwp} kWp`, x.batteryKwh != null && `${x.batteryKwh} kWh battery`, x.fuelSpendPerWeek != null && `₦${x.fuelSpendPerWeek}/week fuel`, x.note].filter(Boolean).join(', ') || '–'}</li>
        ))}
        <li>Landlord {power.landlordContact || '–'}; manager {power.managerContact || '–'}</li>
        <li>Roof: {form.roof.areaM2 != null ? `${form.roof.areaM2} m²` : '–'}{form.roof.type ? `, ${form.roof.type}` : ''}</li>
        <li>{form.appliances.length} appliance type(s) listed</li>
        {form.comments && <li>Comments: {form.comments}</li>}
      </ul>
    </>
  );
}
