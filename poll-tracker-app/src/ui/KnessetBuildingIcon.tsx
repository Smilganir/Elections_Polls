/** Squarish Knesset-building glyph (grey facade, columns, flag) sized for a button. */
export function KnessetBuildingIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="34"
      height="34"
      viewBox="0 0 34 34"
      aria-hidden
      focusable="false"
    >
      {/* flag */}
      <line x1="25.5" y1="2" x2="25.5" y2="11" stroke="currentColor" strokeWidth="1" />
      <rect x="25.5" y="2.2" width="6" height="4.4" fill="#fff" stroke="currentColor" strokeWidth="0.5" />
      <rect x="25.5" y="3.1" width="6" height="0.7" fill="#2a6fd6" />
      <rect x="25.5" y="5" width="6" height="0.7" fill="#2a6fd6" />
      {/* roof slab */}
      <path d="M3 12.5 L26 10.5 L31 12.5 V15 H3 Z" fill="currentColor" opacity="0.95" />
      {/* columns */}
      <g fill="currentColor" opacity="0.8">
        <rect x="5" y="16.2" width="2.4" height="9" rx="1.1" />
        <rect x="9.6" y="16.2" width="2.4" height="9" rx="1.1" />
        <rect x="14.2" y="16.2" width="2.4" height="9" rx="1.1" />
        <rect x="18.8" y="16.2" width="2.4" height="9" rx="1.1" />
        <rect x="23.4" y="16.2" width="2.4" height="9" rx="1.1" />
        <rect x="28" y="16.2" width="2.4" height="9" rx="1.1" />
      </g>
      {/* steps */}
      <rect x="3" y="26.4" width="28" height="2.2" fill="currentColor" opacity="0.95" />
      <rect x="1.5" y="29.2" width="31" height="2.4" fill="currentColor" opacity="0.7" />
    </svg>
  )
}
