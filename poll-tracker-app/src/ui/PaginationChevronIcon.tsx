type PaginationChevronIconProps = {
  direction: 'prev' | 'next'
}

/** Inline SVG so pagination never depends on missing / broken PNG assets (avoids huge flex min-content blowups). */
export function PaginationChevronIcon({ direction }: PaginationChevronIconProps) {
  return (
    <svg
      className="icon-pagination-chevron"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      aria-hidden
      focusable="false"
    >
      {direction === 'prev' ? (
        <path
          d="M14 6L8 12l6 6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M10 6l6 6-6 6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  )
}
