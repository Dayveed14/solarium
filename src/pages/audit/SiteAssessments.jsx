import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError, api } from '../../api.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import AddressFields from '../../components/AddressFields.jsx';
import { formatDate } from '../../lib/format.js';
import { AUDIT_STATUS } from '../../lib/audit.js';

const isoDay = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
// 0803... becomes +234803...; anything already starting with + is left alone.
const intl = (v) => { const t = v.replace(/[\s-]/g, ''); return t.startsWith('+') ? t : t.startsWith('0') ? `+234${t.slice(1)}` : t; };

// Business accounts ask for a field assessment here: for plazas, estates and companies that are too big for the quick estimate.
export default function SiteAssessments() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [list, setList] = useState(null);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ contactName: user.fullName, contactPhone: user.phone ?? '', preferredDate: isoDay(3), notes: '' });
  const [address, setAddress] = useState(user.address ? { line: user.address.line, state: user.address.state, areaId: user.address.areaId } : { line: '', state: '', areaId: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.auditList().then((r) => setList(r.audits)).catch((e) => setError(e.message)); }, []);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true); setErrors({}); setError(null);
    try {
      const r = await api.auditRequest({
        contactName: form.contactName.trim() || undefined,
        contactPhone: form.contactPhone.trim() ? intl(form.contactPhone) : undefined,
        state: address.state, areaId: address.areaId, line: address.line.trim(),
        preferredDate: form.preferredDate || undefined, notes: form.notes.trim() || undefined,
      });
      navigate(`/app/site-assessment/${r.audit.ref}`);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'VALIDATION_ERROR') {
        const f = err.details?.fields ?? {};
        setErrors({ ...f, 'address.line': f.line, 'address.state': f.state, 'address.areaId': f.areaId });
      } else setError(err.message);
      setSaving(false);
    }
  };

  return (
    <div className="app-page">
      <header className="page-head">
        <h1>Site assessment</h1>
        <p className="muted">For plazas, estates, factories and large shops. A Solariun field agent visits, measures what you really use, photographs the site and we work out your energy requirement. It is free, and you follow every step here.</p>
      </header>
      {error && <p className="form-error" role="alert">{error}</p>}

      <form onSubmit={submit} noValidate className="profile-form install-form">
        <h2 className="dash-h3">Request a site visit</h2>
        <AddressFields value={address} onChange={setAddress} errors={errors} legend="Where is the site?" />
        <label className="field"><span>Contact person at the site</span>
          <input type="text" value={form.contactName} onChange={set('contactName')} aria-invalid={Boolean(errors.contactName)} />
          {errors.contactName && <small className="err">{errors.contactName}</small>}</label>
        <label className="field"><span>Their phone number</span>
          <input type="tel" inputMode="tel" value={form.contactPhone} onChange={set('contactPhone')} aria-invalid={Boolean(errors.contactPhone)} />
          {errors.contactPhone ? <small className="err">{errors.contactPhone}</small> : <small>The agent calls this number before arriving.</small>}</label>
        <label className="field"><span>Day you would like the visit</span>
          <input type="date" min={isoDay(0)} value={form.preferredDate} onChange={set('preferredDate')} aria-invalid={Boolean(errors.preferredDate)} />
          {errors.preferredDate && <small className="err">{errors.preferredDate}</small>}</label>
        <label className="field"><span>Anything the agent should know <em>(optional)</em></span>
          <textarea rows={3} maxLength={500} value={form.notes} onChange={set('notes')} placeholder="e.g. Ask for the plaza manager at the gate" /></label>
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Sending…' : 'Request energy assessment'}</button>
        <p className="muted small">Smaller place? The quick estimate on <Link to="/app">your dashboard</Link> works for a single shop or office.</p>
      </form>

      <h2 className="dash-h3">Your requests</h2>
      {!list && !error && <p className="muted" role="status">Loading…</p>}
      {list && list.length === 0 && <p className="muted">No site assessments yet.</p>}
      {list && list.length > 0 && (
        <ul className="order-list">
          {list.map((a) => (
            <li key={a.ref}>
              <Link to={`/app/site-assessment/${a.ref}`} className="order-row">
                <span><strong>{a.ref}</strong><small>{formatDate(a.createdAt)}</small></span>
                <span>{a.address.place}</span>
                <span className="badge badge-active">{AUDIT_STATUS[a.status]}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
