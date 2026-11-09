import { useEffect, useRef, useState } from 'react';
import { ART } from '../config';
import { usePlayer } from '../lib/player';
import type { SceneDef } from '../scenes/types';

function Arrow() {
  return (
    <svg className="es-action-arrow" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M2.5 8h10.5M9 3.75 13.25 8 9 12.25" />
    </svg>
  );
}

export function EmptyState({ scene }: { scene: SceneDef }) {
  const { id, Art, content } = scene;
  const { ref, frame, replay, interactive } = usePlayer<HTMLDivElement>({
    duration: scene.duration,
    staticFrame: scene.staticFrame,
  });
  const [note, setNote] = useState(false);
  const noteTimer = useRef<number>();
  useEffect(() => () => window.clearTimeout(noteTimer.current), []);

  const titleId = `${id}-title`;
  const descId = `${id}-art-desc`;

  const svg = (
    <svg className="es-svg" viewBox={ART.viewBox} aria-hidden="true" focusable="false">
      <Art f={frame} />
    </svg>
  );

  return (
    <article className="es-card" aria-labelledby={titleId} data-scene={id}>
      <h2 id={titleId} className="es-title">
        <span className="es-title-main">{content.title}</span>{' '}
        <span className="es-title-sub">{content.subtitle}</span>
      </h2>

      <div className="es-art" ref={ref}>
        <span id={descId} className="visually-hidden">
          {content.artLabel}
        </span>
        {interactive ? (
          <button type="button" className="es-art-hit" onClick={replay} aria-label="Replay animation" aria-describedby={descId}>
            {svg}
          </button>
        ) : (
          <div className="es-art-static" role="img" aria-labelledby={descId}>
            {svg}
          </div>
        )}
      </div>

      <p className="es-copy">{content.copy}</p>

      <div className="es-actions">
        <button
          type="button"
          className="es-action"
          aria-describedby={`${id}-note`}
          onClick={() => {
            setNote(true);
            window.clearTimeout(noteTimer.current);
            noteTimer.current = window.setTimeout(() => setNote(false), 2600);
          }}
        >
          <span>{content.action}</span>
          <Arrow />
        </button>
        <p id={`${id}-note`} className="es-note" role="status" data-visible={note}>
          {note ? 'Demo only — this button isn’t connected to anything.' : ''}
        </p>
      </div>
    </article>
  );
}
