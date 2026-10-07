// SPDX-License-Identifier: GPL-2.0-or-later
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE
  ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const browser = await chromium.launch({headless:true,
  ...(process.env.BROWSER_CHANNEL ? {channel:process.env.BROWSER_CHANNEL} : {})});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e=>errors.push(e.message));
const ready = text => page.waitForFunction(t=>document.querySelector('#status').textContent.includes(t),text);
const count = async () => Number((await page.locator('#timing').textContent()).split(' instructions')[0].replaceAll(',',''));
try {
  await page.goto(process.env.PMARS_URL || 'http://127.0.0.1:8765/docs/');
  const loop = ';redcode-94\n;name Loop\n;assert 1\njmp 0\n';
  await page.locator('#first').fill(loop); await page.locator('#second').fill(loop);
  await page.locator('#editSettings').click();
  await page.locator('#speed').fill('5');
  await page.locator('#cycles').fill('10');
  await page.locator('#run').click(); await ready('Battle complete');
  assert.equal(await count(),20,'Ten cycles with two living warriors must stop after twenty instructions');

  await page.locator('#reset').click(); await ready('Paused before');
  assert.equal(await count(),0);
  assert.equal(await page.locator('#run').textContent(),'Run battle');
  assert.equal(await page.locator('#series').isEnabled(),true);
  await page.locator('#cycles').fill('3');
  await page.locator('#run').click(); await ready('Battle complete');
  assert.equal(await count(),6,'Run at instruction zero must apply edited cycle limit');
  assert((await page.locator('#activeSettings').textContent()).includes('3 per warrior'));

  // After execution begins, Resume retains the loaded match and its visible limit.
  await page.locator('#cycles').fill('30');
  await page.locator('#reset').click(); await ready('Paused before');
  await page.locator('#step').click(); await ready('Paused after');
  assert.equal(await page.locator('#run').textContent(),'Resume battle');
  await page.locator('#cycles').fill('2');
  assert((await page.locator('#activeSettings').textContent()).includes('30 per warrior'));
  await page.locator('#run').click(); await ready('Battle complete');
  assert.equal(await count(),60);

  // Series must be launchable from both paused and actively running battles.
  await page.locator('#reset').click(); await ready('Paused before');
  await page.locator('#rounds').fill('100');
  await page.locator('#series').click(); await ready('Series complete');
  assert((await page.locator('#scores').textContent()).includes('100 ties'));
  await page.locator('#cycles').fill('10000000');
  await page.locator('#reset').click(); await ready('Paused before');
  await page.locator('#run').click(); await ready('Battle running');
  assert.equal(await page.locator('#series').isEnabled(),true);
  await page.locator('#cycles').fill('2');
  await page.locator('#series').click(); await ready('Series complete');
  assert.equal(await page.locator('#progress').getAttribute('value'),'100');
  assert((await page.locator('#scores').textContent()).includes('100 ties'));
  assert.deepEqual(errors,[]);
  console.log('PASS: exact cycle-limit completion, Run after Reset, edited startup settings, preserved resume settings, 100-round series from paused and running battles.');
} finally { await browser.close(); }
