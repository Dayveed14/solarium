// Shows an article's text. The text is plain: blank lines separate paragraphs and a line starting with "## " is a
// sub-heading. It is rendered as text, never as HTML, so nothing an author types can run on the page.
export default function ArticleBody({ text }) {
  const blocks = String(text).replace(/\r\n/g, '\n').split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className="article-body">
      {blocks.map((b, i) => {
        if (/^##\s+/.test(b)) return <h2 key={i}>{b.replace(/^##\s+/, '')}</h2>;
        return <p key={i}>{b.split('\n').map((line, j) => <span key={j}>{j > 0 && <br />}{line}</span>)}</p>;
      })}
    </div>
  );
}
