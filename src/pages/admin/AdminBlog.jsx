import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api.js';
import ArticleBody from '../../components/ArticleBody.jsx';
import ImageField from '../../components/ImageField.jsx';
import { formatDate } from '../../lib/format.js';

const empty = { id: null, title: '', summary: '', body: '', imageId: null, imageUrl: null, status: 'draft', slug: null };

// The admin writes articles: a heading, a picture and text. Drafts stay private until published.
export default function AdminBlog() {
  const [list, setList] = useState(null);
  const [form, setForm] = useState(null);
  const [preview, setPreview] = useState(false);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => api.adminBlogList().then((r) => setList(r.articles)).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const edit = async (id) => {
    setError(null); setErrors({}); setPreview(false);
    if (id == null) { setForm({ ...empty }); return; }
    try { setForm((await api.adminBlogGet(id)).article); } catch (e) { setError(e.message); }
  };

  const save = async (status) => {
    setSaving(true); setError(null); setErrors({});
    const body = { title: form.title.trim(), summary: form.summary.trim(), body: form.body.trim(), imageId: form.imageId ?? null, status };
    try {
      if (form.id) await api.adminBlogUpdate(form.id, body); else await api.adminBlogCreate(body);
      setForm(null);
      await load();
    } catch (e) {
      if (e.code === 'VALIDATION_ERROR') setErrors(e.details?.fields ?? {}); else setError(e.message);
    }
    setSaving(false);
  };

  const remove = async (a) => {
    if (!window.confirm(`Delete "${a.title}"? This cannot be undone.`)) return;
    try { await api.adminBlogDelete(a.id); await load(); } catch (e) { setError(e.message); }
  };

  if (form) {
    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
    return (
      <>
        <div className="section-head"><h2 className="dash-h2">{form.id ? 'Edit article' : 'New article'}</h2></div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="profile-form blog-form">
          <label className="field"><span>Heading</span><input type="text" maxLength={160} value={form.title} onChange={set('title')} aria-invalid={Boolean(errors.title)} />{errors.title && <small className="err">{errors.title}</small>}</label>
          <ImageField label="Picture" imageId={form.imageId} imageUrl={form.imageUrl} onChange={(id) => setForm((f) => ({ ...f, imageId: id }))} upload={api.adminUploadImage} />
          <label className="field"><span>Short summary <em>(optional; shown in lists and search results)</em></span><input type="text" maxLength={300} value={form.summary} onChange={set('summary')} /></label>
          <label className="field">
            <span>Text</span>
            <textarea rows={16} value={form.body} onChange={set('body')} aria-invalid={Boolean(errors.body)} />
            {errors.body ? <small className="err">{errors.body}</small> : <small>Leave a blank line between paragraphs. Start a line with <code>## </code> for a sub-heading.</small>}
          </label>
          <div className="row-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setPreview((p) => !p)}>{preview ? 'Hide preview' : 'Preview'}</button>
            <button type="button" className="btn btn-quiet" disabled={saving} onClick={() => save('draft')}>Save as draft</button>
            <button type="button" className="btn btn-primary" disabled={saving} onClick={() => save('published')}>{form.status === 'published' ? 'Save and keep published' : 'Publish'}</button>
            <button type="button" className="btn btn-quiet" onClick={() => setForm(null)}>Cancel</button>
          </div>
          {preview && <div className="review-box"><h1>{form.title || 'Heading'}</h1><ArticleBody text={form.body || 'Your text will appear here.'} /></div>}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="section-head">
        <div><h2 className="dash-h2">Blog</h2><p className="muted">Articles appear on the home page and on the Blog page once published.</p></div>
        <button type="button" className="btn btn-primary" onClick={() => edit(null)}>New article</button>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {!list && !error && <p className="muted" role="status">Loading…</p>}
      {list?.length === 0 && <div className="empty-card"><h3>No articles yet</h3><p>Write your first one.</p></div>}
      <ul className="doc-list">
        {list?.map((a) => (
          <li key={a.id}>
            <div><strong>{a.title}</strong><small>{a.status === 'published' ? `Published ${formatDate(a.publishedAt)}` : 'Draft'}</small></div>
            <div className="row-actions">
              {a.status === 'published' && <a className="btn btn-ghost btn-small" href={`/blog/${a.slug}`} target="_blank" rel="noopener noreferrer">View</a>}
              <button type="button" className="btn btn-ghost btn-small" onClick={() => edit(a.id)}>Edit</button>
              <button type="button" className="btn btn-quiet btn-small" onClick={() => remove(a)}>Delete</button>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
