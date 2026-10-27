import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import Seo from '../components/Seo.jsx';
import { PUBLIC_PAGES } from '../lib/seo.js';
import { formatDate } from '../lib/format.js';

export const imgSrc = (url) => (url ? `${import.meta.env.VITE_API_URL ?? ''}${url}` : null);

export function ArticleCard({ a }) {
  return (
    <Link to={`/blog/${a.slug}`} className="article-card">
      {a.imageUrl ? <img src={imgSrc(a.imageUrl)} alt="" loading="lazy" /> : <div className="article-noimg" aria-hidden="true" />}
      <div>
        <small>{formatDate(a.publishedAt)}</small>
        <h3>{a.title}</h3>
        <p>{a.summary}</p>
      </div>
    </Link>
  );
}

export default function Blog() {
  const [articles, setArticles] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { api.blogList().then((r) => setArticles(r.articles)).catch((e) => setError(e.message)); }, []);
  return (
    <div className="wrap blog-wrap">
      <Seo {...PUBLIC_PAGES['/blog']} path="/blog" />
      <h1>Solalium Blog</h1>
      <p className="muted">Plain-English guides on solar power, costs and saving on fuel and electricity in Nigeria.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      {!articles && !error && <p className="muted" role="status">Loading…</p>}
      {articles?.length === 0 && <div className="empty-card"><h3>No articles yet</h3><p>Check back soon.</p></div>}
      <div className="article-grid">{articles?.map((a) => <ArticleCard key={a.slug} a={a} />)}</div>
    </div>
  );
}
