import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import Seo from '../components/Seo.jsx';
import { PUBLIC_PAGES } from '../lib/seo.js';
import { formatDate } from '../lib/format.js';

export const imgSrc = (url) => (url ? `${import.meta.env.VITE_API_URL ?? ''}${url}` : null);

const SECTION_LABEL = { news: 'News', stories: 'Stories', events: 'Events' };
const CATEGORY_LABEL = { news: 'News', 'user-guide': 'User guide', 'maintenance-tips': 'Maintenance tips', industry: 'Industry', 'product-updates': 'Product updates', testimonials: 'Testimonials', community: 'Community', entertainment: 'Entertainment', events: 'Events' };
export const categoryLabel = (k) => CATEGORY_LABEL[k] ?? k;
export const sectionLabel = (k) => SECTION_LABEL[k] ?? k;

export function ArticleCard({ a }) {
  return (
    <Link to={`/blog/${a.slug}`} className="article-card">
      {a.imageUrl ? <img src={imgSrc(a.imageUrl)} alt="" loading="lazy" /> : <div className="article-noimg" aria-hidden="true" />}
      <div>
        <div className="article-tags"><span className="tag tag-section">{sectionLabel(a.section)}</span>{a.category !== a.section && <span className="tag">{categoryLabel(a.category)}</span>}</div>
        {a.section === 'events' && a.eventDate && <p className="event-line">{formatDate(a.eventDate)}{a.eventPlace ? ` · ${a.eventPlace}` : ''}</p>}
        <small>{formatDate(a.publishedAt)}</small>
        <h3>{a.title}</h3>
        <p>{a.summary}</p>
      </div>
    </Link>
  );
}

export default function Blog() {
  const [params, setParams] = useSearchParams();
  const section = params.get('section') || '';
  const category = params.get('category') || '';
  const [articles, setArticles] = useState(null);
  const [taxonomy, setTaxonomy] = useState({ sections: [], categories: [] });
  const [error, setError] = useState(null);
  useEffect(() => {
    let cancelled = false;
    setArticles(null); setError(null);
    api.blogList(undefined, { section, category })
      .then((r) => { if (cancelled) return; setArticles(r.articles); setTaxonomy({ sections: r.sections ?? [], categories: r.categories ?? [] }); })
      .catch((e) => !cancelled && setError(e.message));
    return () => { cancelled = true; };
  }, [section, category]);

  const choose = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next, { replace: true });
  };
  return (
    <div className="wrap blog-wrap">
      <Seo {...PUBLIC_PAGES['/blog']} path="/blog" />
      <h1>TerraVoltix Blog</h1>
      <p className="muted">News, stories and events, plus plain-English guides on energy products, costs and getting the most from your power.</p>
      <div className="blog-tabs" role="group" aria-label="Sections">
        <button type="button" aria-pressed={!section} onClick={() => choose('section', '')}>All</button>
        {(taxonomy.sections.length ? taxonomy.sections : [{ key: 'news', label: 'News' }, { key: 'stories', label: 'Stories' }, { key: 'events', label: 'Events' }]).map((s) => (
          <button key={s.key} type="button" aria-pressed={section === s.key} onClick={() => choose('section', s.key)}>{s.label}</button>
        ))}
      </div>
      {taxonomy.categories.length > 0 && (
        <div className="blog-chips" role="group" aria-label="Categories">
          <button type="button" aria-pressed={!category} onClick={() => choose('category', '')}>All topics</button>
          {taxonomy.categories.map((c) => <button key={c.key} type="button" aria-pressed={category === c.key} onClick={() => choose('category', c.key)}>{c.label}</button>)}
        </div>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
      {!articles && !error && <p className="muted" role="status">Loading…</p>}
      {articles?.length === 0 && <div className="empty-card"><h3>Nothing here yet</h3><p>{section || category ? 'No articles match this filter yet.' : 'Check back soon.'}</p></div>}
      <div className="article-grid">{articles?.map((a) => <ArticleCard key={a.slug} a={a} />)}</div>
    </div>
  );
}
