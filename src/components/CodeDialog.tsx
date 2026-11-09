import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ART } from '../config';
import { toStandaloneSvg } from '../lib/svgExport';
import type { SceneDef } from '../scenes/types';

/** Built by `npm run build:site` (scripts/pack-source.mjs) next to index.html. */
export const SOURCE_ZIP = '/empty-states-source.zip';

/** Raw source text, loaded on demand (each file becomes its own small chunk). */
const sources = import.meta.glob<string>(['../scenes/*.tsx', '../scenes/types.ts', '../lib/anim.ts', '../lib/iso.ts'], {
  query: '?raw',
  import: 'default',
});

export const sceneName = (s: SceneDef) => s.id.charAt(0).toUpperCase() + s.id.slice(1);

/** The scene file first, then the helpers it imports. */
const filesFor = (s: SceneDef) => [`scenes/${sceneName(s)}.tsx`, 'scenes/parts.tsx', 'lib/anim.ts', 'lib/iso.ts', 'scenes/types.ts'];

const basename = (path: string) => path.slice(path.lastIndexOf('/') + 1);

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

function downloadText(text: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

type Tab = 'svg' | 'react';

function CodePanel({ scene }: { scene: SceneDef }) {
  const { Art } = scene;
  const files = filesFor(scene);
  const previewRef = useRef<SVGSVGElement>(null);
  const [tab, setTab] = useState<Tab>('svg');
  const [file, setFile] = useState(0);
  const [svgCode, setSvgCode] = useState('');
  const [source, setSource] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<number>();
  useEffect(() => () => window.clearTimeout(copiedTimer.current), []);

  // The panel mounts on the SVG tab, so the still preview is in the DOM here.
  useLayoutEffect(() => {
    if (previewRef.current) setSvgCode(toStandaloneSvg(previewRef.current, ART.viewBox));
  }, []);

  const path = files[file];
  useEffect(() => {
    if (tab !== 'react') return;
    let live = true;
    setSource(null);
    sources[`../${path}`]?.().then((text) => {
      if (live) setSource(text.replace(/\r\n/g, '\n'));
    });
    return () => {
      live = false;
    };
  }, [tab, path]);

  useEffect(() => setCopied(false), [tab, path]);

  const code = tab === 'svg' ? svgCode : (source ?? '');
  const filename = tab === 'svg' ? `${scene.id}-empty-state.svg` : basename(path);

  const tabProps = (id: Tab) => ({
    role: 'tab' as const,
    id: `code-tab-${id}`,
    'aria-selected': tab === id,
    'aria-controls': 'code-tabpanel',
    tabIndex: tab === id ? 0 : -1,
    className: 'code-tab',
    onClick: () => setTab(id),
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const next: Tab = tab === 'svg' ? 'react' : 'svg';
      setTab(next);
      document.getElementById(`code-tab-${next}`)?.focus();
    },
  });

  return (
    <>
      <div className="code-tabs" role="tablist" aria-label="Code format">
        <button type="button" {...tabProps('svg')}>
          SVG
        </button>
        <button type="button" {...tabProps('react')}>
          React + TypeScript
        </button>
      </div>

      <div id="code-tabpanel" role="tabpanel" aria-labelledby={`code-tab-${tab}`} className="code-tabpanel">
        {tab === 'svg' ? (
          <div className="code-intro">
            <svg ref={previewRef} className="es-svg code-preview" viewBox={ART.viewBox} aria-hidden="true" focusable="false">
              <Art f={scene.staticFrame} />
            </svg>
            <p className="code-note">
              A still of the illustration with its colours and strokes written inline, ready to paste into Figma or any web
              page. The animation is in the React version.
            </p>
          </div>
        ) : (
          <div className="code-intro">
            <div className="code-files" role="group" aria-label="Files">
              {files.map((p, i) => (
                <button
                  key={p}
                  type="button"
                  className="code-file"
                  aria-pressed={i === file}
                  onClick={() => setFile(i)}
                >
                  {basename(p)}
                </button>
              ))}
            </div>
            <p className="code-note">
              The scene draws every part as a function of the frame number <code>f</code>; the other files are the small
              helpers it imports. To run it, download the full project.
            </p>
          </div>
        )}

        <div className="code-toolbar">
          <span className="code-filename">{filename}</span>
          <span className="code-status" role="status">
            {copied ? 'Copied' : ''}
          </span>
          <button
            type="button"
            className="code-btn"
            disabled={!code}
            onClick={async () => {
              const ok = await copyText(code);
              setCopied(ok);
              window.clearTimeout(copiedTimer.current);
              copiedTimer.current = window.setTimeout(() => setCopied(false), 1800);
            }}
          >
            Copy
          </button>
          <button
            type="button"
            className="code-btn"
            disabled={!code}
            onClick={() => downloadText(code, filename, tab === 'svg' ? 'image/svg+xml' : 'text/plain')}
          >
            Download
          </button>
        </div>
        <pre className="code-block" tabIndex={0} aria-label={`${filename} source`}>
          <code>{code || 'Loading…'}</code>
        </pre>
      </div>
    </>
  );
}

export function CodeDialog({ scene, onClose }: { scene: SceneDef | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (scene && !d.open) d.showModal();
    else if (!scene && d.open) d.close();
  }, [scene]);

  return (
    <dialog
      ref={ref}
      className="code-dialog"
      aria-labelledby="code-title"
      onClose={onClose}
      onClick={(e) => {
        // a click on the backdrop lands on the <dialog> element itself
        if (e.target === e.currentTarget) ref.current?.close();
      }}
    >
      {scene && (
        <div className="code-inner">
          <header className="code-head">
            <h2 id="code-title">{sceneName(scene)} empty state · code</h2>
            <button type="button" className="code-close" onClick={() => ref.current?.close()} aria-label="Close">
              <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
              </svg>
            </button>
          </header>
          <CodePanel key={scene.id} scene={scene} />
          <footer className="code-foot">
            <a href={SOURCE_ZIP} download>
              Download the full project (.zip)
            </a>
            <span>React 18 · TypeScript · Vite · no animation library</span>
          </footer>
        </div>
      )}
    </dialog>
  );
}
