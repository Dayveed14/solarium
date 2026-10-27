import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError, api } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import AddressFields from '../components/AddressFields.jsx';
import { formatDate, naira } from '../lib/format.js';

export const INSTALL_STATUS = {
  quote: 'Quote',
  awaiting_payment: 'Awaiting payment',
  open: 'Finding an installer',
  assigned: 'Installer confirmed',
  installer_done: 'Waiting for your confirmation',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const isoDay = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);

// Customers ask for an installer here: describe the job, see the price from the size bands, pay, and follow progress.
export default function Installations() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [list, setList] = useState(null);
  const [bands, setBands] = useState([]);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ description: '', systemKw: '', preferredDate: isoDay(3) });
  const [address, setAddress] = useState(user.address ? { line: user.address.line, state: user.address.state, areaId: user.address.areaId } : { line: '', state: '', areaId: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.installList().then((r) => setList(r.requests)).catch((e) => setError(e.message));
    api.installBands().then((r) => setBands(r.bands)).catch(() => {});
  }, []);

  const kw = Number.parseFloat(form.systemKw);
  const band = useMemo(() => (Number.isFinite(kw) && kw > 0 ? bands.find((b) => kw <= b.maxKw) : null), [kw, bands]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    setError(null);
    try {
      const r = await api.installCreate({
        description: form.description.trim(), systemKw: kw, preferredDate: form.preferredDate,
        state: address.state, areaId: address.areaId, line: address.line.trim(),
      });
      navigate(`/app/installations/${r.request.ref}`);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'VALIDATION_ERROR') setErrors(err.details?.fields ?? {});
      else setError(err.message);
      setSaving(false);
    }
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="app-page">
      <header className="page-head"><h1>Installation</h1><p className="muted">Bought your equipment? Ask for a vetted installer. You see the price first, and only pay when you accept it.</p></header>
      {error && <p className="form-error" role="alert">{error}</p>}

      <form onSubmit={submit} noValidate className="profile-form install-form">
        <h2 className="dash-h3">Request an installer</h2>
        <label className="field">
          <span>What should be installed?</span>
          <textarea rows={4} maxLength={1000} value={form.description} onChange={set('description')} placeholder="e.g. 8 × 550 W panels, a 5 kVA inverter and two batteries on my roof" aria-invalid={Boolean(errors.description)} />
          {errors.description && <small className="err">{errors.description}</small>}
        </label>
        <label className="field">
          <span>System size (kW)</span>
          <input type="number" inputMode="decimal" min="0.1" step="0.1" value={form.systemKw} onChange={set('systemKw')} aria-invalid={Boolean(errors.systemKw)} />
          {errors.systemKw ? <small className="err">{errors.systemKw}</small> : <small>The total panel or inverter size, whichever is larger. {band ? <>That is the <strong>{band.label}</strong> band: <strong>{naira(band.price)}</strong>.</> : null}</small>}
        </label>
        <label className="field">
          <span>Date you want it done</span>
          <input type="date" min={isoDay(0)} value={form.preferredDate} onChange={set('preferredDate')} aria-invalid={Boolean(errors.preferredDate)} />
          {errors.preferredDate && <small className="err">{errors.preferredDate}</small>}
        </label>
        <AddressFields value={address} onChange={setAddress} errors={errors} legend="Where is the installation?" />
        <p className="muted small-note">The installer only sees your street address after they accept the job.</p>
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Getting your quote…' : 'Get my quote'}</button>
      </form>

      {bands.length > 0 && (
        <details className="install-bands">
          <summary>See the price list</summary>
          <table className="bands-table"><tbody>{bands.map((b) => <tr key={b.id}><td>{b.label}</td><td>{naira(b.price)}</td></tr>)}</tbody></table>
        </details>
      )}

      <h2 className="dash-h3">Your requests</h2>
      {!list && !error && <p className="muted" role="status">Loading…</p>}
      {list?.length === 0 && <p className="muted">No requests yet.</p>}
      <ul className="order-list">
        {list?.filter((r) => r.status !== 'quote' || true).map((r) => (
          <li key={r.ref}>
            <Link to={`/app/installations/${r.ref}`} className="order-row">
              <span><strong>{r.ref}</strong><small>{formatDate(r.createdAt)} · {r.systemKw} kW</small></span>
              <span>{INSTALL_STATUS[r.status]}</span>
              <span className="order-total">{naira(r.price)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
