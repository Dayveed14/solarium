import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import Seo from '../../components/Seo.jsx';

// "What are you looking to power?" Solar is live. The rest take an email so we know which to build next.
const SOON = [
  { key: 'cng', title: 'Compressed Natural Gas (CNG)', text: 'Explore CNG options for suitable vehicles, commercial operations and industrial energy applications.' },
  { key: 'biogas', title: 'Biogas', text: 'Explore energy generated from organic waste, agricultural residues and other suitable feedstocks.' },
  { key: 'biomass', title: 'Biomass Energy', text: 'Explore energy solutions using agricultural residues, wood waste and other suitable organic materials.' },
  { key: 'mini_grid', title: 'Mini-Grids and Distributed Energy', text: 'Explore community and business energy systems designed to serve multiple users or facilities.' },
  { key: 'hybrid', title: 'Hybrid Energy Systems', text: 'Explore combinations of energy sources, storage and backup systems designed around specific requirements.' },
];

function NotifyCard({ item }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [state, setState] = useState({ busy: false, done: false, error: null });

  const submit = async (e) => {
    e.preventDefault();
    setState({ busy: true, done: false, error: null });
    try {
      await api.interest(item.key, email.trim());
      setState({ busy: false, done: true, error: null });
    } catch (err) {
      setState({ busy: false, done: false, error: err.message });
    }
  };

  return (
    <li className="cat cat-soon">
      <div className="cat-top"><h3>{item.title}</h3><span className="tag">Coming soon</span></div>
      <p>{item.text}</p>
      {state.done ? (
        <p className="cat-thanks" role="status">Thanks. We will email you when this opens.</p>
      ) : open ? (
        <form className="cat-form" onSubmit={submit}>
          <label className="sr-only" htmlFor={`n-${item.key}`}>Your email</label>
          <input id={`n-${item.key}`} type="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          <button type="submit" className="btn btn-primary btn-small" disabled={state.busy}>{state.busy ? 'Sending…' : 'Notify me'}</button>
          {state.error && <small className="err" role="alert">{state.error}</small>}
        </form>
      ) : (
        <button type="button" className="btn btn-ghost btn-small" onClick={() => setOpen(true)}>Notify me when it opens</button>
      )}
    </li>
  );
}

export default function AssessHome() {
  return (
    <div className="wrap assess-home">
      <Seo title="What are you looking to power? | TerraVoltix" description="Tell us what you want to power, how you use energy and what matters most. We help you explore suitable energy options for your requirements and budget." />
      <header className="assess-head">
        <p className="eyebrow">Free assessment</p>
        <h1>What are you looking to power?</h1>
        <p className="lede">Every energy need is different. Tell us what you want to power, how you use energy and what matters most. We&apos;ll help you explore suitable energy options based on your requirements and budget.</p>
      </header>

      <ul className="cat-grid">
        <li className="cat cat-featured">
          <div className="cat-top"><h2>Solar Energy</h2><span className="tag tag-gold">Featured</span></div>
          <p>Calculate your energy needs, compare fuel prices and explore solar panels, inverters, batteries and hybrid systems for homes, businesses and organisations.</p>
          <Link to="/assess/solar" className="btn btn-primary">Explore solar</Link>
        </li>
        <li className="cat">
          <div className="cat-top"><h3>Battery Storage and Backup Systems</h3></div>
          <p>Explore battery storage, backup power and energy management options.</p>
          <Link to="/assess/solar/guided?focus=backup" className="btn btn-ghost btn-small">Size my backup</Link>
        </li>
        {SOON.map((s) => <NotifyCard key={s.key} item={s} />)}
      </ul>
    </div>
  );
}
