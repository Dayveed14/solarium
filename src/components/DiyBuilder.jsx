import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { Link } from 'react-router-dom';
import { naira, sizeText } from '../lib/format.js';
import RequestBox from './RequestBox.jsx';

function Stepper({ value, min, max, step = 1, onChange, label }) {
  const dec = () => onChange(Math.max(min, value - step));
  const inc = () => onChange(Math.min(max, value + step));
  return (
    <div className="qty" role="group" aria-label={label}>
      <button type="button" onClick={dec} disabled={value <= min} aria-label={`Fewer ${label}`}>−</button>
      <output aria-live="polite">{value}</output>
      <button type="button" onClick={inc} disabled={value >= max} aria-label={`More ${label}`}>+</button>
    </div>
  );
}

function Part({ name, product, selected, disabled, note, onSelect }) {
  return (
    <label className={`part${selected ? ' on' : ''}${disabled ? ' disabled' : ''}`}>
      <input type="radio" name={name} checked={selected} disabled={disabled} onChange={onSelect} />
      <span className="part-name">{product.name}</span>
      <span className="part-meta">{[product.brand, sizeText(product)].filter(Boolean).join(' · ')}</span>
      <span className="part-vendor">{product.vendor.name}{product.vendor.verified ? ' · Verified' : ''}</span>
      <span className="part-price">{naira(product.price)} <small>each</small></span>
      {note && <span className="part-note">{note}</span>}
    </label>
  );
}

const rangeText = (r) => (r.min === r.max ? `${r.min}` : `${r.min} to ${r.max}`);

export default function DiyBuilder({ assessmentId, diy, limits, user, extras = [], allInOne = null }) {
  const needsBattery = limits.battery.maxKwh > 0;
  const [sel, setSel] = useState({ panelId: null, panelQty: 1, inverterId: null, batteryId: null, batteryQty: 1 });
  const [extraSel, setExtraSel] = useState({}); // category -> { id, qty }
  const [quote, setQuote] = useState(null);
  const [quoteError, setQuoteError] = useState(null);

  const panel = diy.panels.find((p) => p.id === sel.panelId) ?? null;
  const inverter = diy.inverters.find((p) => p.id === sel.inverterId) ?? null;
  const battery = diy.batteries.find((p) => p.id === sel.batteryId) ?? null;
  const batteryRange = battery && inverter ? battery.qtyByVoltage[inverter.systemVoltage] : null;

  const choosePanel = (p) => setSel((s) => ({ ...s, panelId: p.id, panelQty: p.qty.min }));
  const chooseInverter = (inv) =>
    setSel((s) => {
      const b = diy.batteries.find((x) => x.id === s.batteryId);
      const range = b ? b.qtyByVoltage[inv.systemVoltage] : null;
      // A battery that no longer suits the new inverter is cleared rather than silently kept.
      return range ? { ...s, inverterId: inv.id, batteryQty: range.min } : { ...s, inverterId: inv.id, batteryId: null, batteryQty: 1 };
    });
  const chooseBattery = (b) => {
    const range = b.qtyByVoltage[inverter.systemVoltage];
    setSel((s) => ({ ...s, batteryId: b.id, batteryQty: range.min }));
  };

  const ready = Boolean(panel && inverter && (battery || !needsBattery));
  const items = useMemo(
    () => (ready ? [
      { productId: panel.id, qty: sel.panelQty },
      { productId: inverter.id, qty: 1 },
      ...(battery ? [{ productId: battery.id, qty: sel.batteryQty }] : []),
      ...Object.values(extraSel).filter((x) => x?.id).map((x) => ({ productId: x.id, qty: x.qty })),
    ] : []),
    [ready, panel, inverter, battery, sel.panelQty, sel.batteryQty, extraSel]
  );

  // Ask the server to price and check the selection. It is the one that decides if it is valid.
  useEffect(() => {
    if (!ready) {
      setQuote(null);
      return undefined;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      api
        .diyQuote(assessmentId, items)
        .then((q) => !cancelled && (setQuote(q), setQuoteError(null)))
        .catch((e) => !cancelled && setQuoteError(e.message));
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [ready, items, assessmentId]);

  // A charge controller is only offered when the chosen inverter has none built in.
  const shownExtras = extras.filter((g) => g.category !== 'controller' || (inverter && inverter.includesController === false));
  const pickExtra = (category, product) => setExtraSel((e) => ({ ...e, [category]: product ? { id: product.id, qty: e[category]?.qty ?? 1 } : null }));
  const extraQty = (category, qty) => setExtraSel((e) => (e[category] ? { ...e, [category]: { ...e[category], qty } } : e));
  const labelOf = (category) => extras.find((g) => g.category === category)?.label ?? category;

  const none = (label) => <p className="muted part-empty">No vendor has a {label} in the right size yet.</p>;

  return (
    <div className="diy">
      <div className="diy-steps">
        <fieldset className="diy-step">
          <legend>1. Solar panels</legend>
          {diy.panels.length === 0 ? none('solar panel') : (
            <div className="part-grid">
              {diy.panels.map((p) => (
                <Part key={p.id} name="panel" product={p} selected={sel.panelId === p.id} onSelect={() => choosePanel(p)}
                  note={`Choose ${rangeText(p.qty)} ${p.qty.max === 1 ? 'panel' : 'panels'}`} />
              ))}
            </div>
          )}
          {panel && panel.qty.max > panel.qty.min && (
            <div className="diy-qty"><span>How many</span><Stepper label="panels" value={sel.panelQty} min={panel.qty.min} max={panel.qty.max} onChange={(v) => setSel((s) => ({ ...s, panelQty: v }))} /></div>
          )}
        </fieldset>

        <fieldset className="diy-step">
          <legend>2. Inverter</legend>
          {diy.inverters.length === 0 ? none('inverter') : (
            <div className="part-grid">
              {diy.inverters.map((p) => <Part key={p.id} name="inverter" product={p} selected={sel.inverterId === p.id} onSelect={() => chooseInverter(p)} />)}
            </div>
          )}
        </fieldset>

        {needsBattery && (
          <fieldset className="diy-step">
            <legend>3. Battery</legend>
            {!inverter ? (
              <p className="muted part-empty">Pick an inverter first so we only show batteries that work with it.</p>
            ) : diy.batteries.length === 0 ? none('battery') : (
              <div className="part-grid">
                {diy.batteries.map((b) => {
                  const range = b.qtyByVoltage[inverter.systemVoltage];
                  return (
                    <Part key={b.id} name="battery" product={b} selected={sel.batteryId === b.id} disabled={!range} onSelect={() => chooseBattery(b)}
                      note={range ? `Choose ${rangeText(range)}${range.step > 1 ? `, in groups of ${range.step}` : ''}` : `Doesn't suit a ${inverter.systemVoltage}V inverter`} />
                  );
                })}
              </div>
            )}
            {battery && batteryRange && batteryRange.max > batteryRange.min && (
              <div className="diy-qty"><span>How many</span>
                <Stepper label="batteries" value={sel.batteryQty} min={batteryRange.min} max={batteryRange.max} step={batteryRange.step} onChange={(v) => setSel((s) => ({ ...s, batteryQty: v }))} />
              </div>
            )}
          </fieldset>
        )}

        {shownExtras.length > 0 && (
          <fieldset className="diy-step">
            <legend>{needsBattery ? '4' : '3'}. Complete your system</legend>
            <p className="muted">Panels, an inverter and a battery are not enough on their own. These parts make it safe and working. Add what you do not already have.</p>
            {shownExtras.map((g) => {
              const chosen = extraSel[g.category];
              return (
                <div key={g.category} className="extra-group">
                  <p className="extra-title"><strong>{g.label}</strong> <small>{g.why}</small></p>
                  {g.products.length === 0 ? <p className="muted part-empty">No vendor has listed this yet.</p> : (
                    <div className="part-grid">
                      <label className={`part${!chosen ? ' on' : ''}`}>
                        <input type="radio" name={`extra-${g.category}`} checked={!chosen} onChange={() => pickExtra(g.category, null)} />
                        <span className="part-name">Not now</span>
                        <span className="part-meta">I have it or will arrange it</span>
                      </label>
                      {g.products.map((p) => <Part key={p.id} name={`extra-${g.category}`} product={p} selected={chosen?.id === p.id} onSelect={() => pickExtra(g.category, p)} />)}
                    </div>
                  )}
                  {chosen && (
                    <div className="diy-qty"><span>How many</span><Stepper label={`${g.label} items`} value={chosen.qty} min={1} max={99} onChange={(v) => extraQty(g.category, v)} /></div>
                  )}
                </div>
              );
            })}
          </fieldset>
        )}
      </div>

      <aside className="diy-summary" aria-live="polite">
        <h3>Your system</h3>
        {!ready && <p className="muted">Choose each part to see the price.</p>}
        {quoteError && <p className="form-error" role="alert">{quoteError}</p>}
        {ready && quote && (
          <>
            <ul className="diy-lines">
              {quote.lines.map((l) => (
                <li key={l.productId}>
                  <span>{l.qty} × {l.name}<small>{l.vendorName}</small></span>
                  <strong>{naira(l.lineTotal)}</strong>
                </li>
              ))}
            </ul>
            <p className="diy-total"><span>Parts total</span><strong>{naira(quote.subtotal)}</strong></p>
            <p className="deal-sub">{quote.totals.kwp} kWp · {quote.totals.kva} kVA · {quote.totals.kwh} kWh. Installation and delivery are agreed with the vendor and aren&apos;t included.</p>
            {quote.extrasMissing?.length > 0 && (
              <div className="diy-missing" role="note">
                <strong>Still needed for a working system:</strong>
                <ul>{quote.extrasMissing.map((c) => <li key={c}>{labelOf(c)}</li>)}</ul>
                <small>Add them above, or confirm with the vendor or installer that you have them.</small>
              </div>
            )}
            {quote.errors.map((e) => <p key={e.code} className="form-error" role="alert">{e.message}</p>)}
            {quote.valid && (
              <>
                {quote.vendors.length > 1 && (
                  <p className="deal-sub">These parts come from {quote.vendors.length} vendors, so each one will get a request for their own parts.</p>
                )}
                <RequestBox
                  key={items.map((i) => `${i.productId}x${i.qty}`).join(',')}
                  user={user}
                  vendorName={quote.vendors.map((v) => v.vendorName).join(' and ')}
                  label="Request these parts"
                  onSend={(message) => api.sendRequest(assessmentId, { kind: 'diy', items, message })}
                />
              </>
            )}
          </>
        )}
      </aside>
    </div>
  );
}

function AioCard({ unit, kind }) {
  return (
    <li className="aio-card">
      <p className="part-name"><Link to={`/shop/product/${unit.id}`}>{unit.name}</Link></p>
      <p className="part-meta">{[unit.brand, sizeText(unit)].filter(Boolean).join(' · ')}</p>
      <p className="part-vendor">{unit.vendor.name}{unit.vendor.verified ? ' · Verified' : ''}</p>
      <p className="part-price">{naira(unit.price)}</p>
      <p className={unit.fit === 'full' ? 'aio-fit aio-full' : 'aio-fit aio-partial'}>
        {unit.fit === 'full' ? `Covers all of what you use (${kind === 'kit' ? 'solar kit' : 'portable'})` : `Covers about ${unit.coveragePct}% of what you use`}
      </p>
    </li>
  );
}

// Ready-made units: solar kits and portable power stations. Simple, but limited by their own output.
export function AllInOne({ allInOne }) {
  if (!allInOne || (allInOne.kits.length === 0 && allInOne.portable.length === 0)) return null;
  return (
    <section aria-labelledby="aio-h" className="offer-section">
      <h2 id="aio-h">All-in-one options</h2>
      <p className="muted">
        Kits and portable power stations come complete, with no separate parts to buy. Check the unit can supply your biggest appliance
        at once (your peak need is about {allInOne.peakKva} kVA) and cannot grow later like a full system.
      </p>
      {allInOne.kits.length > 0 && <><h3>Solar kits</h3><ul className="aio-list">{allInOne.kits.map((u) => <AioCard key={u.id} unit={u} kind="kit" />)}</ul></>}
      {allInOne.portable.length > 0 && <><h3>Portable power stations</h3><ul className="aio-list">{allInOne.portable.map((u) => <AioCard key={u.id} unit={u} kind="portable" />)}</ul></>}
    </section>
  );
}
