// SPDX-License-Identifier: GPL-2.0-or-later
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE
  ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const browser = await chromium.launch({headless:true,
  ...(process.env.BROWSER_CHANNEL ? {channel:process.env.BROWSER_CHANNEL} : {})});
const page = await browser.newPage({viewport:{width:1280,height:1100}});
const errors = []; let workers = 0;
page.on('pageerror',e=>errors.push(e.message)); page.on('worker',()=>workers++);
const ready = text => page.waitForFunction(t=>document.querySelector('#status').textContent.includes(t),text);
const count = async () => Number(await page.locator('#timing').getAttribute('data-instructions'));
const command = async text => { await page.locator('#command').fill(text); await page.locator('#command').press('Enter'); };
try {
  await page.goto(process.env.PMARS_URL || 'http://127.0.0.1:8765/docs/');
 await page.locator('#toggleEditors').click();
  await page.locator('#first').fill(';redcode-94\n;name Alpha\n;assert 1\nmov.i 0,1\n');
  assert((await page.locator('label[for=first]').textContent()).includes('Alpha'));
  await page.locator('#debugStart').check();
  await page.locator('#run').click(); await ready('Paused before');
  assert.equal(await count(),0);
  assert.equal(await page.locator('#instruction .listing-line').count(),10);
  assert.equal(await page.locator('#execution section').count(),2);
  assert.equal(await page.locator('#execution pre').first().textContent(),'');
  await page.locator('#step').click(); await ready('Paused after');
  assert.equal(await count(),1);
  // Resizing an active arena preserves execution and cell inspection after scrolling.
  const listingBeforeZoom = await page.locator('#instruction').textContent();
  await page.locator('#cellSize').selectOption('24');
  assert.equal(await count(),1);
  assert.equal(await page.locator('#instruction').textContent(),listingBeforeZoom);
  await page.locator('.arena-viewport').scrollIntoViewIfNeeded();
  const point = await page.evaluate(()=>{
    const viewport=document.querySelector('.arena-viewport'),canvas=document.querySelector('#core');
    viewport.scrollLeft=240;viewport.scrollTop=240;
    const rect=canvas.getBoundingClientRect();
    return {x:rect.left+2*24+12,y:rect.top+12*24+12,address:12*Number(canvas.dataset.columns)+2};
  });
  await page.mouse.click(point.x,point.y);
  assert.equal(Number(await page.locator('#address').inputValue()),point.address);
  await page.locator('#cellSize').selectOption('0');
  assert(await page.locator('#core').evaluate(c=>c.clientWidth<=c.parentElement.clientWidth && Number(c.dataset.cellSize)%2===0));
  await page.locator('#cellSize').selectOption('8');

  assert((await page.locator('#execution pre').first().textContent()).includes('0000  MOV.I'));
  const beforeWorkers = workers;
  await page.locator('#run').click(); await ready('Battle running');
  await page.waitForTimeout(100); await page.locator('#run').click();
  assert.equal(workers,beforeWorkers,'Resume must not assemble a new match');
  assert(await count()>1);
  await page.locator('#reset').click(); await ready('Paused before');
  assert.equal(await count(),0);
  assert.equal(await page.locator('#execution pre').first().textContent(),'');

  await page.locator('#lines').fill('4');
  await page.locator('#address').fill('7998');
  assert.deepEqual(await page.locator('#instruction .listing-line').allTextContents().then(a=>a.map(s=>s.slice(0,4))),
    ['7998','7999','0000','0001']);
  await page.locator('#nextPage').click();
  assert.equal(await page.locator('#address').inputValue(),'2');
  await command('list 20,29');
  assert.equal(await page.locator('#instruction .listing-line').count(),10);
  assert((await page.locator('#instruction').textContent()).startsWith('0020'));
  await command('macro f5'); await ready('Paused after');
  assert.equal(await count(),1);
  assert.equal(await page.locator('#instruction .listing-line').count(),13);
  assert((await page.locator('#instruction').textContent()).includes('next: Alpha'));
  await command('alive'); await command('tproc');
  assert((await page.locator('#log').textContent()).includes('2 alive; 2 processes'));
  await page.locator('#traceMode').selectOption('combined');
  assert.equal(await page.locator('#execution pre span').count(),1);
  await page.locator('#core').click({position:{x:40,y:30}});
  assert.equal(await page.locator('#follow').inputValue(),'-1');

  await page.locator('#first').fill(';redcode-94\n;NAME Beta\n;assert 1\nadd.ab #1,0\njmp -1\n');
  assert((await page.locator('label[for=first]').textContent()).includes('Beta'));
  assert((await page.locator('#changed').textContent()).includes('Reset applies'));
  await page.getByRole('button',{name:'Remove warrior 2',exact:true}).click();
  assert.equal(await page.locator('#editors textarea').count(),1);
  await page.locator('#reset').click(); await ready('Paused before');
  await page.locator('#step').click(); await ready('Paused after');
  const trace = await page.locator('#execution').textContent();
  assert.match(trace,/ADD.AB\s+#\s*1,\s*\$\s*0/);
  assert.match(await page.locator('#instruction').textContent(),/ADD.AB\s+#\s*1,\s*\$\s*1/);
  assert((await page.locator('#scores').textContent()).includes('survived'));

  await page.locator('#newWarrior').click(); await page.locator('#newWarrior').click();
  await page.locator('#traceMode').selectOption('columns');
  await page.locator('#reset').click(); await ready('Paused before');
  assert.equal(await page.locator('#execution section').count(),3);
  await command('step 3'); await ready('Paused after');
  assert.equal(await count(),3);
  const rows = await page.locator('#execution pre').allTextContents();
  assert(rows.every(s=>s.includes('#')));
  const colors = await page.locator('#execution section').evaluateAll(nodes=>nodes.map(n=>n.style.color));
  assert.equal(new Set(colors).size,3);
  await page.screenshot({path:'docs/test-output/debugger-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(100);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:'docs/test-output/debugger-mobile.png',fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('PASS: debug start at zero, resume without reset, reset clears history, live names, wrapped listings, macros, solo/self-modifying trace, three warrior consoles, mobile layout.');
} finally { await browser.close(); }
