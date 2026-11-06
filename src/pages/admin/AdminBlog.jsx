import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../api.js';
import ArticleBody from '../../components/ArticleBody.jsx';
import ImageField from '../../components/ImageField.jsx';
import { formatDate } from '../../lib/format.js';
import { categoryLabel, sectionLabel } from '../Blog.jsx';

const empty = { id: null, title: '', summary: '', body: '', imageId: null, imageUrl: null, status: 'draft', slug: null, section: 'news', category: 'news', eventDate: '', eventPlace: '' };
const SECTIONS = [['news', 'News'], ['stories', 'Stories (testimonials, customer stories, articles)'], ['events', 'Events']];
const CATEGORIES = [['news', 'News'], ['user-guide', 'User guide'], ['maintenance-tips', 'Maintenance tips'], ['industry', 'Industry'], ['product-updates', 'Product updates'], ['testimonials', 'Testimonials'], ['community', 'Community'], ['entertainment', 'Entertainment'], ['events', 'Events']];

// Shrinks a photo in the browser before upload (phone photos are huge).
async function shrink(file, maxSide = 1400) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not read that picture.'))), 'image/jpeg', 0.85));
}

// The admin writes articles: a heading, a picture and text. Drafts stay private until published.
export default function AdminBlog() {
  const [list, setList] = useState(null);
  const [form, setForm] = useState(null);
  const [preview, setPreview] = useState(false);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const area = useRef(null);
  const fileInput = useRef(null);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(() => api.adminBlogList().then((r) => setList(r.articles)).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const edit = async (id) => {
    setError(null); setErrors({}); setPreview(false);
    if (id == null) { setForm({ ...empty }); return; }
    try { const a = (await api.adminBlogGet(id)).article; setForm({ ...a, eventDate: a.eventDate ?? '', eventPlace: a.eventPlace ?? '' }); } catch (e) { setError(e.message); }
  };

  const save = async (status) => {
    setSaving(true); setError(null); setErrors({});
    const body = { title: form.title.trim(), summary: form.summary.trim(), body: form.body.trim(), imageId: form.imageId ?? null, section: form.section, category: form.category, eventDate: form.section === 'events' ? form.eventDate || null : null, eventPlace: form.section === 'events' ? form.eventPlace.trim() || null : null, status };
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

    // Put text into the box at the cursor, or around the highlighted words, and keep the cursor sensible.
    const edit_ = (fn) => {
      const el = area.current;
      const start = el?.selectionStart ?? form.body.length;
      const end = el?.selectionEnd ?? form.body.length;
      const { text, from, to } = fn(form.body, start, end);
      setForm((f) => ({ ...f, body: text }));
      requestAnimationFrame(() => { if (el) { el.focus(); el.setSelectionRange(from, to); } });
    };
    const wrap = (mark, placeholder) => edit_((body, a, b) => {
      const chosen = body.slice(a, b) || placeholder;
      return { text: `${body.slice(0, a)}${mark}${chosen}${mark}${body.slice(b)}`, from: a + mark.length, to: a + mark.length + chosen.length };
    });
    // Starts a new line with a prefix such as "## " or "- ", on its own paragraph.
    const lineStart = (prefix, placeholder) => edit_((body, a, b) => {
      const chosen = body.slice(a, b) || placeholder;
      const pre = body.slice(0, a);
      const lead = pre === '' || pre.endsWith('\n\n') ? '' : pre.endsWith('\n') ? '\n' : '\n\n';
      const block = chosen.split('\n').map((l) => `${prefix}${l}`).join('\n');
      return { text: `${pre}${lead}${block}\n\n${body.slice(b).replace(/^\n+/, '')}`, from: pre.length + lead.length + prefix.length, to: pre.length + lead.length + block.length };
    });
    const addLink = () => {
      const url = window.prompt('Link address (starting with https://)');
      if (!url) return;
      edit_((body, a, b) => {
        const label = body.slice(a, b) || 'link text';
        const md = `[${label}](${url.trim()})`;
        return { text: `${body.slice(0, a)}${md}${body.slice(b)}`, from: a + 1, to: a + 1 + label.length };
      });
    };
    // Upload a picture and drop it into the text as its own block, where the cursor is.
    const addPicture = async (e) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { setError('Choose a JPEG, PNG or WebP picture.'); return; }
      setUploading(true); setError(null);
      try {
        const res = await api.adminUploadImage(await shrink(file));
        edit_((body, a) => {
          const pre = body.slice(0, a);
          const lead = pre === '' ? '' : pre.endsWith('\n\n') ? '' : pre.endsWith('\n') ? '\n' : '\n\n';
          const token = `[[image:${res.id}|]]`;
          return { text: `${pre}${lead}${token}\n\n${body.slice(a).replace(/^\n+/, '')}`, from: pre.length + lead.length + token.length - 2, to: pre.length + lead.length + token.length - 2 };
        });
      } catch (err) { setError(err.message || 'Could not upload that picture.'); }
      setUploading(false);
    };
    return (
      <>
        <div className="section-head"><h2 className="dash-h2">{form.id ? 'Edit article' : 'New article'}</h2></div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="profile-form blog-form">
          <label className="field"><span>Heading</span><input type="text" maxLength={160} value={form.title} onChange={set('title')} aria-invalid={Boolean(errors.title)} />{errors.title && <small className="err">{errors.title}</small>}</label>
          <ImageField label="Picture" imageId={form.imageId} imageUrl={form.imageUrl} onChange={(id) => setForm((f) => ({ ...f, imageId: id }))} upload={api.adminUploadImage} />
          <div className="two-col">
            <label className="field"><span>Section</span>
              <select value={form.section} onChange={set('section')}>{SECTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
            <label className="field"><span>Category</span>
              <select value={form.category} onChange={set('category')}>{CATEGORIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          </div>
          {form.section === 'events' && (
            <div className="two-col">
              <label className="field"><span>Event date</span><input type="date" value={form.eventDate} onChange={set('eventDate')} aria-invalid={Boolean(errors.eventDate)} />{errors.eventDate && <small className="err">{errors.eventDate}</small>}</label>
              <label className="field"><span>Place <em>(optional)</em></span><input type="text" maxLength={120} value={form.eventPlace} onChange={set('eventPlace')} placeholder="Abuja, or Online" /></label>
            </div>
          )}
          <label className="field"><span>Short summary <em>(optional; shown in lists and search results)</em></span><input type="text" maxLength={300} value={form.summary} onChange={set('summary')} /></label>
          <label className="field">
            <span>Text</span>
            <div className="editor-bar" role="toolbar" aria-label="Formatting">
              <button type="button" onClick={() => lineStart('## ', 'Heading')} title="Heading">H</button>
              <button type="button" onClick={() => lineStart('### ', 'Smaller heading')} title="Smaller heading">h</button>
              <button type="button" onClick={() => wrap('**', 'bold text')} title="Bold"><strong>B</strong></button>
              <button type="button" onClick={() => lineStart('- ', 'List item')} title="Bullet list">• List</button>
              <button type="button" onClick={() => lineStart('1. ', 'First step')} title="Numbered list">1. List</button>
              <button type="button" onClick={() => lineStart('> ', 'A quote')} title="Quote">Quote</button>
              <button type="button" onClick={addLink} title="Link">Link</button>
              <button type="button" onClick={() => fileInput.current?.click()} disabled={uploading} title="Put a picture here">{uploading ? 'Uploading…' : 'Picture'}</button>
              <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={addPicture} hidden />
            </div>
            <textarea ref={area} rows={18} value={form.body} onChange={set('body')} aria-invalid={Boolean(errors.body)} />
            {errors.body ? <small className="err">{errors.body}</small> : <small>Press Enter twice for a new paragraph. <strong>Picture</strong> puts a photo at the cursor; type its caption after the <code>|</code>. Use Preview to see it as readers will.</small>}
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
            <div><strong>{a.title}</strong><small>{sectionLabel(a.section)} · {categoryLabel(a.category)} · {a.status === 'published' ? `Published ${formatDate(a.publishedAt)}` : 'Draft'}</small></div>
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
