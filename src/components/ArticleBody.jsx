import { Fragment } from 'react';

// Shows an article's text. The text is plain and is rendered as React elements, never as HTML, so nothing an author
// types can run on the page. What it understands:
//   a blank line (even one with stray spaces)  -> new paragraph; extra blank lines are ignored
//   ## Heading  /  ### Smaller heading         -> headings
//   - item  or  * item                         -> bullet list;   1. item -> numbered list
//   > text                                     -> a pull-quote
//   **bold**  and  [link text](https://...)    -> bold and links (http, https and /paths only)
//   [[image:12|Caption]]                       -> a picture on its own line, with an optional caption
const IMG_ONLY = /^\[\[image:(\d{1,12})\|([^\]\n]{0,200})\]\]$/;
const IMG_API = import.meta.env.VITE_API_URL ?? '';

const safeHref = (u) => (/^(https?:\/\/|\/(?!\/))/i.test(u) ? u : null);

// **bold** and [text](url) inside a line.
function inline(text, keyBase) {
  const out = [];
  const re = /\*\*([^*\n]+)\*\*|\[([^\]\n]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m;
  let n = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] != null) out.push(<strong key={`${keyBase}-${n++}`}>{m[1]}</strong>);
    else {
      const href = safeHref(m[3]);
      out.push(href
        ? <a key={`${keyBase}-${n++}`} href={href} {...(href.startsWith('/') ? {} : { target: '_blank', rel: 'noopener noreferrer' })}>{m[2]}</a>
        : m[2]);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const lines = (text, key) => text.split('\n').map((line, j) => <Fragment key={j}>{j > 0 && <br />}{inline(line.trim(), `${key}-${j}`)}</Fragment>);

export function parseBlocks(text) {
  // Lines holding only spaces (including non-breaking spaces from pasted text) count as blank.
  const cleaned = String(text).replace(/\r\n?/g, '\n').replace(/[ \t ​]+$/gm, '');
  return cleaned.split(/\n{2,}/).map((b) => b.replace(/^\n+|\n+$/g, '')).filter((b) => b.trim());
}

export default function ArticleBody({ text }) {
  const blocks = parseBlocks(text);
  return (
    <div className="article-body">
      {blocks.map((b, i) => {
        const t = b.trim();
        const img = IMG_ONLY.exec(t);
        if (img) {
          return (
            <figure key={i} className="article-figure">
              <img src={`${IMG_API}/api/images/${img[1]}`} alt={img[2] || ''} loading="lazy" />
              {img[2] && <figcaption>{img[2]}</figcaption>}
            </figure>
          );
        }
        if (/^###\s+/.test(t)) return <h3 key={i}>{inline(t.replace(/^###\s+/, ''), i)}</h3>;
        if (/^##\s+/.test(t)) return <h2 key={i}>{inline(t.replace(/^##\s+/, ''), i)}</h2>;
        const rows = t.split('\n');
        if (rows.every((r) => /^\s*[-*•]\s+/.test(r))) return <ul key={i}>{rows.map((r, j) => <li key={j}>{inline(r.replace(/^\s*[-*•]\s+/, ''), `${i}-${j}`)}</li>)}</ul>;
        if (rows.every((r) => /^\s*\d+[.)]\s+/.test(r))) return <ol key={i}>{rows.map((r, j) => <li key={j}>{inline(r.replace(/^\s*\d+[.)]\s+/, ''), `${i}-${j}`)}</li>)}</ol>;
        if (rows.every((r) => /^\s*>\s?/.test(r))) return <blockquote key={i}>{lines(rows.map((r) => r.replace(/^\s*>\s?/, '')).join('\n'), i)}</blockquote>;
        return <p key={i}>{lines(t, i)}</p>;
      })}
    </div>
  );
}
