/**
 * Render exact frames of each illustration to PNG, for side-by-side checks
 * against frames pulled from the reference clips.
 *
 *   node scripts/capture.mjs --out ./captures --scene projects --frames 0,24,57
 *   node scripts/capture.mjs --out ./captures --page page.png   (full showcase screenshot)
 *
 * Frames are timeline frames (60 fps, 0-based). Each PNG is the 360 × 330
 * drawing box at 1:1, the same size as the reference crops.
 * Needs Chrome; set CHROME_PATH if it is not in the default Windows location.
 */
import { createServer } from 'vite';
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1]?.startsWith('--') ? 'true' : all[i + 1] ?? 'true']);
    return acc;
  }, []),
);

const out = resolve(args.out ?? 'captures');
mkdirSync(out, { recursive: true });
const chrome = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const server = await createServer({ root: resolve('.'), server: { port: 5185, strictPort: false }, logLevel: 'error' });
await server.listen();
const url = server.resolvedUrls.local[0];

const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--force-color-profile=srgb'] });
try {
  const page = await browser.newPage();
  if (args.page) {
    const width = Number(args.width ?? 1440);
    await page.setViewport({ width, height: 900, deviceScaleFactor: Number(args.dpr ?? 1) });
    const q = args.frame ? `?frame=${args.frame}` : '';
    await page.goto(url + q, { waitUntil: 'networkidle0' });
    await page.evaluate(() => document.fonts.ready);
    if (!args.frame) await new Promise((r) => setTimeout(r, Number(args.wait ?? 1200)));
    await page.screenshot({ path: join(out, args.page), fullPage: true });
    console.log('wrote', join(out, args.page));
  } else {
    const scene = args.scene;
    const frames = String(args.frames ?? '0').includes('-')
      ? (() => {
          const [a, b, step = 1] = String(args.frames).split(/[-:]/).map(Number);
          return Array.from({ length: Math.floor((b - a) / step) + 1 }, (_, i) => a + i * step);
        })()
      : String(args.frames ?? '0').split(',').map(Number);
    await page.setViewport({ width: 800, height: 900, deviceScaleFactor: 1 });
    await page.goto(`${url}?only=${scene}&frame=0`, { waitUntil: 'networkidle0' });
    await page.addStyleTag({
      content: `.es-card{max-width:none!important}.es-art{width:360px!important;min-width:0!important;margin:0!important}`,
    });
    for (const f of frames) {
      await page.evaluate((n) => window.__emptyStates.setFrame(n), f);
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      const el = await page.$('.es-svg');
      // --video-names writes f001.png… (frame + 1) to line up with ffmpeg's numbering of the clips
      const name = args['video-names'] ? `f${String(f + 1).padStart(3, '0')}.png` : `${scene}_${String(f).padStart(3, '0')}.png`;
      await el.screenshot({ path: join(out, name) });
    }
    console.log(`wrote ${frames.length} frames for ${scene} to ${out}`);
  }
} finally {
  await browser.close();
  await server.close();
}
