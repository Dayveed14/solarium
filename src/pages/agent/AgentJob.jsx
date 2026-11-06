import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError, api } from '../../api.js';
import { PHOTO_LABEL, EVENT_LABEL } from '../../lib/audit.js';
import { kwh, naira } from '../../lib/format.js';
import { shrink } from '../../lib/shrink.js';
import AuditExtras from '../audit/AuditExtras.jsx';
import SignaturePad from './SignaturePad.jsx';

const STEPS = ['Site', 'Business', 'Power', 'Appliances', 'Photos', 'Review'];
const BUSINESS_TYPES = ['Provision store', 'Supermarket', 'Salon / barber', 'Restaurant / bar', 'Phone & gadgets', 'Pharmacy', 'Tailor / fashion', 'Printing / cyber café', 'Electronics', 'Office', 'Other'];
const stepOfMissing = (key) => (key.startsWith('site.') ? 0 : key.startsWith('business.') ? 1 : key.startsWith('power.') ? 2 : key === 'appliances' ? 3 : key === 'photo.signature' ? 5 : 4);

const blank = () => ({
  site: { plazaName: '', section: '', shopNumber: '', shopStatus: '', gps: null },
  business: { shopName: '', ownerFirstName: '', ownerLastName: '', ownerPhone: '', businessType: '', yearsInPlaza: '' },
  power: { disco: '', supplyBand: '', usesGenerator: null, generatorType: '', generatorKva: '', fuelSpendPerWeek: '', otherEnergy: '', landlordContact: '', managerContact: '' },
  roof: { areaM2: '', type: '' },
  appliances: [],
  comments: '',
});
// The server stores numbers and nulls; the inputs want strings.
const fromServer = (f) => {
  const b = blank();
  const s = (v) => (v == null ? '' : String(v));
  for (const k of Object.keys(b.site)) b.site[k] = k === 'gps' ? f.site?.gps ?? null : s(f.site?.[k]);
  for (const k of Object.keys(b.business)) b.business[k] = s(f.business?.[k]);
  for (const k of Object.keys(b.power)) b.power[k] = k === 'usesGenerator' ? f.power?.usesGenerator ?? null : s(f.power?.[k]);
  b.roof = { areaM2: s(f.roof?.areaM2), type: s(f.roof?.type) };
  b.appliances = (f.appliances ?? []).map((a) => ({ applianceId: a.applianceId, variantId: a.variantId, qty: String(a.qty), hoursKey: a.hoursKey ?? '', critical: Boolean(a.critical) }));
  b.comments = s(f.comments);
  return b;
};
const num = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v));
const text = (v) => (v == null ? null : String(v).trim() || null);
const toServer = (f) => ({
  site: { plazaName: text(f.site.plazaName), section: f.site.section || null, shopNumber: text(f.site.shopNumber), shopStatus: f.site.shopStatus || null, gps: f.site.gps },
  business: { shopName: text(f.business.shopName), ownerFirstName: text(f.business.ownerFirstName), ownerLastName: text(f.business.ownerLastName), ownerPhone: text(f.business.ownerPhone), businessType: text(f.business.businessType), yearsInPlaza: num(f.business.yearsInPlaza) == null ? null : Math.round(num(f.business.yearsInPlaza)) },
  power: {
    disco: f.power.disco || null, supplyBand: f.power.supplyBand || null, usesGenerator: f.power.usesGenerator,
    generatorType: f.power.usesGenerator ? f.power.generatorType || null : null, generatorKva: f.power.usesGenerator ? num(f.power.generatorKva) : null, fuelSpendPerWeek: f.power.usesGenerator ? num(f.power.fuelSpendPerWeek) : null,
    otherEnergy: text(f.power.otherEnergy), landlordContact: text(f.power.landlordContact), managerContact: text(f.power.managerContact),
  },
  roof: { areaM2: num(f.roof.areaM2), type: f.roof.type || null },
  appliances: f.appliances.filter((a) => a.applianceId && a.variantId && num(a.qty) >= 1).map((a) => ({ applianceId: a.applianceId, variantId: a.variantId, qty: Math.round(num(a.qty)), hoursKey: a.hoursKey || null, critical: Boolean(a.critical) })),
  comments: text(f.comments),
});

const localKey = (ref) => `sl-audit-${ref}`;
const readLocal = (ref) => { try { return JSON.parse(localStorage.getItem(localKey(ref))); } catch { return null; } };
const writeLocal = (ref, form) => { try { localStorage.setItem(localKey(ref), JSON.stringify(form)); } catch { /* storage may be blocked */ } };
const hasData = (f) => f.appliances.length > 0 || f.site.plazaName || f.business.shopName;

// The agent's survey on site. Built for a phone: one short step at a time, saved as they go (and kept on the phone if the
// signal drops), the energy result shown live, and the owner signs on the screen at the end.
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
  const previewKey = server ? JSON.stringify([server.power.disco, server.power.supplyBand, server.power.usesGenerator, server.power.fuelSpendPerWeek, server.roof.areaM2, server.appliances]) : '';
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

  // Finished: read-only summary.
  if (!job.editable) {
    return (
      <div className="app-page">
        <p className="muted"><Link to="/app">← My jobs</Link></p>
        <header className="page-head"><p className="eyebrow">{job.ref}</p><h1>Audit submitted</h1><p className="muted">Version {job.version}. The business, the admin and you have the result by email. Only the admin can reopen it.</p></header>
        {done && <p className="form-success" role="status">Submitted. Well done.</p>}
        {contactBlock}
        {job.result && <><ResultSummary result={job.result} /><AuditExtras result={job.result} /></>}
        {job.timeline && <ul className="plain-list">{job.timeline.map((e, i) => <li key={i}>{EVENT_LABEL[e.type] ?? e.type} · {new Date(e.at).toLocaleString('en-NG')}</li>)}</ul>}
      </div>
    );
  }

  const missingKeys = Object.keys(missing);
  const slots = catalog.photoSlots.filter((s) => s.key !== 'signature' && (!s.needsGenerator || form.power.usesGenerator === true));
  const last = STEPS.length - 1;

  return (
    <div className="app-page audit-wizard">
      <p className="muted"><Link to="/app">← My jobs</Link></p>
      <header className="page-head">
        <p className="eyebrow">{job.ref} · {job.businessName}</p>
        <h1>Energy audit</h1>
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
          <label className="field"><span>Plaza or market name *</span><input type="text" value={form.site.plazaName} onChange={(e) => patch('site', { plazaName: e.target.value })} maxLength={120} /></label>
          <Choice label="Plaza or kiosk *" value={form.site.section} options={[['plaza', 'Plaza'], ['kiosk', 'Kiosk']]} onChange={(v) => patch('site', { section: v })} />
          <label className="field"><span>Shop number</span><input type="text" value={form.site.shopNumber} onChange={(e) => patch('site', { shopNumber: e.target.value })} maxLength={20} /></label>
          <Choice label="Is the shop occupied? *" value={form.site.shopStatus} options={[['occupied', 'Occupied'], ['unoccupied', 'Unoccupied']]} onChange={(v) => patch('site', { shopStatus: v })} />
          <GpsField value={form.site.gps} onChange={(gps) => patch('site', { gps })} />
        </fieldset>
      )}

      {step === 1 && (
        <fieldset className="profile-form">
          <legend className="dash-h3">Business and owner</legend>
          <label className="field"><span>Shop or business name *</span><input type="text" value={form.business.shopName} onChange={(e) => patch('business', { shopName: e.target.value })} maxLength={120} /></label>
          <label className="field"><span>Owner&apos;s first name *</span><input type="text" value={form.business.ownerFirstName} onChange={(e) => patch('business', { ownerFirstName: e.target.value })} maxLength={60} /></label>
          <label className="field"><span>Owner&apos;s last name</span><input type="text" value={form.business.ownerLastName} onChange={(e) => patch('business', { ownerLastName: e.target.value })} maxLength={60} /></label>
          <label className="field"><span>Owner&apos;s phone *</span><input type="tel" inputMode="tel" value={form.business.ownerPhone} onChange={(e) => patch('business', { ownerPhone: e.target.value })} maxLength={30} /></label>
          <label className="field"><span>Type of business</span>
            <input type="text" list="biz-types" value={form.business.businessType} onChange={(e) => patch('business', { businessType: e.target.value })} maxLength={80} />
            <datalist id="biz-types">{BUSINESS_TYPES.map((t) => <option key={t} value={t} />)}</datalist></label>
          <label className="field"><span>Years in the plaza</span><input type="number" inputMode="numeric" min="0" max="80" value={form.business.yearsInPlaza} onChange={(e) => patch('business', { yearsInPlaza: e.target.value })} /></label>
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
          <Choice label="Does the shop use a generator? *" value={form.power.usesGenerator == null ? '' : form.power.usesGenerator ? 'yes' : 'no'} options={[['yes', 'Yes'], ['no', 'No']]} onChange={(v) => patch('power', { usesGenerator: v === 'yes' })} />
          {form.power.usesGenerator === true && (
            <>
              <label className="field"><span>Generator type</span>
                <select value={form.power.generatorType} onChange={(e) => patch('power', { generatorType: e.target.value })}><option value="">Choose…</option><option value="petrol">Petrol</option><option value="diesel">Diesel</option><option value="gas">Gas</option><option value="other">Other</option></select></label>
              <label className="field"><span>Generator size (kVA)</span><input type="number" inputMode="decimal" min="0" value={form.power.generatorKva} onChange={(e) => patch('power', { generatorKva: e.target.value })} /></label>
              <label className="field"><span>Fuel spend each week (₦)</span><input type="number" inputMode="numeric" min="0" value={form.power.fuelSpendPerWeek} onChange={(e) => patch('power', { fuelSpendPerWeek: e.target.value })} /><small>This is compared with our estimate in the result.</small></label>
            </>
          )}
          <label className="field"><span>Other energy sources</span><input type="text" value={form.power.otherEnergy} onChange={(e) => patch('power', { otherEnergy: e.target.value })} maxLength={200} placeholder="e.g. a shared plaza generator, a small solar kit" /></label>
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
          <p className="muted">Take clear pictures with the phone camera. Required ones are marked.</p>
          <div className="photo-slots">
            {slots.map((s) => <PhotoSlot key={s.key} slot={s} photo={job.photos[s.key]} onUpload={(blob) => upload(s.key, blob)} />)}
          </div>
        </section>
      )}

      {step === 5 && (
        <section>
          <h2 className="dash-h3">Review and owner&apos;s signature</h2>
          {preview && <><ResultSummary result={preview} /><AuditExtras result={preview} /></>}
          <label className="field"><span>Comments</span><textarea rows={3} maxLength={1500} value={form.comments} onChange={(e) => setForm((f) => ({ ...f, comments: e.target.value }))} /></label>
          <h3 className="dash-h3">Owner&apos;s signature *</h3>
          <p className="muted">Let the owner confirm the details by signing here.</p>
          {job.photos.signature && <figure className="sig-saved"><img src={job.photos.signature.url} alt="Saved signature" /><figcaption>Signature saved</figcaption></figure>}
          <SignaturePad saved={Boolean(job.photos.signature)} disabled={busy} onSave={(blob) => upload('signature', blob)} />

          {missingKeys.length > 0 && (
            <div className="r-notice" role="status">
              <strong>Still needed before you can submit:</strong>
              <ul className="plain-list">{missingKeys.map((k) => <li key={k}><button type="button" className="link-btn" onClick={() => setStep(stepOfMissing(k))}>{missing[k]}</button></li>)}</ul>
            </div>
          )}
          <button type="button" className="btn btn-primary" disabled={busy || missingKeys.length > 0} onClick={submit}>{busy ? 'Submitting…' : 'Submit audit and send results'}</button>
          <p className="muted small">On submit the business, the admin and you get the result by email.</p>
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

function GpsField({ value, onChange }) {
  const [state, setState] = useState('idle');
  const grab = () => {
    if (!navigator.geolocation) { setState('unsupported'); return; }
    setState('locating');
    navigator.geolocation.getCurrentPosition(
      (p) => { onChange({ lat: Math.round(p.coords.latitude * 1e6) / 1e6, lng: Math.round(p.coords.longitude * 1e6) / 1e6, accuracyM: Math.round(p.coords.accuracy) }); setState('idle'); },
      () => setState('denied'),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };
  return (
    <div className="field">
      <span>GPS location *</span>
      {value ? (
        <p>{value.lat}, {value.lng}{value.accuracyM != null && <small> · accurate to about {value.accuracyM} m</small>} · <a href={`https://www.google.com/maps?q=${value.lat},${value.lng}`} target="_blank" rel="noreferrer noopener">Check on the map</a></p>
      ) : <p className="muted">Not captured yet.</p>}
      <button type="button" className="btn btn-quiet btn-small" onClick={grab} disabled={state === 'locating'}>{state === 'locating' ? 'Finding you…' : value ? 'Capture again' : 'Capture my location'}</button>
      {state === 'denied' && <small className="err">Location is blocked. Allow location for this site in your browser settings, then try again.</small>}
      {state === 'unsupported' && <small className="err">This phone cannot share its location here.</small>}
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
