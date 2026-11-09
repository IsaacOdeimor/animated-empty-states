/**
 * Turns a rendered illustration into standalone SVG markup.
 *
 * On the page the drawing is styled by CSS classes and custom properties
 * (`.ln`, `.fw`, `--art-line`, …). Outside the page those would be lost, so the
 * computed paint of every shape is written back as plain attributes, classes and
 * inline styles are dropped, and anything invisible in that pose is left out.
 */

const SHAPES = new Set(['path', 'line', 'rect', 'ellipse', 'circle', 'polygon', 'polyline']);
const SKIP_ATTRS = new Set(['class', 'style', 'focusable']);

const trimNum = (v: string) => v.replace(/px/g, '').trim();

function toHex(color: string): string {
  if (color === 'none') return 'none';
  const m = color.match(/^rgba?\(([^)]+)\)$/);
  if (!m) return color;
  const [r, g, b, a = 1] = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  if (a === 0) return 'none';
  if (a < 1) return color;
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
}

function dash(value: string): string {
  if (!value || value === 'none') return 'none';
  return value.replace(/px/g, '').split(/[\s,]+/).filter(Boolean).join(' ');
}

const escapeAttr = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function paintOf(tag: string, cs: CSSStyleDeclaration): Array<[string, string]> {
  // a <line> has no interior, so its fill is noise
  const out: Array<[string, string]> = tag === 'line' ? [] : [['fill', toHex(cs.fill)]];
  const stroke = toHex(cs.stroke);
  const width = trimNum(cs.strokeWidth);
  if (stroke === 'none' || Number(width) === 0) return out;
  out.push(['stroke', stroke], ['stroke-width', width]);
  if (cs.strokeLinecap !== 'butt') out.push(['stroke-linecap', cs.strokeLinecap]);
  if (cs.strokeLinejoin !== 'miter') out.push(['stroke-linejoin', cs.strokeLinejoin]);
  const dashes = dash(cs.strokeDasharray);
  if (dashes !== 'none') {
    out.push(['stroke-dasharray', dashes]);
    const offset = trimNum(cs.strokeDashoffset);
    if (Number(offset) !== 0) out.push(['stroke-dashoffset', offset]);
  }
  return out;
}

function walk(parent: Element, depth: number, out: string[]): void {
  for (const el of Array.from(parent.children)) {
    const cs = getComputedStyle(el);
    const opacity = Number(cs.opacity);
    if (cs.display === 'none' || cs.visibility === 'hidden' || opacity === 0) continue;

    const tag = el.tagName.toLowerCase();
    const attrs: Array<[string, string]> = [];
    for (const a of Array.from(el.attributes)) {
      if (SKIP_ATTRS.has(a.name) || a.name.startsWith('aria-')) continue;
      attrs.push([a.name, a.value]);
    }
    if (opacity < 1) attrs.push(['opacity', String(Math.round(opacity * 1000) / 1000)]);
    if (SHAPES.has(tag)) attrs.push(...paintOf(tag, cs));

    const pad = '  '.repeat(depth);
    const attrText = attrs.map(([k, v]) => ` ${k}="${escapeAttr(v)}"`).join('');
    if (el.children.length === 0) {
      if (SHAPES.has(tag)) out.push(`${pad}<${tag}${attrText}/>`);
      continue;
    }
    // a bare <g> only groups for React's sake; lift its children instead
    if (tag === 'g' && attrs.length === 0) {
      walk(el, depth, out);
      continue;
    }
    const inner: string[] = [];
    walk(el, depth + 1, inner);
    if (inner.length === 0) continue;
    out.push(`${pad}<${tag}${attrText}>`, ...inner, `${pad}</${tag}>`);
  }
}

export function toStandaloneSvg(svg: SVGSVGElement, viewBox: string): string {
  const [, , w, h] = viewBox.split(/\s+/);
  const lines = [`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${viewBox}" fill="none">`];
  walk(svg, 1, lines);
  lines.push('</svg>');
  return `${lines.join('\n')}\n`;
}
