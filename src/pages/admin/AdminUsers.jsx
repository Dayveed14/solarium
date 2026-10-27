import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useGeo } from '../../components/AddressFields.jsx';
import { formatDate } from '../../lib/format.js';

const ROLES = [['', 'All'], ['individual', 'Individuals'], ['business', 'Businesses'], ['vendor', 'Vendors'], ['installer', 'Installers'], ['admin', 'Admins']];
const ROLE_NAME = { individual: 'Individual', business: 'Business', vendor: 'Vendor', installer: 'Installer', admin: 'Admin' };
const STAT_LABEL = { orders: 'Orders', installations: 'Installation requests', products: 'Products', jobsTaken: 'Jobs taken', jobsCompleted: 'Jobs completed' };
const fileSize = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

function Detail({ id }) {
  const { geo } = useGeo();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => { api.adminUser(id).then(setData).catch((e) => setErr(e.message)); }, [id]);
  if (err) return <p className="form-error" role="alert">{err}</p>;
  if (!data) return <p className="muted" role="status">Loading…</p>;
  const { user: u, documents } = data;
  const st = geo?.states.find((s) => s.id === u.address?.state);
  const area = st?.areas.find((a) => a.id === u.address?.areaId);
  const rows = [
    ['Email', `${u.email}${u.emailVerified ? '' : ' (not verified)'}`],
    ['Phone', u.phone || 'Not given'],
    ['Joined', formatDate(u.createdAt)],
    ['Address', u.address ? [u.address.line, area?.name, st?.name].filter(Boolean).join(', ') : 'Not given'],
    ...(u.vendorType ? [['Vendor type', u.vendorType === 'company' ? 'Company' : 'Seller']] : []),
    ...(u.verification ? [['Verification', u.verification + (u.verificationNote ? ` (note: ${u.verificationNote})` : '')]] : []),
    ...(u.role === 'installer' ? [['Quiz', u.quizSubmittedAt ? `submitted ${formatDate(u.quizSubmittedAt)}` : 'not taken']] : []),
    ...Object.entries(u.stats ?? {}).map(([k, v]) => [STAT_LABEL[k] ?? k, String(v)]),
  ];
  return (
    <div className="user-detail">
      <dl className="detail-grid">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      <h4>Documents uploaded</h4>
      {documents.length === 0 ? <p className="muted">None.</p> : (
        <ul className="doc-list">
          {documents.map((d) => (
            <li key={d.id}>
              <span>{d.label || d.kind} <small className="muted">· {d.kind} · {fileSize(d.bytes)} · {formatDate(d.createdAt)}</small></span>
              <a className="btn btn-ghost btn-small" href={`/api/admin/documents/${d.id}/file`} target="_blank" rel="noopener noreferrer">Open</a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AdminUsers() {
  const { user: me } = useAuth();
  const [role, setRole] = useState('');
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const [users, setUsers] = useState(null);
  const [error, setError] = useState(null);
  const [openId, setOpenId] = useState(null);

  const load = () => api.adminUsers({ role, q: term }).then((r) => setUsers(r.users)).catch((e) => setError(e.message));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, term]);

  const toggle = async (u) => {
    setError(null);
    try {
      await api.adminUserStatus(u.id, u.status === 'active' ? 'suspended' : 'active');
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <>
      <div className="section-head">
        <div>
          <h2 className="dash-h2">Users</h2>
          <p className="muted">Suspending an account logs the person out at once and blocks them from logging in.</p>
        </div>
      </div>
      <form className="admin-search" onSubmit={(e) => { e.preventDefault(); setTerm(q.trim()); }}>
        <input type="search" placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search users" />
        <button type="submit" className="btn btn-quiet">Search</button>
      </form>
      <div className="tabs" role="tablist" aria-label="Filter by account type">
        {ROLES.map(([value, label]) => (
          <button key={label} type="button" role="tab" aria-selected={role === value} className={role === value ? 'is-active' : ''} onClick={() => setRole(value)}>{label}</button>
        ))}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {!users && !error && <p className="muted" role="status">Loading…</p>}
      {users?.length === 0 && <div className="empty-card"><h3>No matches</h3><p>No users found.</p></div>}
      <ul className="request-list">
        {(users ?? []).map((u) => (
          <li key={u.id} className="request-card">
            <div className="deal-top">
              <h3>{u.companyName || u.fullName}</h3>
              <span className={`badge badge-${u.status === 'active' ? 'active' : 'rejected'}`}>{u.status === 'active' ? 'Active' : 'Suspended'}</span>
            </div>
            <p className="muted">
              {u.companyName ? `${u.fullName} · ` : ''}{u.email} · {ROLE_NAME[u.role]}{u.vendorType ? ` (${u.vendorType})` : ''}{u.emailVerified ? '' : ' · email not verified'}
              {u.phone ? ` · ${u.phone}` : ''} · joined {formatDate(u.createdAt)}
              {u.verification ? ` · ${u.verification}` : ''}{u.documentCount ? ` · ${u.documentCount} document${u.documentCount === 1 ? '' : 's'}` : ''}
            </p>
            <div className="row-actions">
              <button type="button" className="btn btn-ghost btn-small" aria-expanded={openId === u.id} onClick={() => setOpenId(openId === u.id ? null : u.id)}>{openId === u.id ? 'Hide details' : 'View details'}</button>
              {u.role !== 'admin' && u.id !== me.id && (
                <button type="button" className="btn btn-quiet" onClick={() => toggle(u)}>{u.status === 'active' ? 'Suspend' : 'Reactivate'}</button>
              )}
            </div>
            {openId === u.id && <Detail id={u.id} />}
          </li>
        ))}
      </ul>
    </>
  );
}
