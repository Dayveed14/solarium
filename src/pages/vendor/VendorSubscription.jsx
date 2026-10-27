import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { formatDate, naira } from '../../lib/format.js';

const STATE_TEXT = {
  not_required: 'No subscription is due for your account type right now.',
  never: 'You have not subscribed yet. Subscribe to show your products and deals to customers.',
  active: 'Your subscription is active.',
  grace: 'Your subscription has run out. Your listings stay visible for a short grace period. Renew now to avoid losing them.',
  lapsed: 'Your subscription has ended. Your products and deals are hidden from customers until you renew. Nothing was deleted.',
};
const TONE = { active: 'good', not_required: 'good', grace: 'warn', never: 'warn', lapsed: 'bad' };

export default function VendorSubscription() {
  const [s, setS] = useState(null);
  const [months, setMonths] = useState(1);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.vendorSubscription().then(setS).catch((e) => setError(e.message)); }, []);

  const pay = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.vendorSubscriptionStart(months);
      window.location.assign(r.authorizationUrl);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  if (error && !s) return <p className="form-error" role="alert">{error}</p>;
  if (!s) return <p className="muted" role="status">Loading…</p>;
  const chosen = s.options.find((o) => o.months === months);
  return (
    <section className="sub-page">
      <div className="section-head"><div><h2 className="dash-h2">Monthly subscription</h2>
        <p className="muted">Sellers and companies pay a monthly subscription to stay listed. We also take a small share of each sale, and of each Energy-as-a-Service plan. The share is shown on every order.</p></div></div>

      <div className={`sub-status sub-${TONE[s.state]}`} role="status">
        <p><strong>{s.required ? `${naira(s.monthlyPrice)} a month` : 'No subscription'}</strong>{s.vendorType === 'company' ? ' · Company' : ' · Seller'}</p>
        <p>{STATE_TEXT[s.state]}</p>
        {s.paidUntil && s.required && <p>Paid up to <strong>{formatDate(s.paidUntil)}</strong>{s.state === 'active' && s.daysLeft != null ? ` (${s.daysLeft} day${s.daysLeft === 1 ? '' : 's'} left)` : ''}.{(s.state === 'grace') && s.graceEnds ? ` Listings are hidden after ${formatDate(s.graceEnds)}.` : ''}</p>}
      </div>

      {s.required && !s.verified && <p className="muted">You can subscribe once the admin has verified your account.</p>}
      {s.required && s.verified && (
        <div className="sub-pay">
          <h3>{s.state === 'active' ? 'Pay ahead' : 'Renew'}</h3>
          <div className="lease-chips" role="group" aria-label="How many months to pay for">
            {s.options.map((o) => <button key={o.months} type="button" className={`chip${months === o.months ? ' on' : ''}`} aria-pressed={months === o.months} onClick={() => setMonths(o.months)}>{o.months} month{o.months === 1 ? '' : 's'}</button>)}
          </div>
          <p className="deal-sub">Each month adds 30 days. Paying early adds to the date you are already paid up to.</p>
          <button type="button" className="btn btn-primary" onClick={pay} disabled={busy}>{busy ? 'Opening payment…' : `Pay ${naira(chosen.amount)}`}</button>
          {error && <p className="form-error" role="alert">{error}</p>}
        </div>
      )}

      {s.history.length > 0 && (
        <>
          <h3>Payments</h3>
          <ul className="doc-list">{s.history.map((h) => <li key={h.id}><span>{formatDate(h.paidAt)} · {h.months} month{h.months === 1 ? '' : 's'}</span><strong>{naira(h.amount)}</strong></li>)}</ul>
        </>
      )}
    </section>
  );
}
