// Headless-проверка: node scripts/check.mjs <url> <out.png> [--w=1366 --h=800 --mobile --wait=ms]
import { chromium } from 'playwright-core';
const [url, out] = process.argv.slice(2);
const opt = Object.fromEntries(process.argv.slice(4).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const W = +(opt.w || 1366), H = +(opt.h || 800);
const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome', headless: true,
  args: [...(process.env.NOGL ? ['--disable-gpu','--disable-3d-apis','--disable-webgl'] : []), '--no-sandbox', ...(process.env.NOGL ? [] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'])],
});
const ctx = await browser.newContext({
  viewport: { width: W, height: H }, deviceScaleFactor: opt.mobile ? 2 : 1,
  hasTouch: !!opt.mobile, isMobile: !!opt.mobile,
  reducedMotion: opt.reduced ? 'reduce' : 'no-preference',
});
const page = await ctx.newPage();
const errors = [], logs = [];
page.on('console', (m) => { const t = m.type(); (t === 'error' || t === 'warning' ? errors : logs).push(`[${t}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
page.on('requestfailed', (r) => errors.push('[requestfailed] ' + r.url()));
page.on('response', (r) => { if (r.status() >= 400) errors.push(`[http ${r.status()}] ${r.url()}`); });
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => window.__universeReady === true, null, { timeout: 90000 }).catch(() => errors.push('[timeout] __universeReady'));
if (opt.mode) await page.waitForFunction((m) => window.__universe?.mode === m, opt.mode, { timeout: 120000 }).catch(() => errors.push('[timeout] mode ' + opt.mode));
await page.waitForTimeout(+(opt.wait || 3000));
if (opt.hoverPlanet) { const p = await page.evaluate((i) => window.__universe.screenOf(i), +opt.hoverPlanet); console.log('planet at', p); await page.mouse.move(p.x, p.y); await page.waitForTimeout(2500); }
if (opt.clickPlanet) { const p = await page.evaluate((i) => window.__universe.screenOf(i), +opt.clickPlanet); await page.mouse.click(p.x, p.y); await page.waitForTimeout(+(opt.after || 9000)); }
if (opt.click) { await page.mouse.click(+opt.click.split(',')[0], +opt.click.split(',')[1]); await page.waitForTimeout(+(opt.after || 4000)); }
if (opt.hover) { await page.mouse.move(+opt.hover.split(',')[0], +opt.hover.split(',')[1]); await page.waitForTimeout(1500); }
await page.screenshot({ path: out });
const info = await page.evaluate(() => {
  const c = document.querySelector('canvas');
  return { canvas: !!c, w: c?.width, h: c?.height, level: window.__universe?.level, mode: window.__universe?.mode, fallback: document.body.classList.contains('is-fallback') };
});
console.log(JSON.stringify({ info, errors, logs: logs.slice(0, 8) }, null, 1));
await browser.close();
