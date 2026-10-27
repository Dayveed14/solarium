import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import Seo from '../components/Seo.jsx';
import { PUBLIC_PAGES } from '../lib/seo.js';

const KIND = { seller: 'Seller', company: 'Company', installer: 'Installer' };
const TABS = [['', 'Everyone'], ['seller', 'Sellers'], ['company', 'Companies'], ['installer', 'Installers']];
const COLUMNS = [['name', 'Name'], ['kind', 'Type'], ['stateName', 'State'], ['areaName', 'Area']];

// A public, sortable list of everyone on the platform who is approved: sellers, companies and installers.
export default function Partners() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [kind, setKind] = useState('');
  const [state, setState] = useState('');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState({ key: 'stateName', dir: 'asc' });

  useEffect(() => { api.partners().then(setData).catch((e) => setError(e.message)); }, []);

  const states = useMemo(() => [...new Set((data?.partners ?? []).map((p) => p.stateName).filter(Boolean))].sort(), [data]);
  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = (data?.partners ?? []).filter((p) => (!kind || p.kind === kind) && (!state || p.stateName === state) && (!term || `${p.name} ${p.areaName ?? ''} ${p.services.join(' ')}`.toLowerCase().includes(term)));
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => dir * String(a[sort.key] ?? '').localeCompare(String(b[sort.key] ?? ''), 'en', { sensitivity: 'base' }) || a.name.localeCompare(b.name));
  }, [data, kind, state, q, sort]);

  const toggleSort = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  const ariaSort = (key) => (sort.key === key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none');

  return (
    <div className="wrap partners-wrap">
      <Seo {...PUBLIC_PAGES['/partners']} path="/partners" />
      <h1>Our partners</h1>
      <p className="muted">
        Sellers, solar companies and installers who have been checked by Solalium. Sort by state or area to find someone near you.
        {data ? ` ${data.counts.seller} sellers, ${data.counts.company} companies, ${data.counts.installer} installers.` : ''}
      </p>

      <div className="partner-filters">
        <div className="tabs" role="tablist" aria-label="Type of partner">
          {TABS.map(([value, label]) => <button key={label} type="button" role="tab" aria-selected={kind === value} className={kind === value ? 'is-active' : ''} onClick={() => setKind(value)}>{label}</button>)}
        </div>
        <div className="partner-controls">
          <label className="field-inline"><span className="sr-only">State</span>
            <select value={state} onChange={(e) => setState(e.target.value)} aria-label="State">
              <option value="">All states</option>
              {states.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <input type="search" placeholder="Search name or area" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search partners" />
        </div>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}
      {!data && !error && <p className="muted" role="status">Loading…</p>}
      {data && rows.length === 0 && <div className="empty-card"><h3>No partners match</h3><p>Try another state or clear the search.</p></div>}

      {rows.length > 0 && (
        <div className="table-scroll">
          <table className="partner-table">
            <thead>
              <tr>
                {COLUMNS.map(([key, label]) => (
                  <th key={key} scope="col" aria-sort={ariaSort(key)}>
                    <button type="button" className="th-sort" onClick={() => toggleSort(key)}>{label}<span aria-hidden="true">{sort.key === key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}</span></button>
                  </th>
                ))}
                <th scope="col">What they do</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p, i) => (
                <tr key={`${p.kind}-${p.name}-${i}`}>
                  <td data-label="Name"><strong>{p.name}</strong> <span className="badge badge-verified">Verified</span></td>
                  <td data-label="Type">{KIND[p.kind]}</td>
                  <td data-label="State">{p.stateName ?? '—'}</td>
                  <td data-label="What they do">
                    {p.services.join(' · ')}
                    {p.kind !== 'installer' && p.products > 0 ? <small className="muted"> · {p.products} product{p.products === 1 ? '' : 's'} listed</small> : null}
                    {p.kind === 'installer' && p.jobsCompleted > 0 ? <small className="muted"> · {p.jobsCompleted} job{p.jobsCompleted === 1 ? '' : 's'} done on Solalium</small> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="muted partner-foot">
        Work in solar? <Link to="/signup?role=vendor">Sell or register your company</Link> or <Link to="/signup?role=installer">become an installer</Link>.
      </p>
    </div>
  );
}
