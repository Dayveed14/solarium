import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError, api } from '../../api.js';
import { PHOTO_LABEL, EVENT_LABEL } from '../../lib/audit.js';
import { kwh, naira } from '../../lib/format.js';
import { shrink } from '../../lib/shrink.js';
import AuditExtras from '../audit/AuditExtras.jsx';
import SignaturePad from './SignaturePad.jsx';

const STEPS = ['Site', 'Client', 'Power', 'Appliances', 'Photos', 'Review'];
const BUSINESS_TYPES = ['Provision store', 'Supermarket', 'Salon / barber', 'Restaurant / bar', 'Phone & gadgets', 'Pharmacy', 'Tailor / fashion', 'Printing / cyber café', 'Electronics', 'Office', 'Other'];
const stepOfMissing = (key) => (key.startsWith('site.') ? 0 : key.startsWith('client.') ? 1 : key.startsWith('power.') ? 2 : key === 'appliances' ? 3 : key.startsWith('review.') || key === 'photo.signature' || key === 'photo.agent_signature' ? 5 : 4);

const blank = () => ({
  site: { siteName: '', siteType: '', unit: '', occupancy: '', accessNotes: '', gps: null, legacy: null },
  client: { organisation: '', firstName: '', lastName: '', phone: '', role: '', businessType: '', yearsAtSite: '' },
  power: { disco: '', supplyBand: '', sources: [], noOtherSources: false, landlordContact: '', managerContact: '' },
  roof: { areaM2: '', type: '' },
  appliances: [],
  review: { needsTechnical: false, reason: '' },
  comments: '',
});
// The server stores numbers and nulls; the inputs want strings.
const s = (v) => (v == null ? '' : String(v));
const fromServer = (f) => {
  const b = blank();
  for (const k of ['siteName', 'siteType', 'unit', 'occupancy', 'accessNotes']) b.site[k] = s(f.site?.[k]);
  b.site.gps = f.site?.gps ?? null;
  b.site.legacy = f.site?.legacy ?? null;
  for (const k of Object.keys(b.client)) b.client[k] = s(f.client?.[k]);
  for (const k of ['disco', 'supplyBand', 'landlordContact', 'managerContact']) b.power[k] = s(f.power?.[k]);
  b.power.noOtherSources = f.power?.noOtherSources === true;
  b.power.sources = (f.power?.sources ?? []).map((x) => ({ kind: x.kind, fuel: s(x.fuel), kva: s(x.kva), fuelSpendPerWeek: s(x.fuelSpendPerWeek), kwp: s(x.kwp), batteryKwh: s(x.batteryKwh), note: s(x.note) }));
  b.roof = { areaM2: s(f.roof?.areaM2), type: s(f.roof?.type) };
  b.appliances = (f.appliances ?? []).map((a) => ({ applianceId: a.applianceId, variantId: a.variantId, qty: String(a.qty), hoursKey: a.hoursKey ?? '', critical: Boolean(a.critical), note: s(a.note) }));
  b.review = { needsTechnical: f.review?.needsTechnical === true, reason: s(f.review?.reason) };
  b.comments = s(f.comments);
  return b;
};
const num = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v));
const text = (v) => (v == null ? null : String(v).trim() || null);
const toServer = (f) => ({
  v: 2,
  site: { siteName: text(f.site.siteName), siteType: f.site.siteType || null, unit: text(f.site.unit), occupancy: f.site.occupancy || null, accessNotes: text(f.site.accessNotes), gps: f.site.gps, legacy: f.site.legacy },
  client: { organisation: text(f.client.organisation), firstName: text(f.client.firstName), lastName: text(f.client.lastName), phone: text(f.client.phone), role: f.client.role || null, businessType: text(f.client.businessType), yearsAtSite: num(f.client.yearsAtSite) == null ? null : Math.round(num(f.client.yearsAtSite)) },
  power: {
    disco: f.power.disco || null, supplyBand: f.power.supplyBand || null,
    sources: f.power.sources.map((x) => ({ kind: x.kind, fuel: x.kind === 'generator' ? x.fuel || null : null, kva: ['generator', 'inverter'].includes(x.kind) ? num(x.kva) : null, fuelSpendPerWeek: x.kind === 'generator' ? num(x.fuelSpendPerWeek) : null, kwp: x.kind === 'solar' ? num(x.kwp) : null, batteryKwh: ['inverter', 'solar'].includes(x.kind) ? num(x.batteryKwh) : null, note: text(x.note) })),
    noOtherSources: f.power.sources.length === 0 ? f.power.noOtherSources : false,
    landlordContact: text(f.power.landlordContact), managerContact: text(f.power.managerContact),
  },
  roof: { areaM2: num(f.roof.areaM2), type: f.roof.type || null },
  appliances: f.appliances.filter((a) => a.applianceId && a.variantId && num(a.qty) >= 1).map((a) => ({ applianceId: a.applianceId, variantId: a.variantId, qty: Math.round(num(a.qty)), hoursKey: a.hoursKey || null, critical: Boolean(a.critical), note: text(a.note) })),
  review: { needsTechnical: f.review.needsTechnical, reason: f.review.needsTechnical ? text(f.review.reason) : null },
  comments: text(f.comments),
});

const localKey = (ref) => `sl-audit2-${ref}`;
const readLocal = (ref) => { try { return JSON.parse(localStorage.getItem(localKey(ref))); } catch { return null; } };
const writeLocal = (ref, form) => { try { localStorage.setItem(localKey(ref), JSON.stringify(form)); } catch { /* storage may be blocked */ } };
const hasData = (f) => f.appliances.length > 0 || f.site.siteName || f.client.firstName || f.power.sources.length > 0;
const hasGen = (f) => f.power.sources.some((x) => x.kind === 'generator');

// The agent's survey on site. Built for a phone: one short step at a time, saved as they go (and kept on the phone if the
// signal drops), the energy result shown live, and both the client and the agent sign on the screen at the end.
// Submitting sends it to the admin to check; the customer sees results only after approval.
export default function AgentJob() {
  const { ref } = useParams();
  const [job, setJob] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [form, setForm] = useState(null);
  const [step, setStep] = useState(0);
  const [missing, setMissing] = useState({});
  const [saveState, setSaveState] = useState('saved'); // saved | saving | offline
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const loaded = useRef(false);

  const load = useCallback(async () => {
    try {
      const [j, c] = await Promise.all([api.agentJob(ref), catalog ? Promise.resolve(catalog) : api.agentCatalog()]);
      setCatalog(c);
      setJob(j.job);
      setMissing(j.job.missing);
      const server = fromServer(j.job.form);
      const local = readLocal(ref);
      setForm(j.job.editable && local && !hasData(server) && hasData(local) ? local : server);
      loaded.current = false;
    } catch (e) { setError(e.message); }
  }, [ref]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  // Save a moment after the agent stops typing. The phone keeps its own copy first.
  useEffect(() => {
    if (!form || !job?.editable) return undefined;
    if (!loaded.current) { loaded.current = true; return undefined; }
    writeLocal(ref, form);
    setSaveState('saving');
    const t = setTimeout(async () => {
      try { const r = await api.agentSaveDraft(ref, toServer(form)); setMissing(r.missing); setSaveState('saved'); } catch { setSaveState('offline'); }
    }, 900);
    return () => clearTimeout(t);
  }, [form]); // eslint-disable-line react-hooks/exhaustive-deps

  // The same maths as the final result, refreshed as the list changes.
  const server = useMemo(() => (form ? toServer(form) : null), [form]);
  const previewKey = server ? JSON.stringify([server.power.disco, server.power.supplyBand, server.power.sources, server.roof.areaM2, server.appliances]) : '';
  useEffect(() => {
    if (!server || !job?.editable || !server.power.disco || server.appliances.length === 0) { setPreview(null); return undefined; }
    const t = setTimeout(() => api.agentPreview(ref, server).then((r) => setPreview(r.result)).catch(() => setPreview(null)), 700);
    return () => clearTimeout(t);
  }, [previewKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const patch = (section, values) => setForm((f) => ({ ...f, [section]: { ...f[section], ...values } }));

  const start = async () => {
    setBusy(true); setError(null);
    try { const r = await api.agentStart(ref); setJob(r.job); setMissing(r.job.missing); setForm(fromServer(r.job.form)); loaded.current = false; } catch (e) { setError(e.message); }
    setBusy(false);
  };

  const upload = async (slot, blob) => {
    setError(null);
    try {
      const r = await api.agentPhoto(ref, slot, blob);
      setJob((j) => ({ ...j, photos: { ...j.photos, [slot]: { imageId: r.imageId, url: r.url } } }));
      const d = await api.agentSaveDraft(ref, toServer(form));
      setMissing(d.missing);
    } catch (e) { setError(e.message); throw e; }
  };

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      const r = await api.agentSubmit(ref, toServer(form));
      try { localStorage.removeItem(localKey(ref)); } catch { /* ignore */ }
      setDone(r);
      await load();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'INCOMPLETE') { setMissing(e.details?.fields ?? {}); setError('A few things are still missing. They are listed below.'); } else setError(e.message);
    }
    setBusy(false);
  };

  if (error && !job) return <section className="wrap page-narrow empty-state"><h1>We couldn&apos;t open that job</h1><p className="lede">{error}</p><Link to="/app" className="btn btn-primary">Back to my jobs</Link></section>;
  if (!job || !catalog || !form) return <div className="page-loading" role="status">Loading the job…</div>;

  const contactBlock = (
    <section className="order-part">
      <h2>{job.businessName}</h2>
      <p>{job.address.place}</p>
      <p>Contact: <strong>{job.contact.name}</strong> · <a href={`tel:${job.contact.phone}`}>{job.contact.phone}</a></p>
      {job.preferredDate && <p className="muted">They would like the visit on {job.preferredDate}.</p>}
      {job.notes && <p className="muted">Note from them: {job.notes}</p>}
    </section>
  );

  // Not started: show the job and one button.
  if (job.status === 'assigned') {
    return (
      <div className="app-page">
        <p className="muted"><Link to="/app">← My jobs</Link></p>
        <header className="page-head"><p className="eyebrow">{job.ref}</p><h1>Energy audit</h1></header>
        {contactBlock}
        {error && <p className="form-error" role="alert">{error}</p>}
        <p className="muted">When you are at the site, tap start. The business is told the audit is in progress.</p>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={start}>{busy ? 'Starting…' : 'I am at the site: start the audit'}</button>
      </div>
    );
  }

  // Submitted or approved: read-only summary.
  if (!job.editable) {
    const approved = job.status === 'completed';
    return (
      <div className="app-page">
        <p className="muted"><Link to="/app">← My jobs</Link></p>
        <header className="page-head">
          <p className="eyebrow">{job.ref}</p>
          <h1>{approved ? 'Audit approved' : 'Audit submitted'}</h1>
          <p className="muted">Version {job.version}. {approved ? 'The admin approved it and the business has the result.' : 'It is with the admin to check. The business sees the result once it is approved. Only the admin can reopen it.'}</p>
        </header>
        {done && <p className="form-success" role="status">Submitted. Well done.</p>}
        {contactBlock}
        {job.result && <><ResultSummary result={job.result} /><AuditExtras result={job.result} /></>}
        {job.timeline && <ul className="plain-list">{job.timeline.map((e, i) => <li key={i}>{EVENT_LABEL[e.type] ?? e.type} · {new Date(e.at).toLocaleString('en-NG')}</li>)}</ul>}
      </div>
    );
  }

  const missingKeys = Object.keys(missing);
  const slots = catalog.photoSlots.filter((x) => !['signature', 'agent_signature'].includes(x.key) && (!x.needsGenerator || hasGen(form)));
  const last = STEPS.length - 1;
  const showSources = form.power.sources.length > 0;

  return (
    <div className="app-page audit-wizard">
      <p className="muted"><Link to="/app">← My jobs</Link></p>
      <header className="page-head">
        <p className="eyebrow">{job.ref} · {job.businessName}</p>
        <h1>Energy audit</h1>
        {job.upgraded && <p className="r-notice" role="note">This audit was started on the older plaza form. Its answers have been moved into the new form. Please check each step.</p>}
        {job.reviewNote && <p className="r-notice" role="note"><strong>The admin asked for a recheck:</strong> {job.reviewNote}</p>}
      </header>

      <ol className="wiz-steps" aria-label="Steps">
        {STEPS.map((t, i) => (
          <li key={t}><button type="button" className={i === step ? 'on' : ''} aria-current={i === step ? 'step' : undefined} onClick={() => setStep(i)}>{i + 1}. {t}</button></li>
        ))}
      </ol>
      <p className={`save-state save-${saveState}`} role="status">{saveState === 'saved' ? 'Saved' : saveState === 'saving' ? 'Saving…' : 'No signal: kept on this phone, will save when you are back online'}</p>
      {error && <p className="form-error" role="alert">{error}</p>}

      {step === 0 && (
        <fieldset className="profile-form">
          <legend className="dash-h3">Site</legend>
          <label className="field"><span>Name of the site *</span><input type="text" value={form.site.siteName} onChange={(e) => patch('site', { siteName: e.target.value })} maxLength={120} placeholder="Shop, house, school, plaza…" /></label>
          <label className="field"><span>Type of site *</span>
            <select value={form.site.siteType} onChange={(e) => patch('site', { siteType: e.target.value })}><option value="">Choose…</option>{catalog.siteTypes.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
          <label className="field"><span>Unit, shop or flat number</span><input type="text" value={form.site.unit} onChange={(e) => patch('site', { unit: e.target.value })} maxLength={60} /></label>
          <Choice label="Is the site in use?" value={form.site.occupancy} options={[['occupied', 'Occupied'], ['vacant', 'Vacant']]} onChange={(v) => patch('site', { occupancy: v })} />
          <label className="field"><span>How to get in</span><input type="text" value={form.site.accessNotes} onChange={(e) => patch('site', { accessNotes: e.target.value })} maxLength={300} placeholder="Gate code, who to ask for, opening hours" /></label>
          <GpsField value={form.site.gps} max={catalog.gpsMaxAccuracyM} onChange={(gps) => patch('site', { gps })} />
          {form.site.legacy && <p className="muted small">From the old form: {form.site.legacy.section ? `${form.site.legacy.section}` : ''}{form.site.legacy.shopNumber ? ` · shop ${form.site.legacy.shopNumber}` : ''}</p>}
        </fieldset>
      )}

      {step === 1 && (
        <fieldset className="profile-form">
          <legend className="dash-h3">Client</legend>
          <label className="field"><span>Organisation or business name</span><input type="text" value={form.client.organisation} onChange={(e) => patch('client', { organisation: e.target.value })} maxLength={120} /></label>
          <label className="field"><span>Client&apos;s first name *</span><input type="text" value={form.client.firstName} onChange={(e) => patch('client', { firstName: e.target.value })} maxLength={60} /></label>
          <label className="field"><span>Client&apos;s last name</span><input type="text" value={form.client.lastName} onChange={(e) => patch('client', { lastName: e.target.value })} maxLength={60} /></label>
          <label className="field"><span>Client&apos;s phone *</span><input type="tel" inputMode="tel" value={form.client.phone} onChange={(e) => patch('client', { phone: e.target.value })} maxLength={30} /></label>
          <label className="field"><span>Their role at the site</span>
            <select value={form.client.role} onChange={(e) => patch('client', { role: e.target.value })}><option value="">Choose…</option>{catalog.clientRoles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select></label>
          <label className="field"><span>Type of business</span>
            <input type="text" list="biz-types" value={form.client.businessType} onChange={(e) => patch('client', { businessType: e.target.value })} maxLength={80} />
            <datalist id="biz-types">{BUSINESS_TYPES.map((t) => <option key={t} value={t} />)}</datalist></label>
          <label className="field"><span>Years at the site</span><input type="number" inputMode="numeric" min="0" max="80" value={form.client.yearsAtSite} onChange={(e) => patch('client', { yearsAtSite: e.target.value })} /></label>
        </fieldset>
      )}

      {step === 2 && (
        <fieldset className="profile-form">
          <legend className="dash-h3">Power today</legend>
          <label className="field"><span>Electricity company *</span>
            <select value={form.power.disco} onChange={(e) => patch('power', { disco: e.target.value })}><option value="">Choose…</option>{catalog.discos.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
          <label className="field"><span>How much light do they get from the grid?</span>
            <select value={form.power.supplyBand} onChange={(e) => patch('power', { supplyBand: e.target.value })}>
              <option value="">Not sure</option>{catalog.supplyOptions.filter((o) => o.band).map((o) => <option key={o.band} value={o.band}>Band {o.band}: {o.title} ({o.detail})</option>)}</select></label>

          <h3 className="dash-h3">Other power sources *</h3>
          <p className="muted small">Add every generator, inverter or solar system already at the site, or tick the box below if there is only the grid.</p>
          <SourcesEditor sources={form.power.sources} kinds={catalog.sourceKinds} onChange={(sources) => patch('power', { sources })} />
          {!showSources && (
            <label className="check"><input type="checkbox" checked={form.power.noOtherSources} onChange={(e) => patch('power', { noOtherSources: e.target.checked })} /> Nothing besides the grid</label>
          )}

          <label className="field"><span>Landlord&apos;s contact</span><input type="text" value={form.power.landlordContact} onChange={(e) => patch('power', { landlordContact: e.target.value })} maxLength={120} placeholder="Name and phone" /></label>
          <label className="field"><span>Property manager or lawyer&apos;s contact</span><input type="text" value={form.power.managerContact} onChange={(e) => patch('power', { managerContact: e.target.value })} maxLength={120} /></label>
          <h3 className="dash-h3">Roof</h3>
          <label className="field"><span>Roof space that could take panels (m²)</span><input type="number" inputMode="decimal" min="0" value={form.roof.areaM2} onChange={(e) => patch('roof', { areaM2: e.target.value })} /><small>Walk or pace it. About 7 m² is needed for every kWp of panels.</small></label>
          <Choice label="Roof type" value={form.roof.type} options={[['flat', 'Flat'], ['pitched', 'Pitched'], ['other', 'Other']]} onChange={(v) => patch('roof', { type: v })} />
        </fieldset>
      )}

      {step === 3 && (
        <section>
          <h2 className="dash-h3">Appliances</h2>
          <AppliancePicker catalog={catalog} rows={form.appliances} onChange={(appliances) => setForm((f) => ({ ...f, appliances }))} />
          {missing.appliances && <p className="muted">Add at least one appliance.</p>}
          {preview ? <ResultSummary result={preview} compact /> : form.appliances.length > 0 && !form.power.disco && <p className="muted">Choose the electricity company in step 3 to see the live result.</p>}
        </section>
      )}

      {step === 4 && (
        <section>
          <h2 className="dash-h3">Site photos</h2>
          <p className="muted">Take clear pictures with the phone camera. Required ones are marked. The check-in photo shows you at the site.</p>
          <div className="photo-slots">
            {slots.map((x) => <PhotoSlot key={x.key} slot={x} photo={job.photos[x.key]} onUpload={(blob) => upload(x.key, blob)} />)}
          </div>
        </section>
      )}

      {step === 5 && (
        <section>
          <h2 className="dash-h3">Review and signatures</h2>
          {preview && <><ResultSummary result={preview} /><AuditExtras result={preview} /></>}
          <label className="field"><span>Comments</span><textarea rows={3} maxLength={1500} value={form.comments} onChange={(e) => setForm((f) => ({ ...f, comments: e.target.value }))} /></label>

          <label className="check"><input type="checkbox" checked={form.review.needsTechnical} onChange={(e) => patch('review', { needsTechnical: e.target.checked })} /> This site needs a technical review</label>
          {form.review.needsTechnical && (
            <label className="field"><span>What should the engineer look at? *</span><textarea rows={3} maxLength={500} value={form.review.reason} onChange={(e) => patch('review', { reason: e.target.value })} placeholder="Roof strength, three-phase supply, unusual loads…" /><small>Only our team sees this.</small></label>
          )}

          <h3 className="dash-h3">Client&apos;s signature *</h3>
          <p className="muted">Let the client confirm the details by signing here.</p>
          {job.photos.signature && <figure className="sig-saved"><img src={job.photos.signature.url} alt="Saved client signature" /><figcaption>Client signature saved</figcaption></figure>}
          <SignaturePad saved={Boolean(job.photos.signature)} disabled={busy} onSave={(blob) => upload('signature', blob)} />

          <h3 className="dash-h3">Your signature *</h3>
          {job.photos.agent_signature && <figure className="sig-saved"><img src={job.photos.agent_signature.url} alt="Saved agent signature" /><figcaption>Your signature saved</figcaption></figure>}
          <SignaturePad saved={Boolean(job.photos.agent_signature)} disabled={busy} onSave={(blob) => upload('agent_signature', blob)} />

          {missingKeys.length > 0 && (
            <div className="r-notice" role="status">
              <strong>Still needed before you can submit:</strong>
              <ul className="plain-list">{missingKeys.map((k) => <li key={k}><button type="button" className="link-btn" onClick={() => setStep(stepOfMissing(k))}>{missing[k]}</button></li>)}</ul>
            </div>
          )}
          <button type="button" className="btn btn-primary" disabled={busy || missingKeys.length > 0} onClick={submit}>{busy ? 'Submitting…' : 'Submit audit for approval'}</button>
          <p className="muted small">The admin checks it first. The business gets the result by email once it is approved.</p>
        </section>
      )}

      <div className="wiz-nav">
        <button type="button" className="btn btn-quiet" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</button>
        {step < last && <button type="button" className="btn btn-primary" onClick={() => { setStep(step + 1); window.scrollTo({ top: 0 }); }}>Next</button>}
      </div>
    </div>
  );
}

function Choice({ label, value, options, onChange }) {
  return (
    <div className="field">
      <span>{label}</span>
      <div className="choice-row" role="radiogroup" aria-label={label}>
        {options.map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={value === k} className={value === k ? 'chip on' : 'chip'} onClick={() => onChange(k)}>{l}</button>)}
      </div>
    </div>
  );
}


function GpsField({ value, max, onChange }) {
  const [state, setState] = useState('idle');
  const grab = () => {
    if (!navigator.geolocation) { setState('unsupported'); return; }
    setState('locating');
    navigator.geolocation.getCurrentPosition(
      (p) => { onChange({ lat: Math.round(p.coords.latitude * 1e6) / 1e6, lng: Math.round(p.coords.longitude * 1e6) / 1e6, accuracyM: Math.round(p.coords.accuracy), capturedAt: new Date().toISOString() }); setState('idle'); },
      () => setState('denied'),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  };
  const rough = value && (value.accuracyM == null || value.accuracyM > max);
  return (
    <div className="field">
      <span>GPS location *</span>
      {value ? (
        <p>{value.lat}, {value.lng}{value.accuracyM != null && <small> · accurate to about {value.accuracyM} m</small>} · <a href={`https://www.google.com/maps?q=${value.lat},${value.lng}`} target="_blank" rel="noreferrer noopener">Check on the map</a></p>
      ) : <p className="muted">Not captured yet.</p>}
      {rough && <small className="err" role="alert">Too rough to prove where you are. Go outside, wait a few seconds and capture again (it must be within {max} m).</small>}
      <button type="button" className="btn btn-quiet btn-small" onClick={grab} disabled={state === 'locating'}>{state === 'locating' ? 'Finding you…' : value ? 'Capture again' : 'Capture my location'}</button>
      {state === 'denied' && <small className="err">Location is blocked. Allow location for this site in your browser settings, then try again.</small>}
      {state === 'unsupported' && <small className="err">This phone cannot share its location here.</small>}
    </div>
  );
}

function SourcesEditor({ sources, kinds, onChange }) {
  const set = (i, p) => onChange(sources.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const add = (kind) => onChange([...sources, { kind, fuel: '', kva: '', fuelSpendPerWeek: '', kwp: '', batteryKwh: '', note: '' }]);
  const label = (k) => kinds.find((x) => x.id === k)?.label ?? k;
  return (
    <div className="sources">
      <ul className="appl-rows">
        {sources.map((x, i) => (
          <li key={i} className="appl-row">
            <div className="appl-head"><strong>{label(x.kind)}</strong><button type="button" className="link-btn" onClick={() => onChange(sources.filter((_, j) => j !== i))} aria-label={`Remove ${label(x.kind)}`}>Remove</button></div>
            {x.kind === 'generator' && (
              <>
                <label className="field"><span>Fuel</span><select value={x.fuel} onChange={(e) => set(i, { fuel: e.target.value })}><option value="">Choose…</option><option value="petrol">Petrol</option><option value="diesel">Diesel</option><option value="gas">Gas</option><option value="other">Other</option></select></label>
                <label className="field"><span>Size (kVA)</span><input type="number" inputMode="decimal" min="0" value={x.kva} onChange={(e) => set(i, { kva: e.target.value })} /></label>
                <label className="field"><span>Fuel spend each week (₦)</span><input type="number" inputMode="numeric" min="0" value={x.fuelSpendPerWeek} onChange={(e) => set(i, { fuelSpendPerWeek: e.target.value })} /><small>Compared with our estimate in the result.</small></label>
              </>
            )}
            {x.kind === 'inverter' && (
              <>
                <label className="field"><span>Inverter size (kVA)</span><input type="number" inputMode="decimal" min="0" value={x.kva} onChange={(e) => set(i, { kva: e.target.value })} /></label>
                <label className="field"><span>Battery (kWh)</span><input type="number" inputMode="decimal" min="0" value={x.batteryKwh} onChange={(e) => set(i, { batteryKwh: e.target.value })} /></label>
              </>
            )}
            {x.kind === 'solar' && (
              <>
                <label className="field"><span>Panels (kWp)</span><input type="number" inputMode="decimal" min="0" value={x.kwp} onChange={(e) => set(i, { kwp: e.target.value })} /></label>
                <label className="field"><span>Battery (kWh)</span><input type="number" inputMode="decimal" min="0" value={x.batteryKwh} onChange={(e) => set(i, { batteryKwh: e.target.value })} /></label>
              </>
            )}
            <label className="field"><span>Note</span><input type="text" value={x.note} maxLength={200} onChange={(e) => set(i, { note: e.target.value })} placeholder={x.kind === 'other' ? 'Describe it' : 'Age, condition, brand'} /></label>
          </li>
        ))}
      </ul>
      <div className="choice-row">
        {kinds.map((k) => <button key={k.id} type="button" className="chip" onClick={() => add(k.id)}>+ {k.label}</button>)}
      </div>
    </div>
  );
}

function AppliancePicker({ catalog, rows, onChange }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const byId = useMemo(() => new Map(catalog.appliances.map((a) => [a.id, a])), [catalog]);
  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle && !cat) return [];
    return catalog.appliances.filter((a) => (!cat || a.category === cat) && (!needle || a.name.toLowerCase().includes(needle))).slice(0, 40);
  }, [catalog, q, cat]);

  const add = (ap) => {
    const def = ap.variants.find((v) => v.default) ?? ap.variants[0];
    onChange([...rows, { applianceId: ap.id, variantId: def.id, qty: '1', hoursKey: ap.hoursMode === 'fixed' ? '' : ap.defaultHours ?? '', critical: false }]);
    setQ('');
  };
  const set = (i, patch) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <div className="appl">
      <div className="appl-search">
        <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category"><option value="">All types</option>{catalog.categories.map((c) => <option key={c} value={c}>{c}</option>)}</select>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search: freezer, hair dryer, sewing machine…" aria-label="Search appliances" />
      </div>
      {results.length > 0 && (
        <ul className="appl-results" role="listbox" aria-label="Matching appliances">
          {results.map((a) => <li key={a.id}><button type="button" onClick={() => add(a)}><strong>{a.name}</strong>{a.hint && <small>{a.hint}</small>}</button></li>)}
        </ul>
      )}
      {rows.length === 0 && <p className="muted">Nothing added yet. Search above and tap an appliance to add it.</p>}
      <ul className="appl-rows">
        {rows.map((r, i) => {
          const ap = byId.get(r.applianceId);
          if (!ap) return null;
          return (
            <li key={`${r.applianceId}-${i}`} className="appl-row">
              <div className="appl-head"><strong>{ap.name}</strong><button type="button" className="link-btn" onClick={() => onChange(rows.filter((_, j) => j !== i))} aria-label={`Remove ${ap.name}`}>Remove</button></div>
              {ap.variants.length > 1 && (
                <label className="field"><span>Which one</span><select value={r.variantId} onChange={(e) => set(i, { variantId: e.target.value })}>{ap.variants.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}</select></label>
              )}
              <div className="appl-two">
                <label className="field"><span>How many</span><input type="number" inputMode="numeric" min="1" max={ap.maxQty} value={r.qty} onChange={(e) => set(i, { qty: e.target.value })} /></label>
                {ap.hoursMode === 'fixed' ? (
                  <div className="field"><span>Hours a day</span><p className="muted">All day and night</p></div>
                ) : (
                  <label className="field"><span>Hours a day</span><select value={r.hoursKey} onChange={(e) => set(i, { hoursKey: e.target.value })}>{catalog.hourOptions.map((h) => <option key={h.key} value={h.key}>{h.label}</option>)}</select></label>
                )}
              </div>
              <label className="check"><input type="checkbox" checked={r.critical} onChange={(e) => set(i, { critical: e.target.checked })} /> Must keep running in a power cut</label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PhotoSlot({ slot, photo, onUpload }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true); setErr(null);
    try { await onUpload(await shrink(file)); } catch (x) { setErr(x.message || 'Could not upload. Try again.'); }
    setBusy(false);
  };
  return (
    <div className="photo-slot">
      <div className="photo-slot-head"><strong>{PHOTO_LABEL[slot.key] ?? slot.label}</strong>{slot.required ? <span className="badge badge-warn">Required</span> : <span className="badge">Optional</span>}</div>
      {photo ? <img src={photo.url} alt={slot.label} loading="lazy" /> : <div className="photo-empty">No photo yet</div>}
      <label className="btn btn-quiet btn-small file-btn">
        {busy ? 'Uploading…' : photo ? 'Retake' : 'Take photo'}
        <input type="file" accept="image/*" capture="environment" onChange={pick} disabled={busy} hidden />
      </label>
      {err && <small className="err">{err}</small>}
    </div>
  );
}

function ResultSummary({ result, compact }) {
  const s = result.solar;
  const u = result.usage;
  return (
    <section className={compact ? 'r-mini' : 'r-card'}>
      <p className="eyebrow">{compact ? 'Live result' : 'Energy requirement'}</p>
      <dl className="r-stats">
        <div><dt>Energy a day</dt><dd>{kwh(u.kwhPerDay)} kWh</dd></div>
        <div><dt>Connected load</dt><dd>{u.connectedKw} kW</dd></div>
        <div><dt>Panels</dt><dd>{s.kwp} kWp</dd></div>
        <div><dt>Battery</dt><dd>{s.batteryKwh} kWh</dd></div>
        <div><dt>Inverter</dt><dd>{s.inverterKva} kVA</dd></div>
        <div><dt>System about</dt><dd>{naira(s.systemCost)}</dd></div>
      </dl>
      <p className="muted small">{result.audit.eaasEligible ? 'Large enough to offer energy as a service.' : `Below the ${result.audit.eaasMinKwhPerDay} kWh a day needed for energy as a service.`}</p>
    </section>
  );
}
