/**
 * Pip (S21, D3): Bolt Pip, a small glass robot head with glowing cyan eyes, a
 * small yellow hard hat and a bolt on each side, drawn from the pip-bolt
 * sample YY picked on 15 Oct. Flat SVG: every fill and stroke is a --pip-*
 * token from globals.css. The sample's two gradients are flat token fills and
 * its eye glow is a soft halo, so no SVG ids are needed when several Pips
 * share a page.
 */

export function PipAvatar({ size = 38 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label="Pip, a small glass robot in a hard hat"
    >
      <ellipse fill="var(--pip-shadow)" cx="50" cy="92" rx="24" ry="3.5" />
      <circle fill="var(--pip-bolt)" cx="14" cy="56" r="5" />
      <circle fill="var(--pip-bolt)" cx="86" cy="56" r="5" />
      <rect
        fill="var(--pip-head)"
        stroke="var(--pip-edge)"
        strokeWidth="1.5"
        x="16"
        y="28"
        width="68"
        height="58"
        rx="24"
      />
      <ellipse fill="var(--pip-shine)" cx="34" cy="37" rx="11" ry="4" transform="rotate(-12 34 37)" />
      <rect fill="var(--pip-visor)" x="25" y="42" width="50" height="34" rx="15" />
      <rect fill="var(--pip-glow)" x="32" y="46" width="16" height="20" rx="8" />
      <rect fill="var(--pip-glow)" x="52" y="46" width="16" height="20" rx="8" />
      <rect fill="var(--pip-eye)" x="35" y="49" width="10" height="14" rx="5" />
      <rect fill="var(--pip-eye)" x="55" y="49" width="10" height="14" rx="5" />
      <path fill="var(--pip-glow)" d="M42 66.4 Q50 77 58 66.4 Q50 68.6 42 66.4 Z" />
      <path fill="var(--pip-eye)" d="M43.8 67.4 Q50 74.6 56.2 67.4 Q50 70.2 43.8 67.4 Z" />
      <ellipse fill="var(--pip-cheek)" cx="30" cy="69" rx="4" ry="2.4" />
      <ellipse fill="var(--pip-cheek)" cx="70" cy="69" rx="4" ry="2.4" />
      <g transform="rotate(-6 50 26)">
        <path fill="var(--pip-hat)" d="M28 33 Q29 12 50 10 Q71 12 72 33 Z" />
        <rect fill="var(--pip-brim)" x="23" y="30" width="54" height="7" rx="3.5" />
        <rect fill="var(--pip-stripe)" x="47" y="10.5" width="6" height="20" rx="3" />
      </g>
    </svg>
  );
}
