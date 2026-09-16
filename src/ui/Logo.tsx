export function Logo({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="56" height="56" rx="15" fill="var(--logo-bg, #1d1d1f)" />
      <path
        d="M24 15h13l11 11v20a3 3 0 0 1-3 3H24a3 3 0 0 1-3-3V18a3 3 0 0 1 3-3z"
        stroke="var(--logo-fg, #fff)"
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
      <path d="M37 15v11h11" stroke="var(--logo-fg, #fff)" strokeWidth="2.6" strokeLinejoin="round" />
      <path
        d="M28 35h13M28 41h13"
        stroke="var(--logo-fg, #fff)"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
