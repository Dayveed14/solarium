import { useState } from 'react';
import { ApiError, api } from '../../api.js';
import Dialog from '../../components/Dialog.jsx';
import ImageField from '../../components/ImageField.jsx';
import { CATEGORY_GROUPS, CATEGORY_SPECS, PRODUCT_CATEGORIES } from '../../lib/productCategories.js';
import { fieldErrorsOf, groupDigits, parseNumber } from '../../lib/forms.js';

// Example text for the size box and the name box, per type. Anything not listed gets a general hint.
const EXAMPLES = {
  panel: { rating: '550', name: 'Mono PERC 550W', hint: 'For example 550' },
  inverter: { rating: '1.5', name: 'Hybrid inverter 1.5kVA', hint: 'For example 1.5 or 5' },
  battery: { rating: '2.4', name: 'Lithium battery 12V 200Ah', hint: 'For example 2.4 for a 12V 200Ah battery' },
  controller: { rating: '60', name: 'MPPT charge controller 60A', hint: 'For example 30, 60 or 100' },
  portable_power: { rating: '1.2', name: 'Portable power station 1.2kWh', hint: 'For example 1.2' },
  generator: { rating: '5', name: 'Inverter generator 5kVA', hint: 'For example 5' },
  transfer_switch: { rating: '63', name: 'Automatic transfer switch 63A', hint: 'For example 63' },
  protection: { rating: '32', name: 'DC breaker 32A', hint: 'For example 32' },
  pump: { rating: '750', name: 'Solar borehole pump 750W', hint: 'For example 750' },
  streetlight: { rating: '60', name: 'All-in-one solar streetlight 60W', hint: 'For example 60' },
  lighting: { rating: '100', name: 'Solar floodlight 100W', hint: 'For example 100' },
  kit: { rating: '1.5', name: 'Home solar kit 1.5kWp', hint: 'Total panel power, for example 1.5' },
  mounting: { name: 'Roof mounting rails (set of 4)' },
  cable: { name: 'Solar cable 6mm, 100m roll' },
  connector: { name: 'MC4 connector pair' },
  distribution: { name: 'PV combiner box, 2 strings' },
  surge_protection: { name: 'DC surge protection device' },
  earthing: { name: 'Earthing rod kit' },
  meter: { name: 'Bi-directional energy meter' },
  monitoring: { name: 'Wi-Fi monitoring dongle' },
  energy_management: { name: 'Smart energy controller' },
  accessory: { name: 'Panel cleaning kit' },
};

const blank = { category: 'panel', name: '', brand: '', rating: '', systemVoltage: '12', batteryType: 'lithium', price: '', warrantyYears: '', description: '', inStock: true, includesController: true, listed: true, imageId: null };

const fromProduct = (p) => ({
  category: p.category,
  name: p.name,
  brand: p.brand ?? '',
  rating: p.rating > 0 ? String(p.rating) : '',
  systemVoltage: p.systemVoltage ? String(p.systemVoltage) : CATEGORY_SPECS[p.category]?.voltage === 'optional' ? '' : '12',
  batteryType: p.batteryType ?? 'lithium',
  price: groupDigits(p.price),
  warrantyYears: p.warrantyYears == null ? '' : String(p.warrantyYears),
  description: p.description ?? '',
  inStock: p.inStock,
  includesController: p.includesController !== false,
  listed: p.status === 'active',
  imageId: p.imageId ?? null,
});

// Used by vendors (their own catalogue) and by the admin (`admin`: fixing any vendor's product).
export default function ProductForm({ product, onClose, onSaved, admin = false }) {
  const editing = Boolean(product);
  const [f, setF] = useState(product ? fromProduct(product) : blank);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  const spec = CATEGORY_SPECS[f.category];
  const ex = EXAMPLES[f.category] ?? {};
  const sized = spec.rating.mode !== 'none';
  const voltage = spec.voltage; // 'required' | 'optional' | 'none'

  const set = (key) => (e) => setF((x) => ({ ...x, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  // Changing the type resets the fields that mean something different for the new type.
  const setCategory = (e) => {
    const category = e.target.value;
    setF((x) => ({ ...x, category, rating: '', systemVoltage: CATEGORY_SPECS[category].voltage === 'optional' ? '' : '12' }));
    setErrors({});
  };

  const submit = async (e) => {
    e.preventDefault();
    const rating = f.rating.trim() === '' ? null : parseNumber(f.rating);
    const body = {
      category: f.category,
      name: f.name.trim(),
      brand: f.brand.trim() || null,
      rating: sized ? rating : null,
      systemVoltage: voltage === 'none' || f.systemVoltage === '' ? null : Number(f.systemVoltage),
      batteryType: f.category === 'battery' ? f.batteryType : null,
      price: parseNumber(f.price),
      warrantyYears: parseNumber(f.warrantyYears) ?? null,
      description: f.description.trim() || null,
      inStock: f.inStock,
      includesController: f.category === 'inverter' ? f.includesController : true,
      status: f.listed ? 'active' : 'hidden',
      imageId: f.imageId,
    };
    if ((sized && rating !== null && Number.isNaN(rating)) || Number.isNaN(body.price)) {
      setErrors({ ...(sized && rating !== null && Number.isNaN(rating) ? { rating: 'Enter a number.' } : {}), ...(Number.isNaN(body.price) ? { price: 'Enter an amount in naira.' } : {}) });
      return;
    }
    setSaving(true);
    setErrors({});
    setFormError(null);
    try {
      const res = admin
        ? await api.adminUpdateProduct(product.id, body)
        : editing ? await api.vendorUpdateProduct(product.id, body) : await api.vendorCreateProduct(body);
      onSaved(res.product);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'VALIDATION_ERROR') setErrors(fieldErrorsOf(err));
      else setFormError(err.message);
      setSaving(false);
    }
  };

  const err = (k) => errors[k] && <small className="err">{errors[k]}</small>;

  return (
    <Dialog
      title={editing ? 'Edit product' : 'Add a product'}
      eyebrow={admin ? `Admin edit · ${product.vendorName}` : 'Your catalogue'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-quiet" onClick={onClose}>Cancel</button>
          <button type="submit" form="product-form" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Add product'}</button>
        </>
      }
    >
      <form id="product-form" onSubmit={submit} noValidate>
        <label className="field">
          <span>Type</span>
          <select value={f.category} onChange={setCategory} disabled={editing}>
            {CATEGORY_GROUPS.map((group) => (
              <optgroup key={group} label={group}>
                {PRODUCT_CATEGORIES.filter((c) => CATEGORY_SPECS[c].group === group).map((c) => <option key={c} value={c}>{CATEGORY_SPECS[c].label}</option>)}
              </optgroup>
            ))}
          </select>
          {editing && <small>A product&apos;s type can&apos;t be changed. Add a new product instead.</small>}
          {err('category')}
        </label>

        <div className="field-row">
          <label className="field">
            <span>Product name</span>
            <input type="text" value={f.name} onChange={set('name')} aria-invalid={Boolean(errors.name)} placeholder={ex.name ?? 'Product name'} />
            {err('name')}
          </label>
          <label className="field">
            <span>Brand <em>(optional)</em></span>
            <input type="text" value={f.brand} onChange={set('brand')} />
            {err('brand')}
          </label>
        </div>

        {(sized || voltage !== 'none' || f.category === 'battery') && (
          <div className="field-row">
            {sized && (
              <label className="field">
                <span>{spec.rating.label}{spec.rating.mode === 'optional' && <em> (optional)</em>}</span>
                <input type="text" inputMode={spec.rating.integer ? 'numeric' : 'decimal'} value={f.rating} onChange={set('rating')} placeholder={ex.rating} aria-invalid={Boolean(errors.rating)} />
                {errors.rating ? err('rating') : ex.hint && <small>{ex.hint}</small>}
              </label>
            )}
            {voltage !== 'none' && (
              <label className="field">
                <span>System voltage{voltage === 'optional' && <em> (optional)</em>}</span>
                <select value={f.systemVoltage} onChange={set('systemVoltage')}>
                  {voltage === 'optional' && <option value="">Any voltage</option>}
                  <option value="12">12V</option>
                  <option value="24">24V</option>
                  <option value="48">48V</option>
                </select>
                {errors.systemVoltage ? err('systemVoltage') : (
                  <small>
                    {f.category === 'battery' ? 'The voltage of one battery. Use 48V for 51.2V lithium.'
                      : f.category === 'inverter' ? 'The battery voltage this inverter runs on.'
                      : f.category === 'controller' ? 'The battery voltage supported by this charge controller.'
                      : 'The battery voltage it works with.'}
                  </small>
                )}
              </label>
            )}
            {f.category === 'inverter' && (
              <label>
                <input type="checkbox" checked={f.includesController} onChange={(e) => setF((x) => ({ ...x, includesController: e.target.checked }))} />
                <span>Has a built-in solar charge controller (MPPT/PWM). Untick for a plain inverter, so buyers are told to add a controller.</span>
              </label>
            )}
            {f.category === 'battery' && (
              <label className="field">
                <span>Battery type</span>
                <select value={f.batteryType} onChange={set('batteryType')}>
                  <option value="lithium">Lithium</option>
                  <option value="gel">Gel</option>
                  <option value="tubular">Tubular</option>
                  <option value="agm">AGM</option>
                </select>
              </label>
            )}
          </div>
        )}

        <div className="field-row">
          <label className="field">
            <span>{admin ? 'Price per unit (₦)' : 'Your price per unit (₦)'}</span>
            <input type="text" inputMode="numeric" value={f.price} onChange={(e) => setF((x) => ({ ...x, price: groupDigits(e.target.value) }))} aria-invalid={Boolean(errors.price)} placeholder="95,000" />
            {err('price')}
          </label>
          <label className="field">
            <span>Warranty (years) <em>(optional)</em></span>
            <input type="text" inputMode="numeric" value={f.warrantyYears} onChange={set('warrantyYears')} placeholder="5" />
            {err('warrantyYears')}
          </label>
        </div>

        <label className="field">
          <span>Notes <em>(optional)</em></span>
          <textarea rows={3} value={f.description} onChange={set('description')} maxLength={500} placeholder={sized ? undefined : 'Sizes, ratings and what it is compatible with'} />
          {err('description')}
        </label>

        <ImageField label="Product picture" imageId={f.imageId} imageUrl={product?.imageUrl} upload={admin ? api.adminUploadImage : undefined} onChange={(id) => setF((x) => ({ ...x, imageId: id }))} />

        <div className="check-row">
          <label><input type="checkbox" checked={f.inStock} onChange={set('inStock')} /> In stock</label>
          <label><input type="checkbox" checked={f.listed} onChange={set('listed')} /> Show to customers</label>
        </div>

        {formError && <p className="form-error" role="alert">{formError}</p>}
      </form>
    </Dialog>
  );
}
