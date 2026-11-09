/**
 * Global playback tokens. Per-scene timing lives at the top of each file in
 * src/scenes (keyframes are in 60 fps frames, measured from the reference clips).
 * Colours and stroke weights are CSS custom properties in src/styles.css.
 */
export const PLAYER = {
  /** rest between loops, in ms */
  pauseMs: 1400,
  /** fraction of the illustration that must be visible before it plays */
  viewThreshold: 0.4,
};

export const ART = {
  /** every illustration is drawn in the same 360 × 330 box */
  viewBox: '0 0 360 330',
};
