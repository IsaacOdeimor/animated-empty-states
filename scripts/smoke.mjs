/**
 * Smoke test for playback behaviour (not visuals):
 *  - illustrations autoplay once on screen and are replayable by click and keyboard
 *  - prefers-reduced-motion renders a static pose with no replay control
 *  - action buttons are focusable and only show a "demo" note
 *  - nothing overflows horizontally at 320px
 *
 *   node scripts/smoke.mjs
 */
import { createServer } from 'vite';
import puppeteer from 'puppeteer-core';
import { resolve } from 'node:path';

const chrome = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const server = await createServer({ root: resolve('.'), server: { port: 5186, strictPort: false }, logLevel: 'error' });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await puppeteer.launch({ executablePath: chrome, headless: true });
let failures = 0;
const check = (ok, msg) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!ok) failures++;
};
const svgSnapshot = (page, i) => page.$$eval('.es-svg', (els, n) => els[n].innerHTML, i);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(url, { waitUntil: 'networkidle0' });

  check((await page.$$('.es-card')).length === 4, 'four empty states render');
  const a = await svgSnapshot(page, 0);
  await sleep(700);
  const b = await svgSnapshot(page, 0);
  check(a !== b, 'illustration animates while on screen');

  const hits = await page.$$('.es-art-hit');
  check(hits.length === 4, 'each illustration is a replay button');
  // Replay should jump back to the opening pose. Projects holds perfectly still for its first
  // ~18 frames (the other scenes have idle floating), so it gives an exact comparison.
  const restPage = await browser.newPage();
  await restPage.setViewport({ width: 1440, height: 900 });
  await restPage.goto(`${url}?frame=0`, { waitUntil: 'networkidle0' });
  const rest = await svgSnapshot(restPage, 0);
  await restPage.close();

  const projectsHit = '.es-card[data-scene="projects"] .es-art-hit';
  await page.reload({ waitUntil: 'networkidle0' });
  await sleep(1300);
  check((await svgSnapshot(page, 0)) !== rest, 'Projects is mid-motion 1.3 s after load');
  await page.focus(projectsHit);
  await page.keyboard.press('Enter');
  await sleep(80);
  check((await svgSnapshot(page, 0)) === rest, 'Enter on an illustration replays it from the start');
  await sleep(1200);
  check((await svgSnapshot(page, 0)) !== rest, 'replayed animation is running');
  await page.click(projectsHit);
  await sleep(80);
  check((await svgSnapshot(page, 0)) === rest, 'click on an illustration replays it from the start');

  await page.focus('.es-action');
  await page.keyboard.press('Enter');
  await sleep(50);
  const note = await page.$eval('.es-note', (el) => el.textContent);
  check(/demo/i.test(note ?? ''), `action button shows a demo note ("${note}")`);

  const titles = await page.$$eval('.es-title', (els) => els.map((e) => e.textContent));
  check(titles.length === 4 && titles.every(Boolean), `headings: ${titles.join(' | ')}`);

  await page.setViewport({ width: 320, height: 800 });
  await sleep(150);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(overflow <= 0, `no horizontal overflow at 320px (overflow ${overflow}px)`);

  const rm = await browser.newPage();
  await rm.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await rm.setViewport({ width: 1440, height: 900 });
  await rm.goto(url, { waitUntil: 'networkidle0' });
  const r1 = await svgSnapshot(rm, 1);
  await sleep(700);
  const r2 = await svgSnapshot(rm, 1);
  check(r1 === r2, 'reduced motion: illustration is static');
  check((await rm.$$('.es-art-hit')).length === 0, 'reduced motion: no replay buttons');
  check((await rm.$$('.es-art-static[role="img"]')).length === 4, 'reduced motion: static art exposed as images');

  check(errors.length === 0, `no console errors${errors.length ? ': ' + errors.join('; ') : ''}`);
} finally {
  await browser.close();
  await server.close();
}
process.exit(failures ? 1 : 0);
