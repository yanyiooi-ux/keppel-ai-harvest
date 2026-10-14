/**
 * Pip (S21): a small flat block character with a cube head, a hard hat and a
 * friendly face. Flat SVG, no 3D, every fill from a --pip-* token.
 */

export function PipAvatar({ size = 38 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="3.5 3.5 40 40"
      role="img"
      aria-label="Pip, a small block robot in a hard hat"
    >
      <polygon fill="var(--pip-ps)" points="32,20 37,16 37,38 32,42" />
      <rect fill="var(--pip-pb)" x="10" y="20" width="22" height="22" />
      <polygon fill="var(--pip-ht)" points="7,17 12,13 40,13 35,17" />
      <polygon fill="var(--pip-hs)" points="35,17 40,13 40,17 35,21" />
      <rect fill="var(--pip-hf)" x="7" y="17" width="28" height="4" />
      <polygon fill="var(--pip-hs)" points="31,8 35,5 35,13 31,16" />
      <polygon fill="var(--pip-ht)" points="13,8 17,5 35,5 31,8" />
      <rect fill="var(--pip-hf)" x="13" y="8" width="18" height="8" />
      <rect fill="var(--pip-hr)" x="20" y="8" width="4" height="8" />
      <rect fill="var(--pip-w)" x="14" y="25" width="5" height="5" />
      <rect fill="var(--pip-w)" x="23" y="25" width="5" height="5" />
      <rect fill="var(--pip-ey)" x="16" y="26.5" width="2.5" height="2.5" />
      <rect fill="var(--pip-ey)" x="25" y="26.5" width="2.5" height="2.5" />
      <rect fill="var(--pip-ck)" x="11.5" y="32" width="3" height="2" />
      <rect fill="var(--pip-ck)" x="27.5" y="32" width="3" height="2" />
      <rect fill="var(--pip-ey)" x="16" y="33.5" width="2" height="2" />
      <rect fill="var(--pip-ey)" x="18" y="35.5" width="6" height="2" />
      <rect fill="var(--pip-ey)" x="24" y="33.5" width="2" height="2" />
    </svg>
  );
}
