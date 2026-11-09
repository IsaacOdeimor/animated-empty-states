import { useState } from 'react';
import { CodeDialog, SOURCE_ZIP, sceneName } from './components/CodeDialog';
import { EmptyState } from './components/EmptyState';
import { SCENES, type SceneDef } from './scenes';

const only = new URLSearchParams(window.location.search).get('only');

function CodeIcon() {
  return (
    <svg className="code-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M5.5 4.5 2 8l3.5 3.5M10.5 4.5 14 8l-3.5 3.5" />
    </svg>
  );
}

export default function App() {
  const scenes = only ? SCENES.filter((s) => only.split(',').includes(s.id)) : SCENES;
  const [codeScene, setCodeScene] = useState<SceneDef | null>(null);

  return (
    <main className="page">
      <header className="page-head">
        <h1>Animated empty states</h1>
        <p>Four empty states, drawn in SVG and animated part by part. Select an illustration to replay it.</p>
        <p className="page-links">
          <a href={SOURCE_ZIP} download>
            Download the source (.zip)
          </a>
          <span aria-hidden="true">·</span>
          <span>or open the code for any one below</span>
        </p>
      </header>

      <section className="grid" aria-label="Empty state examples">
        {scenes.map((s) => (
          <div className="es-cell" key={s.id}>
            <EmptyState scene={s} />
            <button type="button" className="code-trigger" aria-haspopup="dialog" onClick={() => setCodeScene(s)}>
              <CodeIcon />
              <span>
                Code<span className="visually-hidden"> for the {sceneName(s)} empty state</span>
              </span>
            </button>
          </div>
        ))}
      </section>

      <footer className="credit">
        Recreation of{' '}
        <a href="https://x.com/desdivj/status/2119377174713229695" target="_blank" rel="noreferrer">
          animated empty states by Divan Raj
        </a>
        .
      </footer>

      <CodeDialog scene={codeScene} onClose={() => setCodeScene(null)} />
    </main>
  );
}
