// "Banteng" — Folio's bull mascot. Green, wraparound shades with a star
// glint, a little gold chain. Shown when the portfolio / timeframe is up.
export function Bull({ size = 160 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Bullish"
    >
      <defs>
        <linearGradient id="bullFace" x1="40" y1="40" x2="160" y2="170">
          <stop stopColor="#34d399" />
          <stop offset="1" stopColor="#059669" />
        </linearGradient>
        <linearGradient id="bullHorn" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#f8fafc" />
          <stop offset="1" stopColor="#cbd5e1" />
        </linearGradient>
      </defs>

      {/* horns */}
      <path
        d="M52 64C30 50 18 58 16 40c20 6 34 6 46 16z"
        fill="url(#bullHorn)"
        stroke="#0f172a"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path
        d="M148 64c22-14 34-6 36-24-20 6-34 6-46 16z"
        fill="url(#bullHorn)"
        stroke="#0f172a"
        strokeWidth="4"
        strokeLinejoin="round"
      />

      {/* ears */}
      <ellipse cx="46" cy="86" rx="16" ry="11" fill="#047857" stroke="#0f172a" strokeWidth="4" />
      <ellipse cx="154" cy="86" rx="16" ry="11" fill="#047857" stroke="#0f172a" strokeWidth="4" />

      {/* face */}
      <path
        d="M58 70c10-8 74-8 84 0 12 10 14 44 0 64-12 17-72 17-84 0-14-20-12-54 0-64z"
        fill="url(#bullFace)"
        stroke="#0f172a"
        strokeWidth="5"
        strokeLinejoin="round"
      />

      {/* snout */}
      <ellipse cx="100" cy="138" rx="34" ry="22" fill="#065f46" stroke="#0f172a" strokeWidth="5" />
      <circle cx="88" cy="138" r="4" fill="#0f172a" />
      <circle cx="112" cy="138" r="4" fill="#0f172a" />

      {/* sunglasses */}
      <path d="M52 104h96" stroke="#0f172a" strokeWidth="6" strokeLinecap="round" />
      <rect x="56" y="98" width="38" height="22" rx="9" fill="#0f172a" />
      <rect x="106" y="98" width="38" height="22" rx="9" fill="#0f172a" />
      {/* star glint */}
      <path
        d="M74 104l2.2 4.6 5 .6-3.7 3.4 1 5-4.5-2.5-4.5 2.5 1-5-3.7-3.4 5-.6z"
        fill="#fde047"
      />

      {/* gold chain */}
      <g stroke="#fbbf24" strokeWidth="4" fill="none">
        <path d="M70 168c10 10 50 10 60 0" strokeLinecap="round" />
      </g>
      <circle cx="100" cy="178" r="6" fill="#fbbf24" stroke="#b45309" strokeWidth="2" />
    </svg>
  );
}
