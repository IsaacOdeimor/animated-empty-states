import { ease, grey, track } from '../lib/anim';
import { boxFaces, iso, pathOf, translate, type Pt } from '../lib/iso';
import { Face, Pill, Seg } from './parts';
import type { SceneDef } from './types';

/* ------------------------------------------------------------------ */
/* Geometry (SVG units in a 360 × 330 box)                            */
/* ------------------------------------------------------------------ */
const O: Pt = [137.3, 209]; // ground point under the centre of the stack
const PITCH = 0.507; // the reference is drawn a hair steeper than true isometric
const HALF = 47.6; // half the side of a square panel
const PANELS = [
  { z: 0, h: 14, side: 'fl' }, // bottom
  { z: 14, h: 12, side: 'fm' }, // middle (darker sides) – the one that slides out
  { z: 26, h: 14, side: 'fl' }, // top
] as const;
const STACK_TOP = 40;
const GHOST_GAP = 34; // dashed "new project" outline floats this far above the stack
const PLUS_ARM = 14.4; // half-length of the plus arms, in plane units (lies flat, so it reads as a wide ×)
const SHADOW_OFFSET: Pt = [-14, 8]; // keeps the band tucked under the right-hand face

/* ------------------------------------------------------------------ */
/* Timing — 60 fps frames. One pass = 194 frames (≈3.2 s).            */
/* ------------------------------------------------------------------ */
const DURATION = 194;
const IMPACT = 103.5; // frame where the falling panels meet the stack
const T = {
  /** stack fans open: top panel and middle panel lift apart */
  topLift: track([[0, 0], [18, 0], [30, 22, ease.outQuart], [96, 22], [IMPACT, 0, ease.inQuad]]),
  midLift: track([[0, 0], [18, 0], [28, 9.5, ease.outQuart], [96, 9.5], [IMPACT, 0, ease.inQuad]]),
  /** middle panel slides out toward the viewer's right and back */
  midSlide: track([[0, 0], [46, 0], [54, 30, ease.inOutSine], [63.5, 30], [71.5, 0, ease.inOutSine]]),
  /** whole-stack squash on impact (scales panel heights) */
  squash: track([[0, 1], [102.5, 1], [104, 0.95, ease.linear], [106, 0.91, ease.outQuad], [108, 0.94], [110, 1.01], [113, 1]]),
  /** dashed ghost outline height above the ground, while separate from the stack */
  ghostUp: track([
    [0, STACK_TOP + GHOST_GAP],
    [13, STACK_TOP + GHOST_GAP],
    [23, 89, ease.outCubic],
    [45, 90],
    [57, 86],
    [69, 85.5],
    [81, 91.5],
    [91, 92.5],
    [96, 96, ease.outQuad],
    [IMPACT, STACK_TOP, ease.inCubic],
  ]),
  ghostReturn: track([[156, STACK_TOP], [162, 44, ease.inQuad], [166, 51, ease.linear], [170, 61.5, ease.linear], [174, 68.5], [180, 72.5], [186, STACK_TOP + GHOST_GAP, ease.outQuad]]),
  ghostOpacity: track([[0, 1], [102, 1], [104, 0.55, ease.linear], [110, 0, ease.linear], [155, 0], [160, 1, ease.linear]]),
  /** on impact the ghost spreads past the panel edges as it fades */
  ghostScale: track([[0, 1], [102, 1], [105, 1.12, ease.outQuad], [110, 1.2], [111, 1]]),
  /** in-plane rotation of the plus; a quarter turn passes through a screen-upright "+" */
  plusTurn: track([[0, 0], [45, 0], [69, 90, ease.inOutSine], [159, 90], [179, 180, ease.inOutSine]]),
  plusScale: track([[0, 1], [102, 1], [105, 1.5, ease.outQuad], [113, 1.6], [118, 1, ease.inOutQuad]]),
  plusGrey: track([[0, 10], [102, 10], [104, 140, ease.linear], [115, 140], [118, 10, ease.linear]]),
  /** impact burst lines either side of the stack */
  burstOut: track([[104, 0], [111, 9, ease.outQuad], [120, 13, ease.linear]]),
  burstGrey: track([[104, 10], [109, 10], [120, 230, ease.inQuad]]),
  /** the floating pills get knocked down by the impact, then drift back */
  pillDrop: track([[0, 0], [102.5, 0], [105, 9, ease.outQuad], [110, 9], [132, 2.5], [158, 0]]),
  shadowSpread: track([[0, 0], [102.5, 0], [105, 3], [110, 3], [114, 0]]),
};

/* burst strokes: inner point + outward direction (left side, mirrored for right) */
const BURST: { p: Pt; d: Pt }[] = [
  { p: [52, 212], d: [-0.94, -0.34] },
  { p: [55, 221], d: [-0.91, 0.42] },
];
const BURST_LEN = 14;

function Art({ f }: { f: number }) {
  const squash = T.squash(f);
  const topLift = T.topLift(f);
  const midLift = T.midLift(f);
  const slide = T.midSlide(f);

  const lift = [0, midLift, topLift];
  const topZ = (STACK_TOP + topLift) * squash;

  // ghost outline + plus share one height
  const ghostZ = f < IMPACT ? T.ghostUp(f) : f < 156 ? topZ : T.ghostReturn(f);
  const ghostOpacity = T.ghostOpacity(f);
  const gs = T.ghostScale(f);
  const ghost = boxFaces(O, { cx: 0, cy: 0, hx: HALF * gs, hy: HALF * gs, z: ghostZ, h: 0 }, PITCH).top;

  const spread = T.shadowSpread(f);
  const shadow = translate(boxFaces(O, { cx: 0, cy: 0, hx: HALF, hy: HALF, z: 0, h: 0 }, PITCH).bottom, SHADOW_OFFSET[0] - spread * 0.87, SHADOW_OFFSET[1] + spread * 0.5);

  // plus mark drawn in the plane of the ghost/top face, rotated in-plane
  const phi = (T.plusTurn(f) * Math.PI) / 180;
  const arm = PLUS_ARM * T.plusScale(f);
  const u: Pt = [Math.cos(phi) * arm, Math.sin(phi) * arm];
  const v: Pt = [-Math.sin(phi) * arm, Math.cos(phi) * arm];
  const P = (x: number, y: number) => iso(O, x, y, ghostZ, PITCH);
  const plusColor = grey(T.plusGrey(f));

  const burstOut = T.burstOut(f);
  const showBurst = f >= 104 && f <= 121;
  const drop = T.pillDrop(f);

  return (
    <g>
      <path d={pathOf(shadow)} className="fk ln" />
      <Pill cx={94.5} cy={260} length={33} width={8.5} angle={32} dy={drop} />
      <Pill cx={197.5} cy={249} length={31} width={8.5} angle={-28} dy={drop * 0.9} />

      {PANELS.map((p, i) => {
        const faces = boxFaces(O, {
          cx: i === 1 ? slide : 0,
          cy: 0,
          hx: HALF,
          hy: HALF,
          z: (p.z + lift[i]) * squash,
          h: p.h * squash,
        }, PITCH);
        return (
          <g key={i}>
            <Face pts={faces.left} fill={p.side} />
            <Face pts={faces.right} fill={p.side} />
            <Face pts={faces.top} fill="fw" />
          </g>
        );
      })}

      {ghostOpacity > 0.01 && (
        <path d={pathOf(ghost)} className="ln thin fn dashed" style={{ opacity: ghostOpacity }} />
      )}

      <g style={{ stroke: plusColor }}>
        <Seg a={P(-u[0], -u[1])} b={P(u[0], u[1])} style={{ stroke: plusColor }} />
        <Seg a={P(-v[0], -v[1])} b={P(v[0], v[1])} style={{ stroke: plusColor }} />
      </g>

      {showBurst &&
        [1, -1].map((side) =>
          BURST.map((b, i) => {
            const px = side === 1 ? b.p[0] : 2 * O[0] - b.p[0];
            const dx = b.d[0] * side;
            const a: Pt = [px + dx * burstOut, b.p[1] + b.d[1] * burstOut];
            const e: Pt = [a[0] + dx * BURST_LEN, a[1] + b.d[1] * BURST_LEN];
            return <Seg key={`${side}${i}`} a={a} b={e} style={{ stroke: grey(T.burstGrey(f)) }} />;
          }),
        )}
    </g>
  );
}

export const projects: SceneDef = {
  id: 'projects',
  duration: DURATION,
  staticFrame: 0,
  Art,
  content: {
    title: 'No projects yet.',
    subtitle: 'Start your first one.',
    copy: 'Create a project to organize tasks, files and feedback in one place.',
    action: 'Create Project',
    artLabel: 'A stack of document panels with a dashed outline and a plus sign above it, marking where a new project will go.',
  },
};
