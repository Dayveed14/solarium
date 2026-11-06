import { useEffect, useRef, useState } from 'react';

// A box the owner signs in with a finger or a pen. Hands back a PNG when they accept it.
export default function SignaturePad({ onSave, disabled, saved }) {
  const ref = useRef(null);
  const drawing = useRef(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const c = ref.current;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * ratio;
    c.height = c.offsetHeight * ratio;
    const ctx = c.getContext('2d');
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.strokeStyle = '#111';
  }, []);

  const pos = (e) => { const r = ref.current.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const down = (e) => { if (disabled) return; drawing.current = true; ref.current.setPointerCapture(e.pointerId); const ctx = ref.current.getContext('2d'); ctx.beginPath(); ctx.moveTo(...pos(e)); };
  const move = (e) => { if (!drawing.current) return; const ctx = ref.current.getContext('2d'); ctx.lineTo(...pos(e)); ctx.stroke(); setDirty(true); };
  const up = () => { drawing.current = false; };
  const clear = () => { const c = ref.current; c.getContext('2d').clearRect(0, 0, c.width, c.height); setDirty(false); };
  const save = () => {
    const src = ref.current;
    // White background so the saved picture reads on any screen.
    const out = document.createElement('canvas');
    out.width = src.width; out.height = src.height;
    const ctx = out.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, out.width, out.height); ctx.drawImage(src, 0, 0);
    out.toBlob((b) => b && onSave(b), 'image/png');
  };

  return (
    <div className="sig">
      <canvas ref={ref} className="sig-canvas" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} aria-label="Signature box" />
      <div className="row-actions">
        <button type="button" className="btn btn-quiet btn-small" onClick={clear} disabled={disabled || !dirty}>Clear</button>
        <button type="button" className="btn btn-primary btn-small" onClick={save} disabled={disabled || !dirty}>{saved ? 'Replace signature' : 'Save signature'}</button>
      </div>
    </div>
  );
}
