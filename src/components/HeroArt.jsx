// An original illustration for the home page hero: a home with solar panels under a bright sun, an inverter and battery
// beside it, and a green orbit around it all. Pure SVG, so it stays sharp and weighs next to nothing.
export default function HeroArt() {
  const rays = Array.from({ length: 16 }, (_, i) => i * 22.5);
  return (
    <div className="hero-art" aria-hidden="true">
      <svg viewBox="0 0 480 400" role="presentation">
        <defs>
          <linearGradient id="ha-sun" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fde68a" /><stop offset="1" stopColor="#f57c00" />
          </linearGradient>
          <linearGradient id="ha-panel" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#22c55e" /><stop offset="1" stopColor="#0b5d3b" />
          </linearGradient>
          <linearGradient id="ha-hill1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#22c55e" /><stop offset="1" stopColor="#0b5d3b" />
          </linearGradient>
          <radialGradient id="ha-halo" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#fde68a" stopOpacity="0.55" /><stop offset="1" stopColor="#fde68a" stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle cx="340" cy="108" r="120" fill="url(#ha-halo)" />
        <g className="sun-rays" stroke="#fcd34d" strokeWidth="5" strokeLinecap="round" opacity="0.9">
          {rays.map((a) => (
            <line key={a} x1="340" y1="30" x2="340" y2={a % 45 === 0 ? 16 : 22} transform={`rotate(${a} 340 108)`} />
          ))}
        </g>
        <circle cx="340" cy="108" r="58" fill="url(#ha-sun)" />

        {/* orbit */}
        <ellipse cx="240" cy="236" rx="222" ry="92" fill="none" stroke="#86efac" strokeOpacity="0.55" strokeWidth="2.5" strokeDasharray="2 9" strokeLinecap="round" transform="rotate(-8 240 236)" />
        <circle className="orbit-dot" cx="452" cy="206" r="9" fill="#22c55e" />
        <path className="orbit-dot" d="M452 198c5 1 8 5 7 10-5-1-8-5-7-10z" fill="#bbf7d0" />

        {/* ground */}
        <path d="M0 330 C80 300 160 316 240 320 S400 300 480 322 V400 H0 Z" fill="url(#ha-hill1)" />
        <path d="M0 362 C100 342 200 360 300 352 S440 340 480 352 V400 H0 Z" fill="#063d27" opacity="0.55" />

        {/* house */}
        <rect x="132" y="236" width="208" height="112" rx="6" fill="#f5f7fa" />
        <polygon points="112,240 236,152 360,240" fill="#0a4a31" />
        <polygon points="112,240 236,152 360,240" fill="none" stroke="#0d5a3a" strokeWidth="4" strokeLinejoin="round" />
        {/* solar panels on the roof */}
        <g transform="rotate(-35 196 214)">
          <rect x="164" y="204" width="58" height="34" rx="3" fill="url(#ha-panel)" stroke="#bbf7d0" strokeWidth="2" />
          <path d="M183 204v34M202 204v34M164 221h58" stroke="#bbf7d0" strokeWidth="1.5" opacity="0.8" />
        </g>
        <g transform="rotate(35 276 214)">
          <rect x="250" y="204" width="58" height="34" rx="3" fill="url(#ha-panel)" stroke="#bbf7d0" strokeWidth="2" />
          <path d="M269 204v34M288 204v34M250 221h58" stroke="#bbf7d0" strokeWidth="1.5" opacity="0.8" />
        </g>
        {/* door and windows */}
        <rect x="216" y="286" width="40" height="62" rx="4" fill="#0b5d3b" />
        <circle cx="248" cy="318" r="2.5" fill="#fcd34d" />
        <rect className="win-glow" x="148" y="272" width="46" height="40" rx="4" fill="#fcd34d" />
        <rect className="win-glow" x="278" y="272" width="46" height="40" rx="4" fill="#fcd34d" />
        <path d="M171 272v40M148 292h46M301 272v40M278 292h46" stroke="#f5f7fa" strokeWidth="3" opacity="0.7" />

        {/* inverter and battery */}
        <rect x="372" y="268" width="64" height="82" rx="10" fill="#0b5d3b" stroke="#22c55e" strokeWidth="3" />
        <rect x="384" y="280" width="40" height="22" rx="4" fill="#063d27" />
        <path d="M406 283l-9 11h7l-2 8 9-12h-7l2-7z" fill="#fbbf24" />
        <rect x="384" y="312" width="40" height="8" rx="3" fill="#22c55e" />
        <rect x="384" y="326" width="28" height="8" rx="3" fill="#22c55e" opacity="0.6" />
        <path d="M340 322 C354 322 360 318 372 318" fill="none" stroke="#fbbf24" strokeWidth="3.5" strokeLinecap="round" strokeDasharray="1 7" />
      </svg>
    </div>
  );
}
