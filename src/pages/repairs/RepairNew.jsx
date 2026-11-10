import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError, api } from '../../api.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import AddressFields from '../../components/AddressFields.jsx';
import { naira } from '../../lib/format.js';
import { PayNotice, PhotoPicker } from './shared.jsx';

// Report a fault: what is wrong, which equipment, how urgent, where, and a few pictures. The call-out fee is shown on the next screen.
export default function RepairNew() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [opts, setOpts] = useState(null);
  const [form, setForm] = useState({ faultType: '', description: '', equipment: [], urgency: 'normal' });
  const [address, setAddress] = useState(user.address ? { line: user.address.line, state: user.address.state, areaId: user.address.areaId } : { line: '', state: '', areaId: '' });
  const [files, setFiles] = useState([]);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { api.repairOptions().then(setOpts).catch((e) => setError(e.message)); }, []);

  const toggle = (id) => setForm((f) => ({ ...f, equipment: f.equipment.includes(id) ? f.equipment.filter((x) => x !== id) : [...f.equipment, id] }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true); setErrors({}); setError(null);
    try {
      const r = await api.repairCreate({ ...form, description: form.description.trim(), state: address.state, areaId: address.areaId, line: address.line.trim() });
      for (const f of files) { try { await api.repairPhoto(r.request.ref, f.blob); } catch { /* the request is saved; pictures can be added on the next screen */ } }
      navigate(`/app/repairs/${r.request.ref}`);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'VALIDATION_ERROR') setErrors(err.details?.fields ?? {});
      else setError(err.message);
      setSaving(false);
    }
  };

  return (
    <div className="app-page">
      <p><Link to="/app/repairs">← My repairs</Link></p>
      <header className="page-head"><div><h1>Report a fault</h1><p className="muted">Tell us what is wrong. Next you will see your call-out fee and pay it to send a technician. The technician inspects first and quotes any repair before work starts.</p></div></header>
      {error && <p className="form-error" role="alert">{error}</p>}
      {!opts && !error && <p className="muted" role="status">Loading…</p>}
      {opts && (
        <form onSubmit={submit} noValidate className="profile-form install-form">
          <label className="field">
            <span>What is wrong?</span>
            <select value={form.faultType} onChange={(e) => setForm((f) => ({ ...f, faultType: e.target.value }))} aria-invalid={Boolean(errors.faultType)}>
              <option value="">Choose one…</option>
              {opts.faultTypes.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
            {errors.faultType && <small className="err">{errors.faultType}</small>}
          </label>
          <label className="field">
            <span>Describe it</span>
            <textarea rows={4} maxLength={1500} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="When did it start? Any lights, beeps or error codes? What happens when it fails?" aria-invalid={Boolean(errors.description)} />
            {errors.description && <small className="err">{errors.description}</small>}
          </label>
          <div className="field">
            <span>Which equipment is affected?</span>
            <div className="choice-row" role="group" aria-label="Equipment affected">
              {opts.equipment.map((o) => <button key={o.id} type="button" aria-pressed={form.equipment.includes(o.id)} className={form.equipment.includes(o.id) ? 'chip on' : 'chip'} onClick={() => toggle(o.id)}>{o.label}</button>)}
            </div>
            {errors.equipment && <small className="err">{errors.equipment}</small>}
          </div>
          <div className="field">
            <span>How urgent is it?</span>
            <div className="choice-row" role="radiogroup" aria-label="How urgent is it?">
              {opts.urgency.map((o) => <button key={o.id} type="button" role="radio" aria-checked={form.urgency === o.id} className={form.urgency === o.id ? 'chip on' : 'chip'} onClick={() => setForm((f) => ({ ...f, urgency: o.id }))}>{o.label}</button>)}
            </div>
          </div>
          <div className="field">
            <span>Pictures of the fault (optional, but they help a lot)</span>
            <PhotoPicker files={files} setFiles={setFiles} max={opts.maxPhotos} label="Add a picture" disabled={saving} />
          </div>
          <AddressFields value={address} onChange={setAddress} legend="Where is the system?" errors={{ 'address.line': errors.line, 'address.state': errors.state, 'address.area': errors.areaId, 'address.areaId': errors.areaId }} />
          <p className="muted small-note">The technician only sees your street address after they accept the job.</p>
          <aside className="r-banner"><div>
            <strong>Call-out fee by distance</strong>
            <span>{opts.fees.bands.map((b) => `${b.label}: ${naira(b.fee)}`).join(' · ')}. The fee is fixed for your address once shown, and it is credited against the repair if you go ahead.</span>
          </div></aside>
          <PayNotice text={opts.payNotice} />
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Sending…' : 'Continue'}</button>
        </form>
      )}
    </div>
  );
}
