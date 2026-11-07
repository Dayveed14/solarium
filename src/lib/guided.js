// Answers for the guided solar assessment ("What do you need to power, for how long, and what matters most?").

export const WHO = [
  { key: 'home', title: 'Home', text: 'A house, flat or family compound.', segment: 'home' },
  { key: 'small_business', title: 'Small business', text: 'A shop, salon, clinic, workshop or small office.', segment: 'business' },
  { key: 'office', title: 'Office or commercial facility', text: 'A bigger office, branch, plaza unit or commercial building.', segment: 'business', large: true },
  { key: 'industrial', title: 'Industrial facility', text: 'A factory, plant or production site.', segment: 'business', large: true },
  { key: 'farm', title: 'Farm or agricultural operation', text: 'Pumps, cold rooms, processing and farm buildings.', segment: 'business', large: true },
  { key: 'institution', title: 'School, hospital or institution', text: 'A school, clinic, hospital, church or similar.', segment: 'business', large: true },
  { key: 'other', title: 'Something else', text: 'Tell us what you use and we will work it out.', segment: 'home' },
];
export const WHO_BY_KEY = Object.fromEntries(WHO.map((w) => [w.key, w]));

// Naira bands. `max` is what we treat as the budget when only a band is chosen; null means "not sure".
export const BUDGET_BANDS = [
  { key: 'u500', label: 'Under ₦500,000', max: 500_000 },
  { key: 'b1', label: '₦500,000 – ₦1.5 million', max: 1_500_000 },
  { key: 'b2', label: '₦1.5 – ₦3 million', max: 3_000_000 },
  { key: 'b3', label: '₦3 – ₦6 million', max: 6_000_000 },
  { key: 'b4', label: '₦6 – ₦12 million', max: 12_000_000 },
  { key: 'b5', label: 'Above ₦12 million', max: 60_000_000 },
  { key: 'unsure', label: 'Not sure yet', max: null },
];

export const GRID = [
  { key: 'yes', title: 'Yes, most of the day', text: 'We have public power, with some cuts.' },
  { key: 'sometimes', title: 'Only a few hours', text: 'Light comes and goes a lot.' },
  { key: 'no', title: 'No grid power', text: 'We run on a generator or nothing.' },
];

export const PROPERTY_TYPES = ['House or bungalow', 'Flat or apartment', 'Shop or kiosk', 'Office', 'School or clinic', 'Farm or plant', 'Other'];
export const SPACES = [
  { key: 'roof', label: 'A roof' },
  { key: 'ground', label: 'Open ground' },
  { key: 'both', label: 'Roof and ground' },
  { key: 'unsure', label: 'Not sure' },
];
export const EXISTING = [
  { key: 'solar', label: 'Solar panels' },
  { key: 'inverter', label: 'An inverter' },
  { key: 'battery', label: 'Batteries' },
  { key: 'generator', label: 'A generator' },
];

// A starting disco for each state, only used until the person picks one themselves.
export const DISCO_FOR_STATE = { lagos: 'ikedc', abuja: 'aedc' };

const KEY = 'solalium:guided-draft';
export function saveDraft(value) {
  try { sessionStorage.setItem(KEY, JSON.stringify(value)); } catch { /* the flow still works without it */ }
}
export function loadDraft() {
  try { const raw = sessionStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
export function clearDraft() {
  try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
}
