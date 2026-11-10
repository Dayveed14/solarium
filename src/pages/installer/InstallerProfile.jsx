import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../api.js';
import { FilesBox, MultiRow, OptionRow } from './RegistrationParts.jsx';

// An installer's working profile: what customers and our team use to match jobs. Who they are stays locked once approved.
export default function InstallerProfile() {
  const [st, setSt] = useState(null);
  const [form, setForm] = useState({});
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (first = false) => {
    const r = await api.installerRegistration();
    setSt(r);
    if (first) setForm({ ...r.registration });
  }, []);
  useEffect(() => { load(true).catch((e) => setError(e.message)); }, [load]);

  const capacityOptions = useMemo(() => (st?.options.capacity ?? []).map((n) => ({ id: n, label: n === 1 ? '1 job' : n === 10 ? 'Up to 10 jobs' : `${n} jobs` })), [st]);
  if (error && !st) return <div className="wrap dash"><p className="form-error" role="alert">{error}</p></div>;
  if (!st) return <div className="wrap dash"><p className="muted" role="status">Loading…</p></div>;

  const locked = st.verification === 'verified';
  const o = st.options;
  const set = (patch) => { setForm((f) => ({ ...f, ...patch })); setSaved(false); };
  const label = (list, id) => list.find((x) => x.id === id)?.label ?? 'Not set';

  const save = async () => {
    setBusy(true); setError(null);
    try {
      const patch = {};
      for (const k of ['travelKm', 'capacity', 'responseTime', 'acceptsRepairs', 'projectTypes', 'about', ...(locked ? [] : ['businessStatus', 'experienceBand', 'qualification'])]) {
        if (form[k] !== undefined && form[k] !== null) patch[k] = form[k];
      }
      setSt(await api.installerSaveRegistration(patch));
      setSaved(true);
    } catch (e) { setError(e.message); }
    setBusy(false);
  };

  return (
    <div className="wrap dash">
      <header className="dash-head"><div><p className="eyebrow">Installer account</p><h1>Your work profile</h1><p className="muted">Keep this up to date so the right jobs reach you.</p></div></header>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="profile-form reg-step">
        {locked && (
          <dl className="reg-facts">
            <div><dt>Business</dt><dd>{label(o.businessStatus, st.registration.businessStatus)}</dd></div>
            <div><dt>Experience</dt><dd>{label(o.experience, st.registration.experienceBand)}</dd></div>
            <div><dt>Qualification</dt><dd>{label(o.qualification, st.registration.qualification)}</dd></div>
          </dl>
        )}
        <OptionRow label="How far will you travel?" value={form.travelKm} options={o.travelKm} onChange={(v) => set({ travelKm: v })} />
        <MultiRow label="Jobs you take" value={form.projectTypes} options={o.projectTypes} onChange={(v) => set({ projectTypes: v })} />
        <OptionRow label="Jobs you can handle at once" value={form.capacity} options={capacityOptions} onChange={(v) => set({ capacity: v })} />
        <OptionRow label="How quickly you answer" value={form.responseTime} options={o.responseTime} onChange={(v) => set({ responseTime: v })} />
        <label className="check">
          <input type="checkbox" checked={form.acceptsRepairs !== false} onChange={(e) => set({ acceptsRepairs: e.target.checked })} />
          <span>I take repair jobs as well as new installations.</span>
        </label>
        <label className="field">
          <span>About your work</span>
          <textarea rows={4} maxLength={1000} value={form.about ?? ''} onChange={(e) => set({ about: e.target.value })} />
        </label>
        <div className="wiz-nav-plain">
          <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save changes'}</button>
          {saved && <span className="muted" role="status">Saved</span>}
        </div>

        <h2 className="dash-h3">Pictures and certificates</h2>
        <FilesBox kind="photo" title="Profile photo or logo" hint="A clear picture of you or your company logo." docs={st.documents} limit={o.docLimits.photo} onChange={() => load()} onError={setError} />
        <FilesBox kind="work" title="Pictures of past work" hint={`Up to ${o.docLimits.work} pictures.`} docs={st.documents} limit={o.docLimits.work} onChange={() => load()} onError={setError} />
        <FilesBox kind="certificate" title="Certificates or training records" hint="PDF or picture, up to 4 MB each." docs={st.documents} limit={o.docLimits.certificate} locked={locked} onChange={() => load()} onError={setError} />
      </div>
    </div>
  );
}
