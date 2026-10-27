import { Link } from 'react-router-dom';

export default function SiteFooter() {
  return (
    <footer className="footer">
      <div className="wrap footer-grid">
        <div className="footer-brand">
          <Link to="/" className="brand">
            <img src="/logo-mark.svg" height="30" alt="" className="brand-logo" />
            <span className="brand-word">Solalium</span>
          </Link>
          <p>Clean energy. Lasting value.</p>
        </div>
        <div className="footer-links">
          <Link to="/#how">How it works</Link>
          <Link to="/blog">Blog</Link>
          <Link to="/#platform">Platform</Link>
          <Link to="/#providers">For providers</Link>
          <Link to="/login">Log in</Link>
        </div>
        <p className="footer-meta">© 2026 Solalium. Made in Abuja.</p>
      </div>
    </footer>
  );
}
