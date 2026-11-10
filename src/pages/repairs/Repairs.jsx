import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import { formatDate, naira } from '../../lib/format.js';
import { REPAIR_STATUS, statusTone } from './shared.jsx';

// A customer's repair requests.
export default function Repairs() {
  const [list, setList] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { api.repairList().then((r) => setList(r.requests)).catch((e) => setError(e.message)); }, []);
  return (
    <div className="app-page">
      <header className="page-head">
        <div><h1>Repairs</h1><p className="muted">Something wrong with your solar system? Report the fault and a vetted technician will come, inspect it and tell you the cost before any repair work starts.</p></div>
        <Link to="/app/repairs/new" className="btn btn-primary">Report a fault</Link>
      </header>
      {error && <p className="form-error" role="alert">{error}</p>}
      {!list && !error && <p className="muted" role="status">Loading…</p>}
      {list?.length === 0 && <div className="empty-card"><h3>No repairs yet</h3><p>When you report a fault you will see every step here: technician assigned, visit, inspection and the cost.</p></div>}
      <ul className="request-list">
        {list?.map((r) => (
          <li key={r.ref} className="request-card">
            <div className="deal-top"><h3><Link to={`/app/repairs/${r.ref}`}>{r.fault}</Link></h3><span className={`badge badge-${statusTone(r.status)}`}>{REPAIR_STATUS[r.status]}</span></div>
            <p className="muted">{r.ref} · {formatDate(r.createdAt)} · call-out fee {naira(r.callOutFee)}</p>
            <p>{r.description}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
