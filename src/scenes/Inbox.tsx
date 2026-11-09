import { clamp, clipFrame, ease, floatCycle, fmt, grey, track } from '../lib/anim';
import { pathOf, translate, type Pt } from '../lib/iso';
import { Diamond, Face, Seg } from './parts';
import type { SceneDef } from './types';

/* ------------------------------------------------------------------ */
/* Geometry — a closed envelope resting on a flat tray                 */
/* ------------------------------------------------------------------ */
/**
 * The reference envelope and tray are hand-drawn slabs whose axes differ from
 * true isometric by a degree or two, so they are defined by their measured
 * top-face corners (screen units) instead of an iso projection.
 */
interface Slab {
  top: Pt;
  right: Pt;
  front: Pt;
  left: Pt;
  h: number;
}
const TRAY: Slab = { top: [140.5, 122], right: [258, 187.5], front: [169, 240], left: [51.5, 174.5], h: 9.5 };
const ENVELOPE: Slab = { top: [141.5, 120.5], right: [233, 175], front: [168.5, 210.5], left: [78, 160], h: 14 };
/** where the flap's V meets, relative to the envelope's centre */
const FLAP_TIP: Pt = [-4, 2.75];
const SHADOW_OFFSET: Pt = [-9, 9];
const BUBBLE = { cx: 155, cy: 79.5, w: 81, h: 32.4, dotGap: 21, dotR: 4 };
const DIAMONDS = {
  left: { cx: 51.5, cy: 136, hw: 10, hh: 5.75 },
  right: { cx: 277.5, cy: 122.5, hw: 10.5, hh: 6 },
};
const LINES: [Pt, Pt][] = [
  [[224, 136], [240, 122.5]],
  [[234, 150], [254, 145]],
];

/* ------------------------------------------------------------------ */
/* Timing — keys are reference-clip frame numbers (60 fps, 1-based).  */
/* One pass = 213 frames (≈3.6 s).                                    */
/* ------------------------------------------------------------------ */
const DURATION = 213;
const T = {
  /** envelope height above the tray */
  lift: track([
    [0, 0],
    [121, 0], [125, -1.5],
    [127, 11.2, ease.outQuad], [129, 17], [131, 18.3], [133, 18.8], [135, 18.8], [137, 18], [141, 17.5], [145, 17],
    [147, 15.5, ease.inQuad], [149, 12, ease.inQuad], [151, 5, ease.inQuad], [153, -1, ease.inQuad],
    [155, -1.5], [157, -1], [159, 0.3], [161, 0.3], [163, 0],
  ]),
  /** scale about the face centre: a tiny wobble early on, a little larger while lifted
   *  (closer to the viewer), and a squash-spread on landing */
  spread: track([
    [0, 1],
    [25, 1], [29, 1.02], [33, 1.025], [37, 1],
    [121, 1], [125, 0.98], [127, 1.027], [129, 1.035], [131, 1.04], [145, 1.04], [149, 1.035], [151, 1.03],
    [153, 1.01], [157, 1.005], [159, 0.998], [161, 1],
  ]),
  thickness: track([[0, 1], [151, 1], [153, 0.93], [157, 0.93], [159, 1.02], [161, 1]]),
  trayPress: track([[0, 0], [151, 0], [153, 1], [157, 1], [159, 0]]),
  /** flap lifts a hair (its back edge separates from the body) early on and again on landing */
  flap: track([[0, 0], [27, 0], [31, 3], [35, 2], [39, 0], [151, 0], [153, 4], [157, 4], [161, 0]]),
  /** typing bubble */
  bubbleScale: track([[0, 0], [52, 0], [53, 0.5, ease.linear], [55, 0.72], [57, 0.86], [59, 0.95], [61, 1.03], [63, 1.01], [65, 1], [112, 1], [118, 0.9]]),
  bubbleOpacity: track([[0, 0], [52, 0], [53, 1, ease.step], [112, 1], [118, 0, ease.linear]]),
  dots: track([[0, 0], [58, 0], [61, 1]]),
  lineGrey: [
    track([[0, 10], [123, 10], [127, 215], [151, 215], [153, 120], [156, 10]]),
    track([[0, 10], [123, 10], [127, 215], [153, 215], [155, 120], [158, 10]]),
  ],
  /** diamonds tumble (a half turn with a shear) as the envelope lands */
  rightSpin: track([[0, 0], [151, 0], [155, 90, ease.outQuad], [161, 180, ease.outQuad]]),
  rightScale: track([[0, 1], [151, 1], [154, 1.6, ease.outQuad], [157, 1.55], [161, 1]]),
  leftSpin: track([[0, 0], [157, 0], [160, 90, ease.outQuad], [167, 180, ease.outQuad]]),
  leftScale: track([[0, 1], [157, 1], [160, 1.6, ease.outQuad], [163, 1.45], [167, 1]]),
};

/** shear that peaks mid-tumble so the rhombus reads as turning in depth */
const tumbleSkew = (deg: number) => Math.sin((deg * Math.PI) / 180) * 18;

/** typing-indicator wave for dot i: quick rise, hold, ease down, rest */
function dotLift(f: number, i: number) {
  if (f < 65 || f > 112) return 0;
  const phase = (((f - (65 + 7 * i)) % 24) + 24) % 24;
  if (f < 65 + 7 * i) return 0;
  if (phase < 4) return ease.outQuad(phase / 4);
  if (phase < 12) return 1;
  if (phase < 18) return 1 - ease.inOutSine((phase - 12) / 6);
  return 0;
}

/** Faces of a slab whose top face is `s`, moved by `dy`, scaled about its centre and given height `h`. */
function slabFaces(s: Slab, { dy = 0, scale = 1, h = s.h }: { dy?: number; scale?: number; h?: number }) {
  const c: Pt = [(s.top[0] + s.front[0]) / 2, (s.top[1] + s.front[1]) / 2];
  const P = (p: Pt): Pt => [c[0] + (p[0] - c[0]) * scale, c[1] + (p[1] - c[1]) * scale + dy];
  const [t, r, fr, l] = [P(s.top), P(s.right), P(s.front), P(s.left)];
  const down = (p: Pt): Pt => [p[0], p[1] + h];
  return {
    centre: [c[0], c[1] + dy] as Pt,
    top: [t, r, fr, l],
    left: [l, fr, down(fr), down(l)],
    right: [fr, r, down(r), down(fr)],
    bottom: [down(t), down(r), down(fr), down(l)],
  };
}

function Art({ f: t }: { f: number }) {
  const f = clipFrame(t);
  const lift = T.lift(f);
  const spread = T.spread(f);
  const press = T.trayPress(f);
  // the tray's top face sinks on impact; its base stays put
  const tray = slabFaces(TRAY, { dy: press, h: TRAY.h - press });
  const shadow = translate(tray.bottom, ...SHADOW_OFFSET);

  const envH = ENVELOPE.h * T.thickness(f);
  // keep the envelope's base on the tray while it squashes; lift moves it up
  const env = slabFaces(ENVELOPE, { dy: press - lift + (ENVELOPE.h - envH), scale: spread, h: envH });
  const flapUp = T.flap(f);
  const flapBack: Pt = [env.top[0][0], env.top[0][1] - flapUp];
  const flapRight: Pt = [env.top[1][0], env.top[1][1] - flapUp];
  const flapTip: Pt = [env.centre[0] + FLAP_TIP[0] * spread, env.centre[1] + FLAP_TIP[1] * spread];

  // the two diamonds drift in opposite directions, twice per loop
  const bob = floatCycle(f, DURATION, 2) * 7;

  const bScale = T.bubbleScale(f);
  const bOpacity = T.bubbleOpacity(f);
  const dotsIn = T.dots(f);

  return (
    <g>
      <path d={pathOf(shadow)} className="fk ln" />
      <Face pts={tray.left} fill="fs" />
      <Face pts={tray.right} fill="fw" />
      <Face pts={tray.top} fill="fw" />

      <Face pts={env.left} fill="fw" />
      <Face pts={env.right} fill="fw" />
      <Face pts={env.top} fill="fw" />
      <path d={pathOf([flapBack, flapTip, flapRight])} className="ln fl flap" />

      <Diamond {...DIAMONDS.left} cy={DIAMONDS.left.cy + bob} rotate={T.leftSpin(f)} skew={tumbleSkew(T.leftSpin(f))} scale={T.leftScale(f)} strokeWidth={2.8} />
      <Diamond {...DIAMONDS.right} cy={DIAMONDS.right.cy - bob} rotate={T.rightSpin(f)} skew={tumbleSkew(T.rightSpin(f))} scale={T.rightScale(f)} strokeWidth={2.8} />
      {LINES.map(([a, b], i) => (
        <Seg key={i} a={a} b={b} style={{ stroke: grey(T.lineGrey[i](f)) }} />
      ))}

      {bOpacity > 0.01 && bScale > 0.01 && (
        <g
          style={{ opacity: bOpacity }}
          transform={`translate(${BUBBLE.cx} ${fmt(BUBBLE.cy + BUBBLE.h / 2)}) scale(${fmt(bScale)}) translate(0 ${fmt(-BUBBLE.h / 2)})`}
        >
          <rect x={-BUBBLE.w / 2} y={-BUBBLE.h / 2} width={BUBBLE.w} height={BUBBLE.h} rx={BUBBLE.h / 2} className="ln fw" />
          {[-1, 0, 1].map((k, i) => (
            <circle
              key={k}
              cx={k * BUBBLE.dotGap}
              cy={fmt(-7.5 * dotLift(f, i))}
              r={fmt(BUBBLE.dotR * clamp(dotsIn))}
              className="fk"
            />
          ))}
        </g>
      )}
    </g>
  );
}

export const inbox: SceneDef = {
  id: 'inbox',
  duration: DURATION,
  staticFrame: 64, // typing bubble fully open, dots at rest
  Art,
  content: {
    title: 'Inbox is quiet.',
    subtitle: 'Say hello first.',
    copy: 'Conversations with clients and collaborators will show up here.',
    action: 'Start a Chat',
    artLabel: 'A closed envelope resting on a tray, with a typing indicator bubble above it.',
  },
};
