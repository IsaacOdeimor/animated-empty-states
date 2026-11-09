/**
 * Isometric + ellipse geometry helpers.
 *
 * Isometric convention (true isometric, 30° axes):
 *   screenX = ox + (x - y) * COS30
 *   screenY = oy + (x + y) * SIN30 - z
 * +x runs toward the lower right, +y toward the lower left, +z is up.
 */
import { fmt } from './anim';

export const COS30 = Math.cos(Math.PI / 6);
export const SIN30 = 0.5;

export type Pt = readonly [number, number];
export type Origin = Pt;

/** `pitch` is the vertical factor; 0.5 is true isometric, a touch more tilts the view down. */
export const iso = (o: Origin, x: number, y: number, z = 0, pitch = SIN30): Pt => [
  o[0] + (x - y) * COS30,
  o[1] + (x + y) * pitch - z,
];

export const pathOf = (pts: readonly Pt[], close = true) =>
  pts.map((p, i) => `${i ? 'L' : 'M'}${fmt(p[0])} ${fmt(p[1])}`).join(' ') + (close ? ' Z' : '');

export interface IsoBox {
  /** centre of the box footprint in iso plane units */
  cx: number;
  cy: number;
  /** half extents along x and y */
  hx: number;
  hy: number;
  /** bottom elevation and height */
  z: number;
  h: number;
}

/** The three visible faces of an axis-aligned isometric box. */
export function boxFaces(o: Origin, b: IsoBox, pitch = SIN30) {
  const { cx, cy, hx, hy, z, h } = b;
  const P = (x: number, y: number, zz: number) => iso(o, cx + x, cy + y, zz, pitch);
  const zt = z + h;
  return {
    top: [P(-hx, -hy, zt), P(hx, -hy, zt), P(hx, hy, zt), P(-hx, hy, zt)] as Pt[],
    /** face along +y (lower-left on screen) */
    left: [P(-hx, hy, zt), P(hx, hy, zt), P(hx, hy, z), P(-hx, hy, z)] as Pt[],
    /** face along +x (lower-right on screen) */
    right: [P(hx, hy, zt), P(hx, -hy, zt), P(hx, -hy, z), P(hx, hy, z)] as Pt[],
    /** footprint (bottom face) */
    bottom: [P(-hx, -hy, z), P(hx, -hy, z), P(hx, hy, z), P(-hx, hy, z)] as Pt[],
  };
}

export const translate = (pts: readonly Pt[], dx: number, dy: number): Pt[] =>
  pts.map((p) => [p[0] + dx, p[1] + dy] as Pt);

/**
 * Side wall of an upright cylinder seen from above (screen-space ellipses).
 * Top ellipse centred at (cx, topCy), bottom ellipse at (cx, topCy + h).
 */
export function cylinderSide(cx: number, topCy: number, rx: number, ry: number, h: number) {
  const l = fmt(cx - rx);
  const r = fmt(cx + rx);
  const t = fmt(topCy);
  const b = fmt(topCy + h);
  return `M${l} ${t} L${l} ${b} A${fmt(rx)} ${fmt(ry)} 0 0 0 ${r} ${b} L${r} ${t} A${fmt(rx)} ${fmt(ry)} 0 0 1 ${l} ${t} Z`;
}

/** Closed ellipse as a path (lets us use stroke-dash tricks consistently). */
export function ellipsePath(cx: number, cy: number, rx: number, ry: number) {
  return `M${fmt(cx - rx)} ${fmt(cy)} A${fmt(rx)} ${fmt(ry)} 0 1 0 ${fmt(cx + rx)} ${fmt(cy)} A${fmt(rx)} ${fmt(ry)} 0 1 0 ${fmt(cx - rx)} ${fmt(cy)} Z`;
}

/** Rotate a point around a centre (degrees). */
export function rotate(p: Pt, c: Pt, deg: number): Pt {
  const a = (deg * Math.PI) / 180;
  const s = Math.sin(a);
  const k = Math.cos(a);
  const dx = p[0] - c[0];
  const dy = p[1] - c[1];
  return [c[0] + dx * k - dy * s, c[1] + dx * s + dy * k];
}
