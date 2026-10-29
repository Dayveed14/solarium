// Runs after `vite build`. Gives search engines and link-preview bots real HTML without running JavaScript:
//  * dist/app-shell.html  the generic page every other route falls back to
//  * dist/<route>/index.html  per-page title, description, canonical and social tags for the public pages
//  * dist/robots.txt and dist/sitemap.xml (products and deals included when the API is reachable)
// Settings: VITE_SITE_URL (required for real canonical links), SEO_API_URL (optional, for the product sitemap).
import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve('dist');
const siteUrl = (process.env.VITE_SITE_URL || '').replace(/\/$/, '');
const apiUrl = (process.env.SEO_API_URL || '').replace(/\/$/, '');
if (!siteUrl) console.warn('[seo] VITE_SITE_URL is not set: canonical links, sitemap and robots.txt will use relative/empty URLs. Set it in Vercel.');

const PAGES = {
  '/': {
    title: 'Solariun: Reliable solar power for your home & business in Nigeria',
    description: 'Find out what your generator and light bill really cost, see what solar would save, and switch by buying, leasing or paying monthly with vetted solar providers in Lagos and Abuja.',
    body: '<h1>Reliable solar power for your home &amp; business.</h1><p>Solariun shows what your generator and light bill really cost, what solar would save, and how to switch by buying, leasing or paying monthly with vetted providers in Lagos and Abuja.</p><p><a href="/shop">Shop solar products</a></p>',
  },
  '/partners': {
    title: 'Solar installers, vendors and companies in Nigeria | Solariun Partners',
    description: 'Verified solar sellers, installation companies and installers on Solariun, sortable by state and area in Lagos and Abuja.',
    body: '<h1>Solariun Partners</h1><p>Verified solar sellers, installation companies and installers on Solariun, sortable by state and area in Lagos and Abuja.</p>',
  },
  '/blog': {
    title: 'Solar guides and news for homes and businesses in Nigeria | Solariun Blog',
    description: 'Practical articles on solar power, inverters, batteries, costs and saving on fuel and electricity in Nigeria.',
    body: '<h1>Solariun Blog</h1><p>Practical articles on solar power, inverters, batteries, costs and saving on fuel and electricity in Nigeria.</p>',
  },
  '/shop': {
    title: 'Buy solar panels, inverters, batteries & more in Lagos and Abuja | Solariun',
    description: 'Shop solar panels, inverters, batteries, charge controllers, cables, pumps, streetlights and complete kits from verified vendors near you, with delivery prices shown up front.',
    body: '<h1>Solar products in Lagos and Abuja</h1><p>Solar panels, inverters, batteries, charge controllers, cables, pumps, streetlights and complete kits from verified vendors, with delivery prices shown up front.</p>',
  },
};

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const abs = (p) => `${siteUrl}${p}`;
const base = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');

function render(route, page) {
  let html = base;
  const set = (re, to) => { html = html.replace(re, to); };
  set(/<title>.*?<\/title>/s, `<title>${esc(page.title)}</title>`);
  set(/<meta\s+name="description"[^>]*>/s, `<meta name="description" content="${esc(page.description)}" />`);
  const tags = [
    `<link rel="canonical" href="${abs(route === '/' ? '/' : route)}" />`,
    '<meta name="robots" content="index, follow, max-image-preview:large" />',
    '<meta property="og:site_name" content="Solariun" />',
    `<meta property="og:type" content="${page.type ?? 'website'}" />`,
    `<meta property="og:title" content="${esc(page.title)}" />`,
    `<meta property="og:description" content="${esc(page.description)}" />`,
    `<meta property="og:url" content="${abs(route)}" />`,
    `<meta property="og:image" content="${page.image ?? abs('/og-image.png')}" />`,
    '<meta property="og:locale" content="en_NG" />',
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${esc(page.title)}" />`,
    `<meta name="twitter:description" content="${esc(page.description)}" />`,
    `<meta name="twitter:image" content="${page.image ?? abs('/og-image.png')}" />`,
  ];
  // Drop the shell's own generic tags so nothing is duplicated, then add this page's.
  html = html.replace(/\s*<link rel="canonical"[^>]*>/g, '').replace(/\s*<meta (property="og:|name="twitter:|name="robots")[^>]*>/g, '');
  html = html.replace('</head>', `    ${tags.join('\n    ')}\n  </head>`);
  if (page.body) html = html.replace('<div id="root"></div>', `<div id="root"></div>\n    <noscript>${page.body}</noscript>`);
  return html;
}

// The shell: generic, no canonical (the app sets it), used for every non-prerendered route.
fs.writeFileSync(path.join(dist, 'app-shell.html'), base);
for (const [route, page] of Object.entries(PAGES)) {
  const out = route === '/' ? path.join(dist, 'index.html') : path.join(dist, route.slice(1), 'index.html');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, render(route, page));
}

const urls = [{ loc: '/', priority: '1.0' }, { loc: '/shop', priority: '0.9' }, { loc: '/partners', priority: '0.7' }, { loc: '/blog', priority: '0.8' }];

// Blog articles: each gets its own page with its heading, summary and text for search engines (needs SEO_API_URL).
let articleCount = 0;
if (apiUrl) {
  try {
    const list = (await (await fetch(`${apiUrl}/api/blog?limit=50`, { signal: AbortSignal.timeout(15000) })).json()).articles ?? [];
    for (const a of list) {
      const full = (await (await fetch(`${apiUrl}/api/blog/${encodeURIComponent(a.slug)}`, { signal: AbortSignal.timeout(15000) })).json()).article;
      if (!full) continue;
      const route = `/blog/${a.slug}`;
      const paras = full.body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean).map((p) => (p.startsWith('## ') ? `<h2>${esc(p.slice(3))}</h2>` : `<p>${esc(p)}</p>`)).join('');
      const out = path.join(dist, 'blog', a.slug, 'index.html');
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, render(route, { title: `${full.title} | Solariun`, description: full.summary, body: `<article><h1>${esc(full.title)}</h1>${paras}</article>`, image: full.imageUrl ? `${apiUrl}${full.imageUrl}` : null, type: 'article' }));
      urls.push({ loc: route, priority: '0.6' });
      articleCount += 1;
    }
  } catch (e) { console.warn(`[seo] could not read blog articles: ${e.message}`); }
}

// robots.txt
const robots = [
  'User-agent: *',
  'Allow: /',
  'Disallow: /app',
  'Disallow: /cart',
  'Disallow: /checkout',
  'Disallow: /login',
  'Disallow: /signup',
  'Disallow: /verify',
  'Disallow: /forgot-password',
  'Disallow: /reset-password',
  'Disallow: /results',
  'Disallow: /dispatch',
  'Disallow: /vendor/fee',
  'Disallow: /installation',
  'Disallow: /api/',
  siteUrl ? `Sitemap: ${siteUrl}/sitemap.xml` : '',
].filter(Boolean).join('\n') + '\n';
fs.writeFileSync(path.join(dist, 'robots.txt'), robots);

// sitemap.xml
if (apiUrl) {
  for (const state of ['lagos', 'abuja']) {
    try {
      const get = async (p) => (await fetch(`${apiUrl}/api${p}`, { signal: AbortSignal.timeout(15000) })).json();
      for (const p of (await get(`/shop/products?state=${state}`)).products ?? []) urls.push({ loc: `/shop/product/${p.id}`, priority: '0.7' });
      for (const d of (await get(`/shop/deals?state=${state}`)).deals ?? []) urls.push({ loc: `/shop/deal/${d.id}`, priority: '0.7' });
    } catch (e) { console.warn(`[seo] could not read ${state} products for the sitemap: ${e.message}`); }
  }
} else console.warn('[seo] SEO_API_URL not set: the sitemap lists only the main pages.');
const seen = new Set();
const today = new Date().toISOString().slice(0, 10);
const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.filter((u) => !seen.has(u.loc) && seen.add(u.loc)).map((u) => `  <url><loc>${abs(u.loc)}</loc><lastmod>${today}</lastmod><priority>${u.priority}</priority></url>`).join('\n')}\n</urlset>\n`;
fs.writeFileSync(path.join(dist, 'sitemap.xml'), xml);
console.log(`[seo] prerendered ${Object.keys(PAGES).length} pages + ${articleCount} articles, robots.txt, sitemap.xml with ${seen.size} URLs`);
