import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { useShop } from '../auth/ShopContext.jsx';
import { useAssessment } from './AssessmentContext.jsx';

const LINKS = [
  ['/#how', 'How it works'],
  ['/shop', 'Shop'],
  ['/partners', 'Partners'],
  ['/blog', 'Blog'],
  ['/#platform', 'Platform'],
  ['/#providers', 'For providers'],
];

// The phone menu: the shopper's links first, then the ways to join as a provider.
const SIDE_LINKS = [
  ['/#how', 'How it works'],
  ['/shop', 'Shop'],
  ['/blog', 'Blog'],
  ['/partners', 'Partners'],
];
const PROVIDER_LINKS = [
  ['/signup?role=installer', 'Become an installer'],
  ['/signup?role=vendor', 'Sell & Become a Vendor'],
  ['/signup?role=vendor&type=company', 'Corporate Initiatives'],
];

export default function SiteHeader() {
  const { user, ready, logout } = useAuth();
  const { open } = useAssessment();
  const { count } = useShop();
  const navigate = useNavigate();
  const location = useLocation();
  const [menu, setMenu] = useState(false);
  const closeRef = useRef(null);
  const toggleRef = useRef(null);

  const onLogout = async () => {
    setMenu(false);
    await logout();
    navigate('/', { replace: true });
  };

  // The side menu closes when you go to another page, on Escape, and while it is open the page behind does not scroll.
  useEffect(() => { setMenu(false); }, [location.pathname, location.hash]);
  useEffect(() => {
    if (!menu) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') setMenu(false); };
    document.addEventListener('keydown', onKey);
    const toggle = toggleRef.current;
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      toggle?.focus();
    };
  }, [menu]);

  const loggedIn = ready && user;

  // The side menu sits beside the header, not inside it: the header has a blurred background, which would make it the
  // frame of reference for fixed children and push the page wider than the screen.
  return (
    <>
    <header className="nav scrolled">
      <div className="wrap nav-inner">
        <Link to="/" className="brand" aria-label="Solariun home">
          <img src="/logo-mark.svg" height="36" alt="" className="brand-logo" />
          <span className="brand-word">Solariun</span>
        </Link>

        <nav className="nav-links" aria-label="Main">
          {LINKS.map(([to, label]) => <Link key={to} to={to}>{label}</Link>)}
        </nav>

        <div className="nav-actions">
          <Link to="/cart" className="cart-link" aria-label={`Cart, ${count} item${count === 1 ? '' : 's'}`}>Cart{count > 0 && <span className="cart-count">{count}</span>}</Link>
          {loggedIn ? (
            <span className="nav-desktop-only">
              <Link to="/app" className="btn btn-small btn-ghost">Dashboard</Link>
              <button type="button" className="btn btn-small btn-quiet" onClick={onLogout}>Log out</button>
            </span>
          ) : (
            <span className="nav-desktop-only">
              <Link to="/login" className="nav-login">Log in</Link>
              <button type="button" className="btn btn-small btn-primary" onClick={() => open()}>Free assessment</button>
            </span>
          )}
          <button
            type="button"
            ref={toggleRef}
            className="menu-btn"
            aria-label="Open menu"
            aria-expanded={menu}
            aria-controls="side-menu"
            onClick={() => setMenu(true)}
          >
            <span aria-hidden="true" /><span aria-hidden="true" /><span aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>

      {menu && (
        <>
          <div className="side-backdrop" onClick={() => setMenu(false)} aria-hidden="true" />
          <aside id="side-menu" className="side-menu" role="dialog" aria-modal="true" aria-label="Menu">
            <div className="side-head">
              <span className="brand-word">Menu</span>
              <button type="button" ref={closeRef} className="icon-btn" onClick={() => setMenu(false)} aria-label="Close menu">×</button>
            </div>
            <nav className="side-links" aria-label="Site">
              {SIDE_LINKS.map(([to, label]) => <Link key={to} to={to}>{label}</Link>)}
              <Link to="/cart">Cart{count > 0 ? ` (${count})` : ''}</Link>
              <p className="side-group">For providers</p>
              {PROVIDER_LINKS.map(([to, label]) => <Link key={to} to={to}>{label}</Link>)}
            </nav>
            <div className="side-actions">
              {loggedIn ? (
                <>
                  <Link to="/app" className="btn btn-primary">Dashboard</Link>
                  <button type="button" className="btn btn-ghost" onClick={onLogout}>Log out</button>
                </>
              ) : (
                <>
                  <button type="button" className="btn btn-primary" onClick={() => { setMenu(false); open(); }}>Free assessment</button>
                  <Link to="/login" className="btn btn-ghost">Log in</Link>
                  <Link to="/signup" className="btn btn-ghost">Create account</Link>
                </>
              )}
            </div>
          </aside>
        </>
      )}
    </>
  );
}
