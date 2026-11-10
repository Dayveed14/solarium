import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../api.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import ApplianceRow from '../../components/ApplianceRow.jsx';
import { useGeo } from '../../components/AddressFields.jsx';
import Seo from '../../components/Seo.jsx';
import {
  BUDGET_BANDS, DISCO_FOR_STATE, EXISTING, GRID, PROPERTY_TYPES, SPACES, WHO, WHO_BY_KEY,
  clearDraft, loadDraft, saveDraft,
} from '../../lib/guided.js';
import { naira } from '../../lib/format.js';
import { savePending } from '../../lib/pending.js';
import { itemsFromSelection } from '../../lib/selection.js';
import { useCatalog } from '../../lib/useCatalog.js';

const STEPS = ['Who', 'What to power', 'Backup and priorities', 'Budget', 'Where'];

const blank = (focus) => ({
  step: 0, who: null, selection: {}, category: null,
  backupKey: focus === 'backup' ? 'b12' : 'b6',
  priorities: focus === 'backup' ? ['food', 'lights_fans'] : [],
  critical: [], criticalTouched: false,
  budgetBand: null, budgetText: '',
  disco: 'aedc', discoTouched: false, grid: 'yes', supply: 'D',
  state: '', area: '', propertyType: '', space: '', existing: [],
});

export default function GuidedFlow() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const focus = params.get('focus');
  const editing = params.get('edit') === '1';

  const [a, setA] = useState(() => {
    const draft = editing ? loadDraft() : null;
    if (draft) return { ...draft, step: 0 }; // coming back to change answers: start from the top, nothing is lost
    clearDraft();
    const start = blank(focus);
    const who = params.get('who');
    return WHO_BY_KEY[who] ? { ...start, who } : start;
  });
  const set = useCallback((patch) => setA((prev) => ({ ...prev, ...patch })), []);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { saveDraft(a); }, [a]);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [a.step]);

  const who = a.who ? WHO_BY_KEY[a.who] : null;
  const segment = who?.segment ?? null;
  const { data: catalog, error: catalogError } = useCatalog(segment);
  const { geo } = useGeo();

  useEffect(() => {
    if (catalog) setA((prev) => (prev.category && catalog.categories.includes(prev.category) ? prev : { ...prev, category: catalog.categories[0] }));
  }, [catalog]);

  // Until they pick a DisCo themselves, follow the state they chose.
  useEffect(() => {
    if (!a.discoTouched && DISCO_FOR_STATE[a.state]) setA((prev) => ({ ...prev, disco: DISCO_FOR_STATE[a.state] }));
  }, [a.state, a.discoTouched]);

  // What each priority points at, for the segment being assessed.
  const priorityById = useMemo(() => new Map((catalog?.priorities ?? []).map((p) => [p.id, p])), [catalog]);
  const tickedIds = Object.keys(a.selection);

  // Items that should stay on in a power cut, worked out from the priorities until the person adjusts the list.
  useEffect(() => {
    if (!catalog || a.criticalTouched) return;
    const fromPriorities = new Set();
    for (const id of a.priorities) {
      const p = priorityById.get(id);
      if (p && !p.notEssential && !p.wholeSite) p.applianceIds.forEach((x) => fromPriorities.add(x));
    }
    const next = tickedIds.filter((x) => fromPriorities.has(x));
    setA((prev) => (prev.critical.length === next.length && next.every((x) => prev.critical.includes(x)) ? prev : { ...prev, critical: next }));
  }, [catalog, a.priorities, a.criticalTouched, priorityById, tickedIds.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- picker actions (same shape the quick assessment uses) ----
  const toggleAppliance = (ap) => setA((prev) => {
    if (prev.selection[ap.id]) {
      const { [ap.id]: _gone, ...rest } = prev.selection;
      return { ...prev, selection: rest };
    }
    const dv = ap.variants.find((x) => x.default) ?? ap.variants[0];
    return { ...prev, selection: { ...prev.selection, [ap.id]: { hoursKey: ap.defaultHours, qty: { [dv.id]: 1 } } } };
  });
  const setQty = (ap, variantId, n) => setA((prev) => {
    const cur = prev.selection[ap.id];
    if (!cur) return prev;
    const qty = { ...cur.qty, [variantId]: n };
    if (Object.values(qty).every((q) => !q)) {
      const { [ap.id]: _gone, ...rest } = prev.selection;
      return { ...prev, selection: rest };
    }
    return { ...prev, selection: { ...prev.selection, [ap.id]: { ...cur, qty } } };
  });
  const setHours = (ap, hoursKey) => setA((prev) => (prev.selection[ap.id] ? { ...prev, selection: { ...prev.selection, [ap.id]: { ...prev.selection[ap.id], hoursKey } } } : prev));
  const applyPreset = (preset) => {
    const sel = {};
    for (const it of preset.items) {
      const ap = catalog.appliances.find((x) => x.id === it.applianceId);
      if (!ap) continue;
      const e = (sel[ap.id] ??= { hoursKey: it.hoursKey ?? ap.defaultHours, qty: {} });
      e.qty[it.variantId] = (e.qty[it.variantId] ?? 0) + it.qty;
    }
    set({ selection: sel });
  };

  const chosenCount = tickedIds.length;
  const chosenByCategory = useMemo(() => {
    const counts = {};
    if (!catalog) return counts;
    for (const ap of catalog.appliances) if (a.selection[ap.id]) counts[ap.category] = (counts[ap.category] ?? 0) + 1;
    return counts;
  }, [catalog, a.selection]);

  // ---- priorities ----
  const togglePriority = (id) => set({ priorities: a.priorities.includes(id) ? a.priorities.filter((x) => x !== id) : [...a.priorities, id] });
  const movePriority = (id, dir) => {
    const i = a.priorities.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= a.priorities.length) return;
    const next = [...a.priorities];
    [next[i], next[j]] = [next[j], next[i]];
    set({ priorities: next });
  };
  const toggleCritical = (id) => set({ criticalTouched: true, critical: a.critical.includes(id) ? a.critical.filter((x) => x !== id) : [...a.critical, id] });

  // ---- budget ----
  const typed = Number(String(a.budgetText).replace(/[^0-9]/g, '')) || 0;
  const band = BUDGET_BANDS.find((b) => b.key === a.budgetBand);
  const budget = typed || band?.max || 0;

  const canNext = a.step === 0 ? Boolean(who) : a.step === 1 ? chosenCount > 0 : true;

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    const input = {
      segment, who: a.who, disco: a.disco,
      supplyBand: a.grid === 'no' ? null : a.supply,
      items: itemsFromSelection(a.selection, catalog),
      backupKey: a.backupKey,
      priorities: a.priorities,
      criticalIds: a.critical.filter((id) => tickedIds.includes(id)),
      configKey: 'auto',
      ...(budget ? { budget } : {}),
      place: {
        ...(a.state ? { state: a.state } : {}), ...(a.area ? { area: a.area } : {}),
        ...(a.propertyType ? { propertyType: a.propertyType } : {}), ...(a.space ? { space: a.space } : {}),
        gridConnected: a.grid, ...(a.existing.length ? { existing: a.existing } : {}),
      },
    };
    try {
      const { result } = await api.estimate(input);
      savePending({ input, result });
      navigate('/results');
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  const visible = catalog && a.category ? catalog.appliances.filter((x) => x.category === a.category) : [];
  const stateObj = geo?.states.find((s) => s.id === a.state);

  return (
    <div className="wrap gf">
      <Seo title="Find a solar system for your budget | TerraVoltix" description="Tell us what you need to power, for how long and what matters most. We size a system around it." noindex />
      <header className="gf-head">
        <p className="eyebrow">Free assessment · Step {a.step + 1} of {STEPS.length}</p>
        <ol className="gf-steps" aria-label="Progress">
          {STEPS.map((s, i) => (
            <li key={s} className={i === a.step ? 'on' : i < a.step ? 'done' : ''} aria-current={i === a.step ? 'step' : undefined}><span>{s}</span></li>
          ))}
        </ol>
      </header>

      <div className="gf-card">
        {/* ---------- 1. Who ---------- */}
        {a.step === 0 && (
          <>
            <h1>Who are you powering?</h1>
            <p className="lede">This lets us ask the right questions and show the right options.</p>
            <fieldset className="choice-grid gf-grid">
              <legend className="sr-only">Who you are powering</legend>
              {WHO.map((w) => (
                <label key={w.key} className={`choice${a.who === w.key ? ' on' : ''}`}>
                  <input type="radio" name="who" checked={a.who === w.key} onChange={() => set({ who: w.key, selection: {}, category: null, criticalTouched: false })} />
                  <strong>{w.title}</strong>
                  <span>{w.text}</span>
                </label>
              ))}
            </fieldset>
            {who?.large && (
              <aside className="r-notice" role="note">
                <strong>Bigger sites are best measured in person.</strong> You can carry on for a quick estimate. For a firm number, a TerraVoltix field agent can visit and measure the site for free.{' '}
                {user?.role === 'business' ? <Link to="/app/site-assessment">Request a site assessment</Link> : <Link to="/signup?role=business">Create a business account to request one</Link>}.
              </aside>
            )}
          </>
        )}

        {/* ---------- 2. What to power ---------- */}
        {a.step === 1 && (
          <>
            <h1>What do you need to power?</h1>
            <p className="lede">Tick what you use. Don&apos;t know the wattage? You don&apos;t need to. Pick the size or type and we use typical ratings, always shown as estimates.</p>
            {catalogError && <p className="form-error" role="alert">{catalogError}</p>}
            {!catalog && !catalogError && <p className="muted" role="status">Loading the list…</p>}
            {catalog && (
              <>
                <div className="presets">
                  <span className="muted">Quick start:</span>
                  {catalog.presets.map((p) => <button key={p.id} type="button" className="chip-btn" onClick={() => applyPreset(p)}>{p.label}</button>)}
                  {chosenCount > 0 && <button type="button" className="chip-btn chip-btn-quiet" onClick={() => set({ selection: {} })}>Clear all</button>}
                </div>
                <div className="tabs" role="tablist" aria-label="Categories">
                  {catalog.categories.map((c) => (
                    <button key={c} type="button" role="tab" aria-selected={a.category === c} className={`tab${a.category === c ? ' on' : ''}`} onClick={() => set({ category: c })}>
                      {c}{chosenByCategory[c] ? <span className="tab-dot">{chosenByCategory[c]}</span> : null}
                    </button>
                  ))}
                </div>
                <ul className="ap-list">
                  {visible.map((ap) => (
                    <ApplianceRow key={ap.id} appliance={ap} selection={a.selection[ap.id]} hourOptions={catalog.hourOptions}
                      onToggle={() => toggleAppliance(ap)} onQty={(vid, n) => setQty(ap, vid, n)} onHours={(k) => setHours(ap, k)} />
                  ))}
                </ul>
              </>
            )}
          </>
        )}

        {/* ---------- 3. Backup and priorities ---------- */}
        {a.step === 2 && catalog && (
          <>
            <h1>How long, and what matters most?</h1>
            <fieldset className="gf-block">
              <legend className="field-legend">When the power is cut, how long should your system keep going?</legend>
              <div className="choice-grid choice-grid-tight gf-grid-3">
                {catalog.backupOptions.map((o) => (
                  <label key={o.key} className={`choice choice-small${a.backupKey === o.key ? ' on' : ''}`}>
                    <input type="radio" name="backup" checked={a.backupKey === o.key} onChange={() => set({ backupKey: o.key })} />
                    <strong>{o.label}</strong>
                  </label>
                ))}
              </div>
              <p className="muted gf-hint">The battery is sized for this. Longer backup means a bigger battery and a higher price.</p>
            </fieldset>

            <fieldset className="gf-block">
              <legend className="field-legend">What matters most to you? Pick as many as you like.</legend>
              <ul className="gf-checks">
                {catalog.priorities.map((p) => {
                  const on = a.priorities.includes(p.id);
                  const have = p.wholeSite || p.applianceIds.some((id) => a.selection[id]);
                  return (
                    <li key={p.id}>
                      <label className={`gf-check${on ? ' on' : ''}`}>
                        <input type="checkbox" checked={on} onChange={() => togglePriority(p.id)} />
                        <span><strong>{p.label}</strong><small>{p.hint}{on && !have ? ' You have not ticked a matching item yet. Go back to add it.' : ''}</small></span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </fieldset>

            {a.priorities.length > 1 && (
              <div className="gf-block">
                <p className="field-legend">Put them in order, most important first.</p>
                <ol className="gf-rank">
                  {a.priorities.map((id, i) => (
                    <li key={id}>
                      <span className="gf-rank-n">{i + 1}</span>
                      <span className="gf-rank-t">{priorityById.get(id)?.label}</span>
                      <button type="button" className="icon-btn" aria-label={`Move ${priorityById.get(id)?.label} up`} disabled={i === 0} onClick={() => movePriority(id, -1)}>↑</button>
                      <button type="button" className="icon-btn" aria-label={`Move ${priorityById.get(id)?.label} down`} disabled={i === a.priorities.length - 1} onClick={() => movePriority(id, 1)}>↓</button>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <fieldset className="gf-block">
              <legend className="field-legend">Which of these must stay on during a power cut?</legend>
              <p className="muted gf-hint">We ticked these from your priorities. Change them if you like. Everything else can wait until the power is back.</p>
              <ul className="gf-checks gf-checks-tight">
                {tickedIds.map((id) => {
                  const ap = catalog.appliances.find((x) => x.id === id);
                  if (!ap) return null;
                  const on = a.critical.includes(id);
                  return (
                    <li key={id}>
                      <label className={`gf-check${on ? ' on' : ''}`}>
                        <input type="checkbox" checked={on} onChange={() => toggleCritical(id)} />
                        <span><strong>{ap.name}</strong></span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              {a.critical.length === 0 && <p className="muted gf-hint">Nothing ticked? We will assume lights, fans, fridge and internet.</p>}
            </fieldset>
          </>
        )}

        {/* ---------- 4. Budget ---------- */}
        {a.step === 3 && (
          <>
            <h1>What is your budget?</h1>
            <p className="lede">We will show what fits and tell you honestly if it falls short, and what you can do about it. If you would rather not say, skip it.</p>
            <fieldset className="choice-grid choice-grid-tight gf-grid-3">
              <legend className="sr-only">Budget range</legend>
              {BUDGET_BANDS.map((b) => (
                <label key={b.key} className={`choice choice-small${a.budgetBand === b.key && !typed ? ' on' : ''}`}>
                  <input type="radio" name="budget" checked={a.budgetBand === b.key && !typed} onChange={() => set({ budgetBand: b.key, budgetText: '' })} />
                  <strong>{b.label}</strong>
                </label>
              ))}
            </fieldset>
            <label className="field budget-field">
              <span>Or type an amount (optional)</span>
              <input type="text" inputMode="numeric" placeholder="e.g. 2,500,000" value={typed ? typed.toLocaleString('en-NG') : ''}
                onChange={(e) => set({ budgetText: e.target.value, budgetBand: e.target.value ? null : a.budgetBand })} />
              {budget > 0 && <small>We will compare each option with {naira(budget)}.</small>}
            </label>
          </>
        )}

        {/* ---------- 5. Where ---------- */}
        {a.step === 4 && catalog && (
          <>
            <h1>Where will it be used?</h1>
            <p className="lede">We only need the general area now. An exact address is asked for later, only if a site visit or a quote needs it.</p>
            <div className="field-row">
              <label className="field">
                <span>State</span>
                <select value={a.state} onChange={(e) => set({ state: e.target.value, area: '' })}>
                  <option value="">{geo ? 'Choose a state…' : 'Loading…'}</option>
                  {(geo?.states ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
              <label className="field">
                <span>City or area</span>
                <select value={a.area} onChange={(e) => set({ area: e.target.value })} disabled={!stateObj}>
                  <option value="">{stateObj ? 'Choose an area…' : 'Choose a state first'}</option>
                  {stateObj && (geo.zones ?? []).map((zone) => (
                    <optgroup key={zone} label={`${zone} ${stateObj.id === 'lagos' ? 'Lagos' : 'Abuja'}`}>
                      {stateObj.areas.filter((ar) => ar.zone === zone).map((ar) => <option key={ar.id} value={ar.id}>{ar.name}</option>)}
                    </optgroup>
                  ))}
                </select>
              </label>
            </div>
            <label className="field">
              <span>Your electricity company (DisCo)</span>
              <select value={a.disco} onChange={(e) => set({ disco: e.target.value, discoTouched: true })}>
                {catalog.discos.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <small>It is the name on your prepaid meter or bill.</small>
            </label>

            <fieldset className="gf-block">
              <legend className="field-legend">Is the property connected to the grid?</legend>
              <div className="choice-grid choice-grid-tight gf-grid-3">
                {GRID.map((g) => (
                  <label key={g.key} className={`choice choice-small${a.grid === g.key ? ' on' : ''}`}>
                    <input type="radio" name="grid" checked={a.grid === g.key} onChange={() => set({ grid: g.key, supply: g.key === 'sometimes' && ['A', 'B', 'C'].includes(a.supply) ? 'E' : a.supply })} />
                    <strong>{g.title}</strong><span>{g.text}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {a.grid !== 'no' && (
              <fieldset className="gf-block">
                <legend className="field-legend">On a normal day, how much light (NEPA) do you get?</legend>
                <div className="choice-grid choice-grid-tight gf-grid-3">
                  {catalog.supplyOptions.filter((o) => o.band).map((o) => (
                    <label key={o.band} className={`choice choice-small${a.supply === o.band ? ' on' : ''}`}>
                      <input type="radio" name="supply" checked={a.supply === o.band} onChange={() => set({ supply: o.band })} />
                      <strong>{o.title}</strong><span>{o.detail}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            <div className="field-row">
              <label className="field">
                <span>Property type <em>(optional)</em></span>
                <select value={a.propertyType} onChange={(e) => set({ propertyType: e.target.value })}>
                  <option value="">Choose…</option>
                  {PROPERTY_TYPES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Space for panels <em>(optional)</em></span>
                <select value={a.space} onChange={(e) => set({ space: e.target.value })}>
                  <option value="">Choose…</option>
                  {SPACES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </label>
            </div>

            <fieldset className="gf-block">
              <legend className="field-legend">Do you already have any of these? <em className="muted">(optional)</em></legend>
              <div className="chips">
                {EXISTING.map((x) => (
                  <label key={x.key} className="chip">
                    <input type="checkbox" checked={a.existing.includes(x.key)} onChange={() => set({ existing: a.existing.includes(x.key) ? a.existing.filter((k) => k !== x.key) : [...a.existing, x.key] })} />
                    <span>{x.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </>
        )}

        {error && <p className="form-error" role="alert">{error}</p>}

        <footer className="gf-foot">
          <div className="foot-left">
            {a.step > 0 ? <button type="button" className="btn btn-ghost btn-small" onClick={() => set({ step: a.step - 1 })} disabled={submitting}>Back</button>
              : <Link to="/assess/solar" className="btn btn-ghost btn-small">Back</Link>}
            {a.step === 1 && chosenCount > 0 && <span className="muted">{chosenCount} type{chosenCount === 1 ? '' : 's'} chosen</span>}
          </div>
          {a.step < STEPS.length - 1 ? (
            <button type="button" className="btn btn-primary" disabled={!canNext} onClick={() => set({ step: a.step + 1 })}>
              {a.step === 3 && !budget ? 'Skip' : 'Continue'}
            </button>
          ) : (
            <button type="button" className="btn btn-primary" disabled={submitting || !catalog} onClick={submit}>
              {submitting ? 'Working it out…' : 'Show my options'}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
