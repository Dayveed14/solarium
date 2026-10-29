import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

export default function SiteFooter() {
  const { user, ready } = useAuth();
  return (
    <footer className="footer">
      <div className="wrap footer-grid">
        <div className="footer-brand">
          <Link to="/" className="brand">
            <img src="/logo-mark.svg" height="30" alt="" className="brand-logo" />
            <span className="brand-word">Solariun</span>
          </Link>
          <p>Clean energy. Lasting value.</p>
        </div>
        <div className="footer-links">
          <Link to="/#how">How it works</Link>
          <Link to="/partners">Partners</Link>
          <Link to="/blog">Blog</Link>
          <Link to="/#platform">Platform</Link>
          <Link to="/#providers">For providers</Link>
          {ready && !user && <Link to="/login">Log in</Link>}
        </div>
        <p className="footer-meta">© 2026 Solariun. Made in Nigeria.</p>
      </div>
    </footer>
  );
}
