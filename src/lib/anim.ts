/**
 * Tiny keyframe toolkit.
 *
 * Every scene is a pure function of a single number: the current frame `f`
 * on a 60 fps clock (frame 0 = start of the loop). Timelines are authored in
 * frames because the reference clips were measured frame by frame at 60 fps;
 * `FPS` converts to milliseconds for the player.
 */
export const FPS = 60;
export const frameToMs = (frame: number) => (frame * 1000) / FPS;

export type Ease = (t: number) => number;

const c1 = 1.70158;

export const ease = {
  linear: (t: number) => t,
  inQuad: (t: number) => t * t,
  outQuad: (t: number) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  inCubic: (t: number) => t * t * t,
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outQuart: (t: number) => 1 - Math.pow(1 - t, 4),
  inOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
  outSine: (t: number) => Math.sin((t * Math.PI) / 2),
  inSine: (t: number) => 1 - Math.cos((t * Math.PI) / 2),
  outBack: (t: number) => 1 + (c1 + 1) * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2),
  /** Hold the previous value until the key, then jump. */
  step: (t: number) => (t < 1 ? 0 : 1),
} satisfies Record<string, Ease>;

/**
 * A keyframe: [frame, value, easing-into-this-key].
 * The easing describes the segment that *arrives* at this key.
 */
export type Key = readonly [frame: number, value: number, ease?: Ease];

export type Track = (f: number) => number;

/** Build a sampler from keyframes. Values hold flat before the first and after the last key. */
export function track(keys: readonly Key[], defaultEase: Ease = ease.inOutSine): Track {
  const ks = [...keys].sort((a, b) => a[0] - b[0]);
  return (f: number) => {
    if (f <= ks[0][0]) return ks[0][1];
    const last = ks[ks.length - 1];
    if (f >= last[0]) return last[1];
    for (let i = 1; i < ks.length; i++) {
      const b = ks[i];
      if (f <= b[0]) {
        const a = ks[i - 1];
        const span = b[0] - a[0];
        const t = span <= 0 ? 1 : (f - a[0]) / span;
        const e = b[2] ?? defaultEase;
        return a[1] + (b[1] - a[1]) * e(t);
      }
    }
    return last[1];
  };
}

export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** 0..1 progress of `f` through [start, end]. */
export const progress = (f: number, start: number, end: number) => clamp((f - start) / (end - start));

/** Mix two greys (0-255) and return a CSS colour. */
export const grey = (v: number) => {
  const c = Math.round(clamp(v, 0, 255));
  return `rgb(${c},${c},${c})`;
};

/** One gentle cosine cycle across a loop, 0 at both ends (for idle floating). */
export const floatCycle = (f: number, duration: number, cycles = 1) =>
  (1 - Math.cos((2 * Math.PI * cycles * f) / duration)) / 2;

export const fmt = (n: number) => Math.round(n * 100) / 100;

/**
 * Some scenes key their tracks with the reference clip's 1-based frame numbers
 * (the numbering ffmpeg gives extracted frames), so timeline frame t is clip frame t + 1.
 */
export const clipFrame = (t: number) => t + 1;
