import type { ReactNode, SVGProps } from 'react';
import { fmt } from '../lib/anim';
import { cylinderSide, pathOf, type Pt } from '../lib/iso';

/**
 * Fill classes map to CSS tokens (see styles.css → .es-svg):
 *   fw = white surface, fl = light side, fs = mid-light side, fm = darker side, fk = ink (hard shadows)
 */
export type Fill = 'fw' | 'fl' | 'fs' | 'fm' | 'fk' | 'fn';

export function Face({ pts, fill = 'fw', className = '', ...rest }: { pts: readonly Pt[]; fill?: Fill } & SVGProps<SVGPathElement>) {
  return <path d={pathOf(pts)} className={`ln ${fill} ${className}`} {...rest} />;
}

export function Seg({ a, b, ...rest }: { a: Pt; b: Pt } & SVGProps<SVGLineElement>) {
  return <line x1={fmt(a[0])} y1={fmt(a[1])} x2={fmt(b[0])} y2={fmt(b[1])} className="ln thin" {...rest} />;
}

/** Rounded capsule floating near the base of each illustration. */
export function Pill({ cx, cy, length, width = 11.5, angle, dy = 0 }: { cx: number; cy: number; length: number; width?: number; angle: number; dy?: number }) {
  return (
    <rect
      x={-length / 2}
      y={-width / 2}
      width={length}
      height={width}
      rx={width / 2}
      transform={`translate(${fmt(cx)} ${fmt(cy + dy)}) rotate(${angle})`}
      className="ln fw"
    />
  );
}

/**
 * Screen-aligned rhombus (an isometric square seen from above).
 * `rotate` + `skew` + `scale` fake the little 3D tumble the reference gives these on impact.
 */
export function Diamond({ cx, cy, hw, hh, rotate = 0, scale = 1, skew = 0, strokeWidth }: { cx: number; cy: number; hw: number; hh: number; rotate?: number; scale?: number; skew?: number; strokeWidth?: number }) {
  const pts: Pt[] = [
    [-hw, 0],
    [0, -hh],
    [hw, 0],
    [0, hh],
  ];
  return (
    <path
      d={pathOf(pts)}
      className="ln fl"
      style={strokeWidth ? { strokeWidth } : undefined}
      transform={`translate(${fmt(cx)} ${fmt(cy)}) rotate(${fmt(rotate)}) skewX(${fmt(skew)}) scale(${fmt(scale)})`}
    />
  );
}

/** Upright cylinder: side wall + top ellipse, with optional decoration on the top face. */
export function Cylinder({
  cx,
  topCy,
  rx,
  ry,
  h,
  side = 'fl',
  top = 'fw',
  children,
}: {
  cx: number;
  topCy: number;
  rx: number;
  ry: number;
  h: number;
  side?: Fill;
  top?: Fill;
  children?: ReactNode;
}) {
  return (
    <g>
      <path d={cylinderSide(cx, topCy, rx, Math.max(ry, 0.01), Math.max(h, 0))} className={`ln ${side}`} />
      <ellipse cx={fmt(cx)} cy={fmt(topCy)} rx={fmt(rx)} ry={fmt(Math.max(ry, 0.01))} className={`ln ${top}`} />
      {children}
    </g>
  );
}
