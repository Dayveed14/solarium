import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import ArticleBody from '../components/ArticleBody.jsx';
import Seo from '../components/Seo.jsx';
import { SITE_NAME, SITE_URL, absolute } from '../lib/seo.js';
import { formatDate } from '../lib/format.js';
import NotFound from './NotFound.jsx';
import { imgSrc } from './Blog.jsx';

export default function BlogPost() {
  const { slug } = useParams();
  const [a, setA] = useState(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    setA(null); setMissing(false);
    api.blogGet(slug).then((r) => setA(r.article)).catch(() => setMissing(true));
  }, [slug]);

  if (missing) return <NotFound />;
  if (!a) return <div className="wrap blog-wrap"><p className="muted" role="status">Loading…</p></div>;

  const image = a.imageUrl ? absolute(a.imageUrl.startsWith('/api') && import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}${a.imageUrl}` : a.imageUrl) : undefined;
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'Article', headline: a.title, description: a.summary,
    datePublished: a.publishedAt, dateModified: a.updatedAt, ...(image ? { image: [image] } : {}),
    author: { '@type': 'Organization', name: SITE_NAME }, publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
    mainEntityOfPage: absolute(`/blog/${a.slug}`),
  };
  return (
    <article className="wrap blog-wrap article-page">
      <Seo title={`${a.title} | ${SITE_NAME}`} description={a.summary} path={`/blog/${a.slug}`} image={image} type="article" jsonLd={jsonLd} />
      <p><Link to="/blog">← All articles</Link></p>
      <h1>{a.title}</h1>
      <p className="muted">{formatDate(a.publishedAt)}</p>
      {a.imageUrl && <img className="article-hero" src={imgSrc(a.imageUrl)} alt="" />}
      <ArticleBody text={a.body} />
      <p className="article-cta"><Link to="/shop" className="btn btn-primary">Browse solar products</Link></p>
    </article>
  );
}
