import { CATEGORY_SPECS } from './productCategories.js';

export const naira = (n) => {
  const value = Number(n);
  if (!Number.isFinite(value)) return '₦0';
  return `₦${Math.round(value).toLocaleString('en-NG')}`;
};

// ₦1.4m / ₦65m / ₦2.1bn for big numbers, so cards stay readable.
export function nairaCompact(n) {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}₦${(abs / 1e9).toFixed(abs >= 1e10 ? 0 : 1)}bn`;
  if (abs >= 1e6) return `${sign}₦${(abs / 1e6).toFixed(abs >= 1e7 ? 0 : 1)}m`;
  return `${sign}${naira(abs)}`;
}

export function monthsToText(months) {
  if (months == null || !Number.isInteger(months) || months < 0) {
    return null;
  }
  if (months < 12) {
    return `${months} month${months === 1 ? '' : 's'}`;
  }
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const y = `${years} yr${years === 1 ? '' : 's'}`;
  return rest ? `${y} ${rest} mo` : y;
}

export const kwh = (n) => (n >= 100 ? Math.round(n) : Math.round(n * 10) / 10).toLocaleString('en-NG');

export const formatDate = (value) =>
  new Date(value).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });

export const PLAN_LABEL = { buy: 'Buy', lease: 'Lease to own', rent: 'Rent', eaas: 'Energy as a service' };
export const CATEGORY_LABEL = Object.fromEntries(Object.entries(CATEGORY_SPECS).map(([k, v]) => [k, v.label]));
export const CATEGORY_PLURAL = Object.fromEntries(Object.entries(CATEGORY_SPECS).map(([k, v]) => [k, v.plural]));

// "550W", "1.5 kVA · 12V", "2.4 kWh · 12V · lithium", "60 A · 48V": one place so every screen words sizes the same way.
// Products with no size (cables, mounting ...) show nothing.
export function sizeText(p) {
  const spec = CATEGORY_SPECS[p.category];
  if (!spec) return '';
  const rating = Number(p.rating);
  const parts = [];
  if (spec.rating.mode !== 'none' && rating > 0) parts.push(p.category === 'panel' ? `${rating}W` : `${rating} ${spec.rating.unit}`);
  if (spec.voltage !== 'none' && p.systemVoltage) parts.push(`${p.systemVoltage}V`);
  if (p.category === 'battery' && p.batteryType) parts.push(p.batteryType);
  return parts.join(' · ');
}
