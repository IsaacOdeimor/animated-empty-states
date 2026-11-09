import { clamp, clipFrame, ease, floatCycle, fmt, grey, track } from '../lib/anim';
import type { Pt } from '../lib/iso';
import { Cylinder, Pill, Seg } from './parts';
import type { SceneDef } from './types';

/* ------------------------------------------------------------------ */
/* Geometry — a push button on a wide base, drawn as stacked ellipses */
/* ------------------------------------------------------------------ */
const CX = 139;
const BASE = { topCy: 189, rx: 77.5, ry: 39, h: 22 };
const BODY = { topCy: 153, rx: 49, ry: 27.5, h: 34 };
const KNOB = { topCy: 142.5, rx: 18.5, ry: 8.5, h: 13 };
/** the button body squashes around the line where it meets the base */
const PIVOT = 214.5;
const SHADOW = { cx: 122, cy: 218, rx: 77.5, ry: 39 };
const BADGE = { cx: 139, cy: 63, r: 15.7 };

/** rays above the button: left side, mirrored for the right */
const RAYS: [Pt, Pt][] = [
  [[32.5, 139], [59, 146.5]],
  [[51.5, 106.5], [71.5, 124]],
  [[82.5, 83.5], [92.5, 108.5]],
];
/** order in which rays flicker after each press (index into RAYS) and delay in frames */
const RAY_FLICKER = [
  { ray: 1, delay: 0 },
  { ray: 0, delay: 2 },
  { ray: 2, delay: 4 },
];

/* ------------------------------------------------------------------ */
/* Timing — keys are reference-clip frame numbers (60 fps, 1-based).  */
/* One pass = 218 frames (≈3.6 s).                                    */
/* ------------------------------------------------------------------ */
const DURATION = 218;
/** three presses; ripple rings start a few frames after each */
const PRESSES = [23, 47, 99];
const RING_STARTS = [27.5, 51.5, 103.5];
const RING = { grow: 16, life: 24, fadeFrom: 14, rxGrow: 39, ryGrow: 21 };

const T = {
  squash: track([
    [0, 1],
    [23, 1], [25, 0.989], [27, 0.888, ease.outQuad], [29, 0.978], [31, 1.022], [33, 1],
    [47, 1], [49, 0.966], [51, 0.91, ease.outQuad], [53, 1.01], [55, 1],
    [99, 1], [101, 0.989], [103, 0.888, ease.outQuad], [105, 1], [107, 1.022], [109, 1],
  ]),
  /** extra travel of the small knob into the body */
  knobSink: track([[0, 0], [23, 0], [25, 1.5], [27, 1], [29, -1.5], [31, -1], [33, 0], [47, 0], [49, 5], [51, 0], [53, -1.5], [55, 0], [99, 0], [101, 1.5], [103, 1], [105, -1.5], [107, -1], [109, 0]]),
  /** rays fade to grey once the check appears, then return */
  rayGrey: track([[0, 10], [134, 10], [137, 60], [139, 142], [142, 185], [185, 185], [187, 157], [190, 85], [193, 10]]),
  badgeR: track([[0, 0], [131, 0], [133, 8.1, ease.linear], [135, 12.1], [137, 14.1], [139, 15.6], [141, 16.1], [144, BADGE.r]]),
  /** the badge rises a little as it grows */
  badgeY: track([[0, 69], [131, 69], [133, 67.5], [135, 64.5], [137, 63.5], [139, BADGE.cy]]),
  check: track([[0, 0], [139.5, 0], [143.5, 1, ease.outQuad]]),
  badgeOpacity: track([[0, 1], [189, 1], [193, 0, ease.linear]]),
  badgeRise: track([[0, 0], [186, 0], [192, -6, ease.inQuad]]),
};

function rayFlicker(f: number, ray: number) {
  let dim = 0;
  for (const p of PRESSES) {
    for (const r of RAY_FLICKER) {
      if (r.ray !== ray) continue;
      const q = (f - (p + 5 + r.delay)) / 5;
      if (q > 0 && q < 1) dim = Math.max(dim, Math.sin(Math.PI * q));
    }
  }
  return dim;
}

function Ring({ f, start }: { f: number; start: number }) {
  const age = f - start;
  if (age < 0 || age > RING.life) return null;
  const g = ease.outCubic(clamp(age / RING.grow));
  const fade = 1 - clamp((age - RING.fadeFrom) / (RING.life - RING.fadeFrom));
  return (
    <ellipse
      cx={CX}
      cy={fmt(BASE.topCy + BASE.h + 1.5 * g)}
      rx={fmt(BASE.rx + RING.rxGrow * g)}
      ry={fmt(BASE.ry + RING.ryGrow * g)}
      className="fn"
      style={{ stroke: grey(68), strokeWidth: 4.8 - 0.4 * g, opacity: fade }}
    />
  );
}

function Art({ f: t }: { f: number }) {
  const f = clipFrame(t);
  const s = T.squash(f);
  const sink = T.knobSink(f);
  const bodyTop = PIVOT - (PIVOT - BODY.topCy) * s;
  const knobTop = PIVOT - (PIVOT - KNOB.topCy) * s + sink;
  const rayColor = T.rayGrey(f);
  const badgeR = T.badgeR(f);
  const badgeOpacity = T.badgeOpacity(f);
  const float = floatCycle(f, DURATION) * -4;

  const k = BADGE.r / 15.7;
  const check = `M${fmt(-6.5 * k)} ${fmt(0.5 * k)} L${fmt(-2 * k)} ${fmt(5 * k)} L${fmt(6.5 * k)} ${fmt(-4.5 * k)}`;
  const checkLen = 21.5 * k;

  return (
    <g>
      {RING_STARTS.map((r) => (
        <Ring key={r} f={f} start={r} />
      ))}

      <ellipse cx={SHADOW.cx} cy={SHADOW.cy} rx={SHADOW.rx} ry={SHADOW.ry} className="fk ln" />
      <Pill cx={133.5} cy={281.5} length={39} angle={31} dy={float} />

      <Cylinder cx={CX} {...BASE} />
      <Cylinder cx={CX} topCy={bodyTop} rx={BODY.rx} ry={BODY.ry * s} h={BODY.h * s} />
      <Cylinder cx={CX} topCy={knobTop} rx={KNOB.rx} ry={KNOB.ry * s} h={KNOB.h * s - sink} />

      {[1, -1].map((side) =>
        RAYS.map(([a, b], i) => {
          const dim = rayFlicker(f, i);
          const dir: Pt = [b[0] - a[0], b[1] - a[1]];
          const len = Math.hypot(dir[0], dir[1]);
          const shift = -3 * dim; // a flickering ray kicks outward a touch
          const m = (p: Pt): Pt => [side === 1 ? p[0] + (dir[0] / len) * shift : 2 * CX - (p[0] + (dir[0] / len) * shift), p[1] + (dir[1] / len) * shift];
          return (
            <Seg
              key={`${side}${i}`}
              a={m(a)}
              b={m(b)}
              className="ln ray"
              style={{ stroke: grey(rayColor + (200 - rayColor) * dim * 0.85) }}
            />
          );
        }),
      )}

      {badgeR > 0.5 && badgeOpacity > 0.01 && (
        <g transform={`translate(${BADGE.cx} ${fmt(T.badgeY(f) + T.badgeRise(f))})`} style={{ opacity: badgeOpacity }}>
          <circle r={fmt(badgeR)} className="ln fl" />
          <path
            d={check}
            className="ln fn"
            style={{ strokeDasharray: checkLen, strokeDashoffset: fmt(checkLen * (1 - T.check(f))) }}
          />
        </g>
      )}
    </g>
  );
}

export const notifications: SceneDef = {
  id: 'notifications',
  duration: DURATION,
  staticFrame: 160, // check badge showing
  Art,
  content: {
    title: 'All caught up.',
    subtitle: 'Nothing new here.',
    copy: 'I’ll let you know the moment something needs your attention.',
    action: 'Notification Settings',
    artLabel: 'A push button with rays around it and a small check mark badge above.',
  },
};
