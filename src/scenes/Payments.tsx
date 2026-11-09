import { clamp, clipFrame, ease, floatCycle, fmt, lerp, track } from '../lib/anim';
import { ellipsePath } from '../lib/iso';
import { Cylinder, Diamond, Pill } from './parts';
import type { SceneDef } from './types';

/* ------------------------------------------------------------------ */
/* Geometry                                                            */
/* ------------------------------------------------------------------ */
const STACK = { cx: 153, topCy: 126.75, rx: 59, ry: 32.25, t: 18.5, count: 3 };
const RING = { rx: 35, ry: 19, dy: 0.75 }; // engraved ring on the top coin
const STACK_SHADOW = { dx: -16, dy: 7 };
const SMALL = { cx: 236.5, cy: 231, rx: 43.5, ry: 23, t: 14, ring: { rx: 24, ry: 12.5 } };
const SMALL_SHADOW = { dx: -15.5, dy: 8 };
/** the small coin hops toward the stack (B) and back (A) */
const HOP_TO: [number, number] = [-15, -9];
const DIAMOND = { cx: 277.5, cy: 80, hw: 13, hh: 6.5 };
/** sparkles that pop off the rim when the flipped coin lands */
const SPARKS: [number, number, number][] = [
  [130, 115, -1],
  [153, 104, 0],
  [176, 115, 1],
];

/* ------------------------------------------------------------------ */
/* Timing — keys are reference-clip frame numbers (60 fps, 1-based).  */
/* One pass = 215 frames (≈3.6 s).                                    */
/* ------------------------------------------------------------------ */
const DURATION = 215;
const T = {
  /** top coin: centre of its face while it is tossed and caught */
  topCoin: track([
    [0, STACK.topCy],
    [31, STACK.topCy],
    [33, 129],
    [35, 102.5, ease.outQuad],
    [39, 81, ease.outQuad],
    [47, 69.5, ease.outSine],
    [53, 75],
    [59, 74.5],
    [61, 79.5, ease.inQuad],
    [63, 91.5, ease.linear],
    [65, 111.5, ease.linear],
    [67, 129.75, ease.linear],
    [69, 129.75],
    [71, 126.25],
    [73, STACK.topCy],
  ]),
  /** two half-turns while airborne; the face height follows a triangle wave of this angle */
  flip: track([[0, 0], [34.5, 0], [41, 90, ease.linear], [47, 180, ease.linear], [53.3, 270, ease.linear], [60, 360, ease.linear]]),
  /** compression of the remaining coins (anticipation + landing) */
  press: track([[0, 0], [29, 0], [33, 0.8], [35, 0], [65, 0], [67, 1], [69, 1], [71, -0.2], [73, 0]]),
  /** with the top coin away the stack is shorter: its shadow lightens and tucks in */
  stackShadow: track([[0, 1], [33, 1], [37, 0.5], [61, 0.5], [65, 1]]),
  shadowReach: track([[0, 1], [33, 1], [37, 0.45], [61, 0.45], [66, 1]]),
  /** the stack jumps once the small coin has settled next to it (bottom → top) */
  jump: [
    track([[0, 0], [121, 0], [123, -2], [129, -2], [131, 0]]),
    track([[0, 0], [121, 0], [123, -6, ease.outQuad], [127, -7.5], [129, -6.5], [131, 0, ease.inQuad]]),
    track([[0, 0], [123, 0], [125, -7, ease.outQuad], [127, -12], [129, -14, ease.outQuad], [133, -14], [135, -3, ease.inQuad], [137, 3, ease.inQuad], [139, 0]]),
  ],
  /** small coin: ground position A→B→A (0 = A, 1 = B) and hop height */
  hopPos: track([[0, 0], [87, 0], [107, 1, ease.inOutSine], [153, 1], [173, 0, ease.inOutSine]]),
  hopHeight: track([
    [0, 0],
    [85, 0], [87, -2], [89, 18.8, ease.outQuad], [91, 22.5], [93, 22.4], [97, 20.2], [101, 16], [103, 12], [105, 6, ease.inQuad], [107, -1.2, ease.inQuad], [109, -1.7], [111, 1.3], [113, 0],
    [151, 0], [153, -0.5], [155, 5.5], [157, 13], [159, 15], [161, 17], [163, 19.2], [165, 20.4], [167, 20.4], [169, 19.2], [171, 13.8, ease.inQuad], [173, 2, ease.inQuad], [174, 0], [175, -2], [177, -1], [179, 0.8], [181, 0],
  ]),
  ringSpin: track([[0, 0], [87, 0], [113, 34], [153, 34], [181, 68]]),
  diamondSpin: track([[0, 0], [66, 0], [69, 80, ease.outQuad], [75, 180, ease.outQuad]]),
  diamondScale: track([[0, 1], [66, 1], [68, 1.5, ease.outQuad], [72, 1.45], [76, 1]]),
  spark: track([[0, 0], [68, 0], [82, 1, ease.linear]]),
};

function Coin({ cx, topCy, t, sy = 1, ring, rx = STACK.rx, ry = STACK.ry }: { cx: number; topCy: number; t: number; sy?: number; ring?: boolean; rx?: number; ry?: number }) {
  // squash vertically about the coin's mid-height (fakes a flip)
  const mid = topCy + t / 2;
  const top = mid - (t / 2) * sy;
  return (
    <Cylinder cx={cx} topCy={top} rx={rx} ry={ry * sy} h={t * sy}>
      {ring && <ellipse cx={cx} cy={fmt(top + RING.dy * sy)} rx={RING.rx} ry={fmt(RING.ry * sy)} className="ln fn" />}
    </Cylinder>
  );
}

function Art({ f: t }: { f: number }) {
  const f = clipFrame(t);
  const press = T.press(f);
  const flipping = f > 34.5 && f < 60;
  const turn = (T.flip(f) / 180) % 1; // 0..1 per half-turn
  const sy = flipping ? Math.max(Math.abs(1 - 2 * turn), 0.2) : 1; // keep a sliver of face when edge-on

  // resting coins (bottom → middle): pushed down slightly on press
  const pressDrop = [1, 2.5];
  const coins = [0, 1].map((i) => {
    const restTop = STACK.topCy + (STACK.count - 1 - i) * STACK.t;
    const drop = press * pressDrop[i];
    const prevDrop = i === 0 ? 0 : press * pressDrop[i - 1];
    return { top: restTop + drop + T.jump[i](f), t: STACK.t - (drop - prevDrop) };
  });
  const topCoin = T.topCoin(f) + T.jump[2](f);

  const bottomCy = STACK.topCy + STACK.count * STACK.t - STACK.t; // bottom coin's top face
  const reach = T.shadowReach(f);
  const shadowCy = bottomCy + STACK.t + STACK_SHADOW.dy * reach;

  // small coin
  const p = T.hopPos(f);
  const gx = SMALL.cx + HOP_TO[0] * p;
  const gy = SMALL.cy + HOP_TO[1] * p;
  const hop = T.hopHeight(f);
  const lifted = Math.max(hop, 0);
  const squashDrop = Math.min(hop, 0); // negative height = squash into the ground
  const smallTop = gy - lifted - squashDrop;
  const smallT = SMALL.t + squashDrop;
  const smallShadow = 1 - 0.5 * clamp(lifted / 8);

  const spark = T.spark(f);
  const float = floatCycle(f, DURATION) * -3.5;
  const bob = floatCycle(f, DURATION, 2) * -9;

  const ringPath = ellipsePath(gx, smallTop + 0.5, SMALL.ring.rx, SMALL.ring.ry);

  return (
    <g>
      <ellipse cx={fmt(STACK.cx + STACK_SHADOW.dx * reach)} cy={fmt(shadowCy)} rx={STACK.rx} ry={STACK.ry} className="fk ln" style={{ opacity: T.stackShadow(f) }} />
      <Pill cx={60} cy={235} length={43} angle={33.5} dy={float} />
      <Diamond cx={DIAMOND.cx} cy={DIAMOND.cy + bob} hw={DIAMOND.hw} hh={DIAMOND.hh} rotate={T.diamondSpin(f)} skew={Math.sin((T.diamondSpin(f) * Math.PI) / 180) * 18} scale={T.diamondScale(f)} strokeWidth={3.2} />

      {coins.map((c, i) => (
        <Coin key={i} cx={STACK.cx} topCy={c.top} t={c.t} />
      ))}
      <Coin cx={STACK.cx} topCy={topCoin} t={STACK.t} sy={sy} ring />

      {spark > 0 && spark < 1 &&
        SPARKS.map(([x, y, dir], i) => (
          <circle
            key={i}
            cx={fmt(x + dir * 6 * ease.outQuad(spark))}
            cy={fmt(y - 19 * ease.outCubic(spark))}
            r={fmt(lerp(3, 1.8, spark))}
            className={`ln spark ${i === 1 ? 'fw' : 'fk'}`}
            style={{ opacity: 1 - clamp((spark - 0.55) / 0.45) }}
          />
        ))}

      <ellipse
        cx={fmt(gx + SMALL_SHADOW.dx)}
        cy={fmt(gy + SMALL.t + SMALL_SHADOW.dy)}
        rx={SMALL.rx}
        ry={SMALL.ry}
        className="fk ln"
        style={{ opacity: smallShadow }}
      />
      <Cylinder cx={gx} topCy={smallTop} rx={SMALL.rx} ry={SMALL.ry} h={smallT}>
        <path d={ringPath} className="ln thin fn" style={{ strokeDasharray: '4.6 2.9', strokeDashoffset: fmt(-T.ringSpin(f)) }} />
      </Cylinder>
    </g>
  );
}

export const payments: SceneDef = {
  id: 'payments',
  duration: DURATION,
  staticFrame: 0,
  Art,
  content: {
    title: 'No payments yet.',
    subtitle: 'Send your first invoice.',
    copy: 'Invoices and payouts will be tracked here once you get paid.',
    action: 'Create Invoice',
    artLabel: 'A stack of coins beside a single coin, with a small floating diamond.',
  },
};
