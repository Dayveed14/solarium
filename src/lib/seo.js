// One place for what search engines and link previews see. Public pages are listed in PUBLIC_PAGES;
// every other route (accounts, cart, checkout, 404) is marked noindex by RouteSeo.
export const SITE_NAME = 'Solalium';
export const TAGLINE = 'Clean energy. Lasting value.';
export const SITE_URL = (import.meta.env.VITE_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
export const OG_IMAGE = '/og-image.png';

export const PUBLIC_PAGES = {
  '/': {
    title: 'Solalium: Reliable solar power for your home & business in Nigeria',
    description: 'Find out what your generator and light bill really cost, see what solar would save, and switch by buying, leasing or paying monthly with vetted solar providers in Lagos and Abuja.',
  },
  '/blog': {
    title: 'Solar guides and news for homes and businesses in Nigeria | Solalium Blog',
    description: 'Practical articles on solar power, inverters, batteries, costs and saving on fuel and electricity in Nigeria.',
  },
  '/shop': {
    title: 'Buy solar panels, inverters, batteries & more in Lagos and Abuja | Solalium',
    description: 'Shop solar panels, inverters, batteries, charge controllers, cables, pumps, streetlights and complete kits from verified vendors near you, with delivery prices shown up front.',
  },
};

// Path prefixes that must never be indexed (private, transactional or one-time pages).
export const PRIVATE_PREFIXES = ['/app', '/cart', '/checkout', '/login', '/signup', '/verify', '/forgot-password', '/reset-password', '/results', '/dispatch', '/vendor/fee', '/installation'];

export const isPrivatePath = (path) => PRIVATE_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
export const absolute = (path) => (/^https?:/.test(path) ? path : `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`);

const upsert = (selector, create, set) => {
  let el = document.head.querySelector(selector);
  if (!el) { el = create(); document.head.appendChild(el); }
  set(el);
};
const meta = (attr, key, content) => upsert(`meta[${attr}="${key}"]`, () => { const m = document.createElement('meta'); m.setAttribute(attr, key); return m; }, (m) => m.setAttribute('content', content));

// Writes the head tags for the current page. Safe to call again on every navigation.
export function applySeo({ title, description, path, image = OG_IMAGE, noindex = false, type = 'website', jsonLd = null }) {
  const full = title || `${SITE_NAME}: ${TAGLINE}`;
  document.title = full;
  if (description) meta('name', 'description', description);
  meta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large');
  const url = absolute(path ?? window.location.pathname);
  upsert('link[rel="canonical"]', () => { const l = document.createElement('link'); l.rel = 'canonical'; return l; }, (l) => { l.href = url; });
  meta('property', 'og:site_name', SITE_NAME);
  meta('property', 'og:type', type);
  meta('property', 'og:title', full);
  if (description) meta('property', 'og:description', description);
  meta('property', 'og:url', url);
  meta('property', 'og:image', absolute(image));
  meta('property', 'og:locale', 'en_NG');
  meta('name', 'twitter:card', 'summary_large_image');
  meta('name', 'twitter:title', full);
  if (description) meta('name', 'twitter:description', description);
  meta('name', 'twitter:image', absolute(image));
  document.head.querySelectorAll('script[data-seo-jsonld]').forEach((n) => n.remove());
  if (jsonLd && !noindex) {
    const s = document.createElement('script');
    s.type = 'application/ld+json';
    s.dataset.seoJsonld = '1';
    s.textContent = JSON.stringify(jsonLd);
    document.head.appendChild(s);
  }
}

export const organizationLd = () => ({
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'Organization', '@id': `${SITE_URL}/#org`, name: SITE_NAME, url: SITE_URL, logo: absolute('/icon-512.png'), slogan: TAGLINE, areaServed: ['Lagos', 'Abuja', 'Nigeria'] },
    { '@type': 'WebSite', '@id': `${SITE_URL}/#site`, url: SITE_URL, name: SITE_NAME, publisher: { '@id': `${SITE_URL}/#org` } },
  ],
});
