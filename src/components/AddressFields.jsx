import { useEffect, useState } from 'react';
import { api } from '../api.js';

let geoCache = null;
// Loads Lagos and Abuja with their areas once, then reuses them.
// If the server is asleep or slow (a free Render service takes up to a minute to wake), keep trying instead of leaving the list empty.
export function useGeo() {
  const [geo, setGeo] = useState(geoCache);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (geoCache) return undefined;
    let cancelled = false;
    let timer;
    const load = (n) => {
      api.areas()
        .then((g) => { geoCache = g; if (!cancelled) { setGeo(g); setFailed(false); } })
        .catch(() => {
          if (cancelled) return;
          if (n >= 6) { setFailed(true); return; }
          timer = setTimeout(() => load(n + 1), Math.min(1000 * 2 ** n, 10000));
        });
    };
    setFailed(false);
    load(0);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [attempt]);
  return { geo, failed, retry: () => setAttempt((a) => a + 1) };
}

export const emptyAddress = { line: '', state: '', areaId: '' };

// Address, then state, then area. Area choices depend on the state and are grouped Central / Inner / Outer.
// `errors` is the field-error map from the API, with keys like "address.line".
export default function AddressFields({ value, onChange, errors = {}, prefix = 'address', legend = 'Address' }) {
  const { geo, failed, retry } = useGeo();
  const state = geo?.states.find((s) => s.id === value.state);
  const err = (k) => errors[`${prefix}.${k}`];
  const set = (patch) => onChange({ ...value, ...patch });

  return (
    <fieldset className="address-fields">
      <legend className="field-legend">{legend}</legend>
      <label className="field">
        <span>Street address</span>
        <input type="text" autoComplete="street-address" value={value.line} onChange={(e) => set({ line: e.target.value })} placeholder="House number, street, landmark" aria-invalid={Boolean(err('line'))} />
        {err('line') && <small className="err">{err('line')}</small>}
      </label>
      <div className="field-row">
        <label className="field">
          <span>State</span>
          <select value={value.state} onChange={(e) => set({ state: e.target.value, areaId: '' })} aria-invalid={Boolean(err('state'))}>
            <option value="">{geo ? 'Choose a state…' : failed ? 'Could not load states' : 'Loading states…'}</option>
            {(geo?.states ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {failed && !geo && <small className="err">Could not reach the server. <button type="button" className="link-btn" onClick={retry}>Try again</button></small>}
          {err('state') && <small className="err">{err('state')}</small>}
        </label>
        <label className="field">
          <span>Area</span>
          <select value={value.areaId} onChange={(e) => set({ areaId: e.target.value })} disabled={!state} aria-invalid={Boolean(err('areaId'))}>
            <option value="">{state ? 'Choose your area…' : 'Choose a state first'}</option>
            {state && (geo.zones ?? []).map((zone) => (
              <optgroup key={zone} label={`${zone} ${state.id === 'lagos' ? 'Lagos' : 'Abuja'}`}>
                {state.areas.filter((a) => a.zone === zone).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </optgroup>
            ))}
          </select>
          {err('areaId') && <small className="err">{err('areaId')}</small>}
        </label>
      </div>
    </fieldset>
  );
}
