/**
 * Availability markers for feature comparison tables, matching the icons used on
 * documenso.com/pricing.
 *
 * Registered globally in `mdx-components.tsx`, so they can be used in any MDX page
 * as `<Included />` and `<NotIncluded />` without an explicit import.
 */
export function Included() {
  return (
    <svg
      role="img"
      aria-label="Included"
      width="20"
      height="20"
      viewBox="0 0 32 32"
      fill="none"
      className="inline-block align-middle"
    >
      <circle cx="16" cy="16" r="16" fill="#EEFAD7" />
      <path
        d="M9.5 15.5 13 19.5l9-9"
        stroke="#3C531B"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function NotIncluded() {
  return (
    <svg
      role="img"
      aria-label="Not included"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      className="inline-block align-middle text-fd-muted-foreground"
    >
      <path d="M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
