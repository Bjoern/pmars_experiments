// SPDX-License-Identifier: GPL-2.0-or-later
// Serve repository root; install Playwright or set PLAYWRIGHT_MODULE to its index.mjs.
// BROWSER_CHANNEL=msedge node web/test-browser.mjs
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE
  ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
await mkdir(new URL('./test-output/', import.meta.url), {recursive: true});
const browser = await chromium.launch({headless: true,
  ...(process.env.BROWSER_CHANNEL ? {channel: process.env.BROWSER_CHANNEL} : {})});
const page = await browser.newPage({viewport: {width: 1280, height: 1100}});
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const ready = text => page.waitForFunction(text =>
  document.querySelector('#status').textContent.includes(text), text);
const count = async () => Number((await page.locator('#timing').textContent()).split(' instructions')[0].replaceAll(',',''));
try {
  await page.goto(process.env.PMARS_URL || 'http://127.0.0.1:8765/web/');
  await page.locator('#step').click();
  await ready('Paused after');
  assert.equal(await count(), 1);
  await page.locator('#step').click();
  assert.equal(await count(), 2);
  await page.locator('#run').click();
  await ready('Battle running');
  await page.waitForFunction(() => Number(document.querySelector('#timing').textContent.split(' instructions')[0].replaceAll(',','')) > 50);
  await page.locator('#pause').click();
  const paused = await count();
  await page.waitForTimeout(150);
  assert.equal(await count(), paused, 'Paused simulator must not advance');
  await page.locator('#stop').click();
  assert(await page.locator('#pause').isDisabled());

  // Sustained maximum-speed visualization while measuring page heartbeat.
  const imp = ';redcode-94\n;assert 1\nmov.i 0,1\n';
  await page.locator('#first').fill(imp);
  await page.locator('#second').fill(imp);
  await page.getByText('Match settings',{exact:true}).click();
  await page.locator('#cycles').fill('10000000');
  await page.locator('#speed').fill('5');
  await page.locator('#run').click();
  await ready('Battle running');
  const pulse = await page.evaluate(() => new Promise(resolve => {
    const deltas = [];
    let previous = performance.now();
    const interval = setInterval(() => {
      const now = performance.now();
      deltas.push(now - previous);
      previous = now;
      if (deltas.length >= 100) { clearInterval(interval); resolve(deltas); }
    }, 10);
  }));
  await page.locator('#pause').click();
  assert(Math.max(...pulse) < 250, 'Visual simulation blocked page heartbeat');
  const timing = await page.locator('#timing').textContent();
  await page.screenshot({path: new URL('./test-output/browser-desktop.png', import.meta.url).pathname.replace(/^\/(\w:)/, '$1'), fullPage:true});
  await page.locator('#stop').click();

  // 100 headless matches with visible progress and scores.
  await page.locator('#cycles').fill('1000');
  await page.locator('#rounds').fill('100');
  await page.locator('#series').click();
  await ready('Series complete');
  assert((await page.locator('#scores').textContent()).includes('100 ties'));
  assert.equal(await page.locator('#progress').getAttribute('value'), '100');

  await page.locator('#stop').click();
  // Malformed assembly must recover; long compilation remains cancellable.
  await page.locator('#first').fill(';redcode-94\n;assert 1\ninvalid 0,0\n');
  await page.locator('#run').click();
  await ready('error');
  assert((await page.locator('#log').textContent()).length > 0);
  await page.locator('#first').fill(imp);
  await page.locator('#step').click();
  await ready('Paused after');
  assert.equal(await count(),1);
  await page.locator('#run').click();
  await page.locator('#stop').click();
  await ready('Stopped');
  await page.waitForTimeout(150);
  assert((await page.locator('#status').textContent()).includes('Stopped'));
  await page.locator('#step').click();
  await ready('Paused after');

  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(100);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile horizontal overflow');
  await page.screenshot({path: new URL('./test-output/browser-mobile.png', import.meta.url).pathname.replace(/^\/(\w:)/, '$1'), fullPage:true});
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({result:'PASS', maxHeartbeatGapMs:Math.max(...pulse), timing,
    checks:['single step','pause/resume','stop','high-speed responsiveness','100-round worker series',
      'assembly errors','restart','cancel loading','mobile layout','no page errors']},null,2));
} finally { await browser.close(); }
