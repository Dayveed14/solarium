import { useEffect, useState } from 'react';
import { ApiError, api } from '../../api.js';
import { formatDate } from '../../lib/format.js';

const intl = (v) => { const t = v.replace(/[\s-]/g, ''); return t.startsWith('+') ? t : t.startsWith('0') ? `+234${t.slice(1)}` : t; };

// Field agents are created here. They get an email with a link to choose their own password; nobody can sign up as one.
export default function AdminAgents() {
  const [list, setList] = useState(null);
  const [form, setForm] = useState({ fullName: '', email: '', phone: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [ok, setOk] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = () => api.adminAgents().then((r) => setList(r.agents)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErrors({}); setError(null); setOk(null);
    try {
      const r = await api.adminAgentCreate({ fullName: form.fullName.trim(), email: form.email.trim(), phone: form.phone.trim() ? intl(form.phone) : undefined });
      setOk(`${r.agent.fullName} was added. We emailed ${r.agent.email} a link to choose a password (valid for three days).`);
      setForm({ fullName: '', email: '', phone: '' });
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'VALIDATION_ERROR') setErrors(err.details?.fields ?? {}); else setError(err.message);
    }
    setBusy(false);
  };

  return (
    <>
      <div className="section-head"><div><h2 className="dash-h2">Field agents</h2><p className="muted">People who visit businesses and run the energy audits. To stop an agent, suspend their account under Users.</p></div></div>
      <form onSubmit={submit} noValidate className="profile-form">
        <h3 className="dash-h3">Add an agent</h3>
        <label className="field"><span>Full name</span><input type="text" value={form.fullName} onChange={set('fullName')} aria-invalid={Boolean(errors.fullName)} />{errors.fullName && <small className="err">{errors.fullName}</small>}</label>
        <label className="field"><span>Email</span><input type="email" value={form.email} onChange={set('email')} aria-invalid={Boolean(errors.email)} />{errors.email && <small className="err">{errors.email}</small>}<small>Use an email that has no TerraVoltix account yet.</small></label>
        <label className="field"><span>Phone <em>(optional)</em></span><input type="tel" value={form.phone} onChange={set('phone')} aria-invalid={Boolean(errors.phone)} />{errors.phone && <small className="err">{errors.phone}</small>}<small>Shown to a business once the agent is assigned.</small></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        {ok && <p className="form-success" role="status">{ok}</p>}
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Adding…' : 'Add field agent'}</button>
      </form>

      <h3 className="dash-h3">Your agents</h3>
      {!list && !error && <p className="muted" role="status">Loading…</p>}
      {list && list.length === 0 && <p className="muted">No agents yet.</p>}
      {list && list.length > 0 && (
        <div className="table-scroll"><table className="data-table">
          <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Open jobs</th><th>Added</th><th>Status</th></tr></thead>
          <tbody>{list.map((g) => <tr key={g.id}><td>{g.fullName}</td><td>{g.email}</td><td>{g.phone ?? '–'}</td><td>{g.openJobs}</td><td>{formatDate(g.createdAt)}</td><td>{g.active ? 'Active' : 'Suspended'}</td></tr>)}</tbody>
        </table></div>
      )}
    </>
  );
}
