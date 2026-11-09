import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { FPS, frameToMs } from './anim';
import { PLAYER } from '../config';

/* ------------------------------------------------------------------ */
/* Debug / comparison hooks                                            */
/*   ?frame=120  freeze every illustration on frame 120                */
/*   ?speed=0.25 slow every timeline down                              */
/*   window.__emptyStates.setFrame(n | null) does the same at runtime  */
/* ------------------------------------------------------------------ */
const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
let frozenFrame: number | null = params?.has('frame') ? Number(params.get('frame')) : null;
const speed = params?.has('speed') ? Math.max(0.05, Number(params.get('speed')) || 1) : 1;
const listeners = new Set<() => void>();

if (typeof window !== 'undefined') {
  (window as unknown as { __emptyStates: unknown }).__emptyStates = {
    setFrame(n: number | null) {
      frozenFrame = n;
      listeners.forEach((l) => l());
    },
  };
}

const subscribeFrozen = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
const useFrozenFrame = () => useSyncExternalStore(subscribeFrozen, () => frozenFrame, () => null);

/* ------------------------------------------------------------------ */

const reducedQuery = '(prefers-reduced-motion: reduce)';

export function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(reducedQuery).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(reducedQuery);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

export interface PlayerOptions {
  /** length of one pass of the timeline, in 60 fps frames */
  duration: number;
  /** frame shown when motion is reduced (a composed, readable pose) */
  staticFrame: number;
  /** rest between loops, ms */
  pauseMs?: number;
}

/**
 * Plays a frame-based timeline while the element is on screen, rests between
 * loops, restarts on demand, and falls back to a static pose for reduced motion.
 */
export function usePlayer<T extends Element>({ duration, staticFrame, pauseMs = PLAYER.pauseMs }: PlayerOptions) {
  const ref = useRef<T>(null);
  const reduced = useReducedMotion();
  const frozen = useFrozenFrame();
  const [frame, setFrame] = useState(0);
  const raf = useRef(0);
  const startedAt = useRef<number | null>(null);

  const stop = useCallback(() => {
    cancelAnimationFrame(raf.current);
    raf.current = 0;
  }, []);

  const start = useCallback(() => {
    stop();
    startedAt.current = null;
    const playMs = frameToMs(duration);
    const tick = (now: number) => {
      if (startedAt.current === null) startedAt.current = now;
      const t = ((now - startedAt.current) * speed) % (playMs + pauseMs);
      // During the pause hold the last frame (each timeline ends on its first pose).
      setFrame(t >= playMs ? duration : (t * FPS) / 1000);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }, [duration, pauseMs, stop]);

  const animated = !reduced && frozen === null;

  useEffect(() => {
    const el = ref.current;
    if (!el || !animated) {
      stop();
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) start();
        else {
          stop();
          setFrame(0);
        }
      },
      { threshold: PLAYER.viewThreshold },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      stop();
    };
  }, [animated, start, stop]);

  const replay = useCallback(() => {
    if (animated) start();
  }, [animated, start]);

  const shown = frozen !== null ? frozen : reduced ? staticFrame : frame;
  return { ref, frame: shown, replay, interactive: animated };
}
