import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { formatDate, naira } from '../../lib/format.js';

const STATE = { not_required: 'Not required', never: 'Never paid', active: 'Active', grace: 'Grace period', lapsed: 'Lapsed' };
const TABS = [['', 'All'], ['active', 'Active'], ['grace', 'Grace'], ['lapsed', 'Lapsed'], ['never', 'Never paid']];

export default function AdminSubscriptions() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('');
  const [days, setDays] = useState(30);
  const [note, setNote] = useState(null);
  const load = () => api.adminSubscriptions().then(setData).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const run = async (fn, okText) => {
    setError(null); setNote(null);
    try { await fn(); setNote(okText); load(); } catch (e) { setError(e.message); }
  };
  const d = Math.max(1, Math.min(366, Number(days) || 0));
  const rows = (data?.vendors ?? []).filter((v) => v.verification === 'verified' && (!tab || v.state === tab));

  return (
    <>
      <div className="section-head"><div>
        <h2 className="dash-h2">Vendor subscriptions</h2>
        <p className="muted">
          Seller price: <strong>{data ? (data.prices.seller ? `${naira(data.prices.seller)}/month` : 'off') : '…'}</strong> · Company price: <strong>{data ? (data.prices.company ? `${naira(data.prices.company)}/month` : 'off') : '…'}</strong> · Grace: {data?.prices.graceDays ?? '…'} days.
          Change these in Pricing &amp; rules &gt; Solalium fees. A price of 0 turns the subscription off for that type.
        </p>
      </div></div>

      <div className="admin-search">
        <label className="field-inline"><span>Free days</span> <input type="number" min="1" max="366" value={days} onChange={(e) => setDays(e.target.value)} aria-label="Free days to give" /></label>
        <button type="button" className="btn btn-quiet" onClick={() => run(() => api.adminSubscriptionGrantAll(d), 'Gave every unpaid verified vendor free days.')}>Give all unpaid vendors these days</button>
      </div>
      <p className="muted">Use this when you switch the subscription on, so current vendors have time to start paying. Vendors already paid up beyond that are not changed.</p>

      <div className="tabs" role="tablist" aria-label="Subscription state">
        {TABS.map(([v, l]) => <button key={l} type="button" role="tab" aria-selected={tab === v} className={tab === v ? 'is-active' : ''} onClick={() => setTab(v)}>{l}</button>)}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {note && <p className="form-ok" role="status">{note}</p>}
      {!data && !error && <p className="muted" role="status">Loading…</p>}
      {data && rows.length === 0 && <div className="empty-card"><h3>None here</h3><p>No verified vendors in this state.</p></div>}
      <ul className="request-list">
        {rows.map((v) => (
          <li key={v.vendorId} className="request-card">
            <div className="deal-top"><h3>{v.companyName}</h3><span className={`badge badge-${v.state === 'active' || v.state === 'not_required' ? 'active' : v.state === 'grace' ? 'pending' : 'rejected'}`}>{STATE[v.state]}</span></div>
            <p className="muted">
              {v.vendorType === 'company' ? 'Company' : 'Seller'} · {v.email}
              {v.paidUntil ? ` · paid up to ${formatDate(v.paidUntil)}` : ''}{v.lastPaidAt ? ` · last paid ${formatDate(v.lastPaidAt)}` : ''}
            </p>
            <div className="row-actions"><button type="button" className="btn btn-ghost btn-small" onClick={() => run(() => api.adminSubscriptionGrant(v.vendorId, d), `Gave ${v.companyName} ${d} free days.`)}>Give {d} free days</button></div>
          </li>
        ))}
      </ul>
    </>
  );
}
