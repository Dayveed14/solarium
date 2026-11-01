import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, api } from '../../api.js';
import Dialog from '../../components/Dialog.jsx';
import ImageField from '../../components/ImageField.jsx';
import { CATEGORY_LABEL, naira, sizeText } from '../../lib/format.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { fieldErrorsOf, groupDigits, parseNumber } from '../../lib/forms.js';

const money = (v) => (v == null ? '' : groupDigits(v));
let rowSeq = 0;
const newKey = () => `r${++rowSeq}`;
// One line of a deal: either one of the vendor's own products, or a new item they type in.
const rowsOf = (deal) => [
  ...(deal?.items ?? []).map((i) => ({ key: newKey(), kind: 'product', productId: String(i.productId), qty: String(i.qty), name: '', price: '' })),
  ...(deal?.extras ?? []).map((x) => ({ key: newKey(), kind: 'new', productId: '', qty: String(x.qty), name: x.name, price: money(x.unitPrice) })),
];

function initial(deal) {
  return {
    title: deal?.title ?? '',
    description: deal?.description ?? '',
    rows: rowsOf(deal),
    installationIncluded: deal?.installationIncluded ?? true,
    warrantyYears: deal?.warrantyYears == null ? '' : String(deal.warrantyYears),
    buyOn: deal ? deal.buyPrice != null : true,
    buyPrice: money(deal?.buyPrice),
    leaseOn: Boolean(deal?.leaseTerms),
    leaseDepositPct: String(deal?.leaseTerms ? Math.round(deal.leaseTerms.depositPct * 100) : 30),
    leaseTenors: deal?.leaseTerms?.tenors ?? [3, 6, 12],
    imageId: deal?.imageId ?? null,
    rentOn: deal ? deal.rentMonthly != null : false,
    rentMonthly: money(deal?.rentMonthly),
    eaasOn: Boolean(deal?.eaasTerms),
    eaasTenor: String(deal?.eaasTerms?.tenorMonths ?? '36'),
    eaasReturn: String(deal?.eaasTerms ? Math.round(deal.eaasTerms.annualReturn * 10000) / 100 : '24'),
    eaasCost: money(deal?.eaasTerms?.equipmentCost),
    eaasInstall: money(deal?.eaasTerms?.installationCost ?? 0),
    eaasInstallMode: deal?.eaasTerms?.installationMode ?? 'upfront',
    eaasOverage: money(deal?.eaasTerms?.overagePerKwh),
    publish: deal ? deal.status === 'active' : false,
  };
}

export default function DealForm({ deal, onClose, onSaved }) {
  const { user } = useAuth();
  const editing = Boolean(deal);
  const [products, setProducts] = useState(null);
  const [f, setF] = useState(() => initial(deal));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.vendorProducts().then((r) => setProducts(r.products)).catch((e) => setFormError(e.message));
  }, []);

  const byId = useMemo(() => new Map((products ?? []).map((p) => [String(p.id), p])), [products]);

  const set = (key) => (e) => setF((x) => ({ ...x, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const setMoney = (key) => (e) => setF((x) => ({ ...x, [key]: groupDigits(e.target.value) }));
  const err = (k) => errors[k] && <small className="err">{errors[k]}</small>;

  const addRow = (kind) => setF((x) => ({ ...x, rows: [...x.rows, { key: newKey(), kind, productId: '', qty: '1', name: '', price: '' }] }));
  const patchRow = (key, patch) => setF((x) => ({ ...x, rows: x.rows.map((r) => (r.key === key ? { ...r, ...patch } : r)) }));
  const dropRow = (key) => setF((x) => ({ ...x, rows: x.rows.filter((r) => r.key !== key) }));

  // Each line's price: a listed product uses its current price; a new item uses the price typed in.
  const lineOf = (r) => {
    const q = Math.max(0, Number.parseInt(r.qty, 10) || 0);
    if (r.kind === 'product') { const p = byId.get(r.productId); return { product: p, qty: q, unit: p?.price ?? 0, total: (p?.price ?? 0) * q }; }
    const unit = parseNumber(r.price) ?? 0;
    return { product: null, qty: q, unit, total: unit * q };
  };
  const lines = f.rows.map((r) => ({ r, ...lineOf(r) }));
  const itemsTotal = lines.reduce((sum, l) => sum + l.total, 0);

  // A full system (panel + inverter + battery) gets its size worked out; anything else is a bundle with no size.
  const core = (category) => lines.filter((l) => l.product?.category === category);
  const panel = core('panel')[0]?.product;
  const inverter = core('inverter')[0]?.product;
  const battery = core('battery')[0]?.product;
  const isSystem = Boolean(panel && inverter && battery);
  const specs = {
    kwp: core('panel').reduce((a, l) => a + (l.product.rating * l.qty) / 1000, 0),
    kva: core('inverter').reduce((a, l) => a + l.product.rating * l.qty, 0),
    kwh: core('battery').reduce((a, l) => a + l.product.rating * l.qty, 0),
  };
  const step = inverter && battery && battery.systemVoltage && inverter.systemVoltage % battery.systemVoltage === 0 ? inverter.systemVoltage / battery.systemVoltage : null;
  const voltageProblem = inverter && battery && !step;

  const eaasBody = () => ({
    tenorMonths: Number.parseInt(f.eaasTenor, 10) || 0,
    annualReturnPct: Number.parseFloat(f.eaasReturn) || 0,
    equipmentCost: parseNumber(f.eaasCost) ?? null,
    installationCost: parseNumber(f.eaasInstall) ?? 0,
    installationMode: f.eaasInstallMode,
    overagePerKwh: parseNumber(f.eaasOverage) ?? null,
  });

  const [rules, setRules] = useState(null);
  const [preview, setPreview] = useState(null);
  useEffect(() => {
    if (user.vendorType === 'company') api.vendorEaasRules().then(setRules).catch(() => {});
  }, []);

  // Live price check: the server works the monthly fee out from the terms, so the vendor sees what customers will see.
  const previewKey = JSON.stringify([f.eaasOn, f.eaasTenor, f.eaasReturn, f.eaasCost, f.eaasInstall, f.eaasInstallMode, JSON.stringify(f.rows)]);
  useEffect(() => {
    if (!f.eaasOn || !isSystem) { setPreview(null); return undefined; }
    const t = setTimeout(() => {
      api
        .vendorEaasPreview({
          items: lines.filter((l) => l.product && ['panel', 'inverter', 'battery'].includes(l.product.category)).map((l) => ({ productId: l.product.id, qty: l.qty })),
          eaas: eaasBody(),
        })
        .then((r) => setPreview({ ok: true, ...r }))
        .catch((e) => setPreview({ ok: false, message: e.message }));
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewKey]);

  const [leasePreview, setLeasePreview] = useState(null);
  const leaseKey = JSON.stringify([f.leaseOn, f.buyOn, f.buyPrice, f.leaseDepositPct, f.leaseTenors]);
  useEffect(() => {
    const buyPrice = parseNumber(f.buyPrice);
    const pct = Number.parseFloat(f.leaseDepositPct);
    if (!f.leaseOn || !f.buyOn || !buyPrice || !(pct > 0) || f.leaseTenors.length === 0) { setLeasePreview(null); return undefined; }
    let cancelled = false;
    const t = setTimeout(() => {
      api.vendorLeasePreview({ buyPrice, lease: { depositPct: pct, tenors: f.leaseTenors } }).then((r) => !cancelled && setLeasePreview(r.options)).catch(() => !cancelled && setLeasePreview(null));
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaseKey]);

  const submit = async (e) => {
    e.preventDefault();
    const num = (k) => parseNumber(f[k]);
    const body = {
      title: f.title.trim(),
      description: f.description.trim() || null,
      items: lines.filter((l) => l.product).map((l) => ({ productId: l.product.id, qty: l.qty })),
      extras: lines.filter((l) => !l.product && l.r.kind === 'new').map((l) => ({ name: l.r.name.trim(), qty: l.qty, unitPrice: l.unit })),
      installationIncluded: f.installationIncluded,
      warrantyYears: num('warrantyYears') ?? null,
      buyPrice: f.buyOn ? num('buyPrice') ?? null : null,
      lease: f.leaseOn ? { depositPct: Number.parseFloat(f.leaseDepositPct) || 0, tenors: f.leaseTenors } : null,
      imageId: f.imageId,
      rentMonthly: f.rentOn ? num('rentMonthly') ?? null : null,
      eaas: f.eaasOn ? eaasBody() : null,
      status: f.publish ? 'active' : editing && deal.status === 'paused' ? 'paused' : 'draft',
    };
    setSaving(true);
    setErrors({});
    setFormError(null);
    try {
      const res = editing ? await api.vendorUpdateDeal(deal.id, body) : await api.vendorCreateDeal(body);
      onSaved(res.deal);
    } catch (e2) {
      if (e2 instanceof ApiError && (e2.code === 'VALIDATION_ERROR' || e2.code === 'INVALID_DEAL')) {
        const fields = fieldErrorsOf(e2);
        setErrors(fields);
        if (!Object.keys(fields).length) setFormError(e2.message);
      } else setFormError(e2.message);
      setSaving(false);
    }
  };

  return (
    <Dialog
      title={editing ? 'Edit deal' : 'Build a combo or deal'}
      eyebrow="Combos & deals"
      wide
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-quiet" onClick={onClose}>Cancel</button>
          <button type="submit" form="deal-form" className="btn btn-primary" disabled={saving || !products}>
            {saving ? 'Saving…' : f.publish ? 'Save and publish' : 'Save draft'}
          </button>
        </>
      }
    >
      {!products && !formError && <p className="muted" role="status">Loading your products…</p>}

      {products && (
        <form id="deal-form" onSubmit={submit} noValidate>
          <label className="field">
            <span>Deal name</span>
            <input type="text" value={f.title} onChange={set('title')} aria-invalid={Boolean(errors.title)} placeholder="Home Starter 1.5kVA" />
            {err('title')}
          </label>

          <fieldset className="deal-parts">
            <legend className="field-legend">What&apos;s in it</legend>
            <p className="muted">Add anything you sell: items from your products, or new items you type in. The total is worked out for you.</p>
            <div className="deal-rows">
              {lines.map(({ r, product, qty, unit, total }) => (
                <div key={r.key} className={`deal-row${r.kind === 'new' ? ' deal-row-new' : ''}`}>
                  <span className="kind">{r.kind === 'product' ? 'From my products' : 'New item'}</span>
                  {r.kind === 'product' ? (
                    <label className="field">
                      <span className="sr-only">Product</span>
                      <select value={r.productId} onChange={(e) => patchRow(r.key, { productId: e.target.value })} aria-label="Product">
                        <option value="">Choose a product…</option>
                        {(products ?? []).map((p) => <option key={p.id} value={p.id}>{p.name} · {CATEGORY_LABEL[p.category] ?? p.category} · {naira(p.price)}</option>)}
                      </select>
                    </label>
                  ) : (
                    <label className="field">
                      <span className="sr-only">Item name</span>
                      <input type="text" value={r.name} maxLength={120} placeholder="Item name, e.g. Installation kit" onChange={(e) => patchRow(r.key, { name: e.target.value })} aria-label="Item name" />
                    </label>
                  )}
                  <label className="field">
                    <span className="sr-only">How many</span>
                    <input type="text" inputMode="numeric" value={r.qty} onChange={(e) => patchRow(r.key, { qty: e.target.value })} aria-label="How many" />
                  </label>
                  {r.kind === 'new' ? (
                    <label className="field">
                      <span className="sr-only">Price of one (₦)</span>
                      <input type="text" inputMode="numeric" value={r.price} placeholder="Price of one (₦)" onChange={(e) => patchRow(r.key, { price: groupDigits(e.target.value) })} aria-label="Price of one in naira" />
                    </label>
                  ) : <span className="muted">{product ? `${naira(unit)} each` : ''}</span>}
                  <button type="button" className="btn btn-quiet btn-small" onClick={() => dropRow(r.key)} aria-label="Remove this item">Remove</button>
                  <span className="row-total">{total ? naira(total) : ''}{qty > 1 && total ? <small className="muted"> ({qty} × {naira(unit)})</small> : null}</span>
                </div>
              ))}
            </div>
            <div className="deal-add">
              <button type="button" className="btn btn-ghost btn-small" onClick={() => addRow('product')} disabled={!products?.length}>+ From my products</button>
              <button type="button" className="btn btn-ghost btn-small" onClick={() => addRow('new')}>+ New item</button>
            </div>
            {!products?.length && <p className="muted">You have no listed products yet. Type new items, or <Link to="/app/products" onClick={onClose}>add products</Link> first.</p>}
            {err('items')}
            {voltageProblem && <small className="err">The battery ({battery.systemVoltage}V) can&apos;t run this inverter ({inverter.systemVoltage}V).</small>}
            {step > 1 && <small className="deal-hint">Your inverter is {inverter.systemVoltage}V and the battery is {battery.systemVoltage}V, so batteries must be in groups of {step}.</small>}
            <div className="deal-total" aria-live="polite">
              <span>Items total</span>
              <strong>{naira(itemsTotal)}</strong>
              {itemsTotal > 0 && f.buyOn && <button type="button" className="btn btn-quiet btn-small" onClick={() => setF((x) => ({ ...x, buyPrice: groupDigits(String(itemsTotal)) }))}>Use as buy price</button>}
            </div>
            {isSystem ? (
              <p className="deal-specs" aria-live="polite">
                <strong>This system:</strong> {specs.kwp.toFixed(2)} kWp solar · {specs.kva.toFixed(1)} kVA inverter · {specs.kwh.toFixed(1)} kWh battery
              </p>
            ) : (
              <p className="muted">Without a panel, inverter and battery this is a bundle: customers find it in the shop and in budget suggestions, not in system matches.</p>
            )}
          </fieldset>

          <fieldset className="deal-plans">
            <legend className="field-legend">How customers can get it, and your price</legend>
            <p className="muted">Turn on each way you&apos;re willing to offer this system. Customers only see the plans you set a price for.</p>

            <div className="plan-box">
              <label className="plan-toggle"><input type="checkbox" checked={f.buyOn} onChange={set('buyOn')} /> Buy outright</label>
              {f.buyOn && (
                <label className="field"><span>Total price (₦)</span>
                  <input type="text" inputMode="numeric" value={f.buyPrice} onChange={setMoney('buyPrice')} placeholder="1,250,000" aria-invalid={Boolean(errors.buyPrice)} />{err('buyPrice')}</label>
              )}
            </div>

            <div className="plan-box">
              <label className="plan-toggle"><input type="checkbox" checked={f.leaseOn} onChange={set('leaseOn')} /> Lease to own</label>
              {f.leaseOn && (
                <div className="lease-form">
                  <p className="muted">&quot;Pay small small&quot;: the customer pays a deposit, then spreads the rest over the months you allow and owns the system at the end. The price comes from your buy price.</p>
                  <label className="field"><span>Deposit (% of the buy price)</span>
                    <input type="text" inputMode="decimal" value={f.leaseDepositPct} onChange={set('leaseDepositPct')} aria-invalid={Boolean(errors['lease.depositPct'])} />
                    {errors['lease.depositPct'] ? err('lease.depositPct') : <small>Between 10 and 60.</small>}</label>
                  <fieldset className="tenor-pick">
                    <legend>Payment plans you offer</legend>
                    {[3, 4, 6, 12].map((m) => (
                      <label key={m} className="check-chip">
                        <input type="checkbox" checked={f.leaseTenors.includes(m)} onChange={() => setF((x) => ({ ...x, leaseTenors: x.leaseTenors.includes(m) ? x.leaseTenors.filter((t) => t !== m) : [...x.leaseTenors, m].sort((a, b) => a - b) }))} /> {m} months
                      </label>
                    ))}
                    {err('lease.tenors')}
                  </fieldset>
                  {!f.buyOn && <p className="form-error">Turn on &quot;Buy outright&quot; and set a price: lease is priced from it.</p>}
                  {leasePreview && (
                    <table className="lease-preview">
                      <thead><tr><th>Plan</th><th>Deposit</th><th>Monthly</th><th>Customer pays in total</th></tr></thead>
                      <tbody>{leasePreview.map((o) => <tr key={o.months}><td>{o.months} months</td><td>{naira(o.deposit)}</td><td>{naira(o.monthly)}</td><td>{naira(o.totalPayable)}</td></tr>)}</tbody>
                    </table>
                  )}
                </div>
              )}
            </div>

            <div className="plan-box">
              <label className="plan-toggle"><input type="checkbox" checked={f.rentOn} onChange={set('rentOn')} /> Rent</label>
              {f.rentOn && (
                <label className="field"><span>Monthly rent (₦)</span>
                  <input type="text" inputMode="numeric" value={f.rentMonthly} onChange={setMoney('rentMonthly')} aria-invalid={Boolean(errors.rentMonthly)} />{err('rentMonthly')}</label>
              )}
            </div>

            <div className="plan-box">
              {user.vendorType !== 'company' || !isSystem ? (
                <p className="muted">{user.vendorType !== 'company' ? <>Energy as a service is for registered companies. Register as a <strong>Company</strong> and upload your CAC to offer it.</> : 'Energy as a service needs a full system: add a panel, an inverter and a battery from your products.'}</p>
              ) : (
                <label className="plan-toggle"><input type="checkbox" checked={f.eaasOn} onChange={set('eaasOn')} /> Energy as a service</label>
              )}
              {f.eaasOn && user.vendorType === 'company' && isSystem && (
                <div className="eaas-form">
                  <p className="muted">
                    You don&apos;t type a monthly fee. It is worked out from your cost and the return you want, plus running costs, a risk allowance and Solariun&apos;s {rules ? Math.round(rules.platformFeePct * 100) : 6}% fee.
                  </p>
                  <div className="field-row">
                    <label className="field"><span>Contract length</span>
                      <select value={f.eaasTenor} onChange={set('eaasTenor')}>
                        {(rules?.tenorMonths.suggested ?? [24, 36, 48, 60]).map((m) => <option key={m} value={m}>{m} months</option>)}
                      </select>{err('eaas.tenorMonths')}</label>
                    <label className="field"><span>Your yearly return (%)</span>
                      <input type="text" inputMode="decimal" value={f.eaasReturn} onChange={set('eaasReturn')} aria-invalid={Boolean(errors['eaas.annualReturnPct'])} />
                      {rules && <small className="muted">Allowed: {Math.round(rules.annualReturn.min * 100)}% to {Math.round(rules.annualReturn.max * 100)}%</small>}
                      {err('eaas.annualReturnPct')}</label>
                  </div>
                  <div className="field-row">
                    <label className="field"><span>Your cost of this equipment (₦) <em>(optional)</em></span>
                      <input type="text" inputMode="numeric" value={f.eaasCost} onChange={setMoney('eaasCost')} placeholder="Uses your product prices if empty" />{err('eaas.equipmentCost')}</label>
                    <label className="field"><span>Installation cost (₦)</span>
                      <input type="text" inputMode="numeric" value={f.eaasInstall} onChange={setMoney('eaasInstall')} />{err('eaas.installationCost')}</label>
                  </div>
                  <div className="field-row">
                    <label className="field"><span>Who pays installation</span>
                      <select value={f.eaasInstallMode} onChange={set('eaasInstallMode')}>
                        <option value="upfront">Customer pays at installation (lowest monthly)</option>
                        <option value="rolled">Spread over the monthly payments</option>
                      </select></label>
                    <label className="field"><span>Price above fair use (₦/kWh) <em>(optional)</em></span>
                      <input type="text" inputMode="numeric" value={f.eaasOverage} onChange={setMoney('eaasOverage')} />{err('eaas.overagePerKwh')}</label>
                  </div>
                  {preview?.ok === false && <p className="form-error" role="alert">{preview.message}</p>}
                  {preview?.ok && (
                    <div className="eaas-preview" aria-live="polite">
                      {[['Home', preview.home], ['Business', preview.business]].map(([label, q]) => (
                        <div key={label}>
                          <strong>{label}: {naira(q.monthly)}/month</strong>
                          <small>
                            Capital {naira(q.breakdown.capital)} · running costs {naira(q.breakdown.operating.total)} · risk {naira(q.breakdown.risk)} · Solariun fee {naira(q.breakdown.platformFee)}
                          </small>
                        </div>
                      ))}
                      <small className="muted">
                        Customer pays {naira(preview.home.installation.payAtInstall)} at installation and a refundable deposit of {naira(preview.home.deposit)}.
                      </small>
                    </div>
                  )}
                </div>
              )}
            </div>
            {err('plans')}
          </fieldset>

          <div className="field-row">
            <label className="field">
              <span>Warranty (years) <em>(optional)</em></span>
              <input type="text" inputMode="numeric" value={f.warrantyYears} onChange={set('warrantyYears')} />
            </label>
            <div className="field check-field">
              <label><input type="checkbox" checked={f.installationIncluded} onChange={set('installationIncluded')} /> Installation included</label>
            </div>
          </div>

          <label className="field">
            <span>Description <em>(optional)</em></span>
            <textarea rows={3} value={f.description} onChange={set('description')} maxLength={600} placeholder="What it can power, what's covered, delivery areas…" />
            {err('description')}
          </label>

          <ImageField label="Deal picture" imageId={f.imageId} imageUrl={deal?.imageUrl} onChange={(id) => setF((x) => ({ ...x, imageId: id }))} />

          <div className="check-row">
            <label><input type="checkbox" checked={f.publish} onChange={set('publish')} /> Publish now (customers can see this deal)</label>
          </div>

          {formError && <p className="form-error" role="alert">{formError}</p>}
          {(deal?.items ?? []).some((i) => i.productStatus === 'archived') && (
            <p className="form-error" role="alert">This deal uses a product you removed. Remove it above or choose a replacement.</p>
          )}
        </form>
      )}
      {formError && !products && <p className="form-error" role="alert">{formError}</p>}
    </Dialog>
  );
}
