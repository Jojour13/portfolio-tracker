// Folio's bear mascot. Red, bloodshot eyes, a little steam — shown when the
// portfolio / timeframe is down. Same thick-outline style as the bull.
export function Bear({ size = 160 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Bearish"
    >
      <defs>
        <linearGradient id="bearFace" x1="40" y1="40" x2="160" y2="170">
          <stop stopColor="#f87171" />
          <stop offset="1" stopColor="#b91c1c" />
        </linearGradient>
      </defs>

      {/* steam puffs */}
      <g fill="#fca5a5" opacity="0.8">
        <circle cx="44" cy="40" r="7" />
        <circle cx="34" cy="28" r="5" />
        <circle cx="156" cy="40" r="7" />
        <circle cx="166" cy="28" r="5" />
      </g>

      {/* ears */}
      <circle cx="54" cy="62" r="20" fill="#991b1b" stroke="#0f172a" strokeWidth="5" />
      <circle cx="146" cy="62" r="20" fill="#991b1b" stroke="#0f172a" strokeWidth="5" />
      <circle cx="54" cy="62" r="9" fill="#7f1d1d" />
      <circle cx="146" cy="62" r="9" fill="#7f1d1d" />

      {/* face */}
      <path
        d="M58 66c12-12 72-12 84 0 14 14 14 56 0 74-14 18-70 18-84 0-14-18-14-60 0-74z"
        fill="url(#bearFace)"
        stroke="#0f172a"
        strokeWidth="5"
        strokeLinejoin="round"
      />

      {/* angry brows */}
      <path d="M66 96l30 12" stroke="#0f172a" strokeWidth="6" strokeLinecap="round" />
      <path d="M134 96l-30 12" stroke="#0f172a" strokeWidth="6" strokeLinecap="round" />

      {/* bloodshot eyes */}
      <circle cx="80" cy="116" r="11" fill="#fff" stroke="#0f172a" strokeWidth="3" />
      <circle cx="120" cy="116" r="11" fill="#fff" stroke="#0f172a" strokeWidth="3" />
      <circle cx="80" cy="117" r="5" fill="#0f172a" />
      <circle cx="120" cy="117" r="5" fill="#0f172a" />
      <g stroke="#ef4444" strokeWidth="1.5">
        <path d="M73 113l5 3M74 120l6-2M127 113l-5 3M126 120l-6-2" />
      </g>

      {/* snout + frown */}
      <ellipse cx="100" cy="142" rx="30" ry="20" fill="#7f1d1d" stroke="#0f172a" strokeWidth="5" />
      <circle cx="100" cy="136" r="6" fill="#0f172a" />
      <path
        d="M84 156c8-8 24-8 32 0"
        stroke="#0f172a"
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
