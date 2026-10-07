import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'msedge'});
const page=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const source=';redcode\n;name Loop\n;assert WARRIORS == 2\njmp 0\n';
const compiled=()=>page.waitForFunction(()=>document.querySelector('.compile-warrior').dataset.result==='ok');
try {
 await page.goto('http://127.0.0.1:8765/docs/');
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('.compile-warrior')).every(e=>e.dataset.result==='ok'));
 assert.equal(await page.locator('#consoleWindow').evaluate(e=>e.open),false);
 let validationWorkers=0;page.on('worker',()=>validationWorkers++);
 for(let i=0;i<3;i++){
  await page.locator('#first').fill(source+';edit '+i);
  await page.waitForTimeout(100);
 }
 assert.equal(validationWorkers,0,'Typing should not trigger immediate validation');
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('.compile-warrior')).every(e=>e.dataset.result==='ok'));
 assert.equal(validationWorkers,2,'One validation per warrior after the editing pause');
 assert.equal(await page.locator('#consoleWindow').evaluate(e=>e.open),false);
 await page.getByRole('button',{name:'Revalidate warrior 1',exact:true}).click();await compiled();
 assert(await page.locator('#consoleWindow').evaluate(e=>e.open));
 await page.locator('#cellSize').selectOption('4');
 assert.equal(await page.locator('#core').evaluate(c=>c.clientWidth),142*4);
 await page.locator('#cellSize').selectOption('6');
 assert.equal(await page.locator('#core').evaluate(c=>c.clientWidth),142*6);

 assert(await page.getByRole('button',{name:'Validate warrior 1',exact:true}).isVisible());
 assert(await page.getByRole('button',{name:'Validate warrior 2',exact:true}).isVisible());
 await page.locator('#cellSize').selectOption('24');
 await page.locator('#arenaExpand').click();
 assert.equal(await page.locator('#arenaExpand').getAttribute('aria-pressed'),'true');
 assert(await page.locator('.arena-viewport').evaluate(e=>e.clientHeight>innerHeight*.65));
 await page.locator('#arenaScroll').click();
 assert(await page.locator('.arena-viewport').evaluate(e=>e.clientHeight<=innerHeight*.65));
 await page.locator('#cellSize').selectOption('8');
 await page.locator('#first').fill(source);await page.locator('#second').fill(source);
 await page.locator('#editSettings').click();assert.equal(await page.locator('#editSettings').textContent(),'Collapse match settings');
 await page.locator('#editSettings').click();assert(await page.locator('#settingsFields').isHidden());
 for(const preset of ['94nop','88','nano','tiny','tinylp','94x']) {
  await page.locator('#preset').selectOption(preset);
  assert.equal(await page.locator('#fixedSeries').isChecked(),false);
 }
 await page.locator('#preset').selectOption('standard');
 await page.locator('#editSettings').click();await page.locator('#cycles').fill('10');
 await page.locator('#brief').check();
 await page.getByRole('button',{name:'Validate warrior 1',exact:true}).click();await compiled();
 assert(await page.locator('#consoleWindow').evaluate(e=>e.open));
 assert((await page.locator('#consoleOutput').textContent()).includes('JMP'));
 await page.locator('#second').fill(';redcode\n;assert 1\ninvalid 0,0\n');
 await page.getByRole('button',{name:'Validate warrior 2',exact:true}).click();
 await page.waitForFunction(()=>document.querySelectorAll('.compile-warrior')[1].dataset.result==='failed');
 await page.locator('#run').click();
 await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('error'));
 assert.equal(await page.locator('.compile-warrior').nth(1).getAttribute('data-result'),'failed');
 assert(await page.locator('#consoleWindow').evaluate(e=>e.open));
 await page.locator('#second').fill(source);
 assert.equal(await page.locator('.compile-warrior').nth(1).textContent(),'Validate');
 await page.locator('#debugStart').check();await page.locator('#run').click();
 await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Paused before'));
 assert((await page.locator('#timing').textContent()).startsWith('Cycle 0 / 10'));
 for(const cycle of [1,1,2]) {
  await page.locator('#step').click();
  await page.waitForFunction(()=>document.querySelector('#step').disabled===false);
  assert((await page.locator('#timing').textContent()).startsWith('Cycle '+cycle+' / 10'));
 }
 assert((await page.locator('#processCounts').textContent()).includes('processes'));
 assert(!(await page.locator('#scores').textContent()).includes('processes'));
 await page.locator('#pauseProcesses').check();
 await page.evaluate(()=>{
  window.processMutations=0;
  window.processObserver=new MutationObserver(list=>window.processMutations+=list.length);
  window.processObserver.observe(document.querySelector('#processCounts'),{subtree:true,childList:true,characterData:true});
 });
 await page.locator('#step').click();
 await page.waitForFunction(()=>document.querySelector('#step').disabled===false);
 assert.equal(await page.evaluate(()=>window.processMutations),0);
 await page.evaluate(()=>window.processObserver.disconnect());
 await page.locator('#pauseProcesses').uncheck();
 const before=await page.locator('#timing').textContent();
 await page.getByRole('button',{name:'Validate warrior 1',exact:true}).click();await compiled();
 assert.equal(await page.locator('#timing').textContent(),before);
 await page.locator('#run').click();
 await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Battle complete.'));
 assert((await page.locator('#timing').textContent()).startsWith('Cycle 10 / 10'));
 await page.locator('#clearConsole').click();
 assert.equal(await page.locator('#consoleOutput').textContent(),'');
 await page.locator('#rounds').fill('10000000');
 await page.locator('#cycles').fill('1000');
 await page.locator('#series').click();
 await page.waitForFunction(()=>document.querySelector('#progress').value>0);
 await page.locator('#pause').click();
 await page.waitForFunction(()=>document.querySelector('#run').textContent==='Resume series');
 const pausedRounds=await page.locator('#progress').evaluate(e=>e.value);
 await page.waitForTimeout(250);
 assert.equal(await page.locator('#progress').evaluate(e=>e.value),pausedRounds);
 await page.locator('#run').click();
 await page.waitForFunction(n=>document.querySelector('#progress').value>n,pausedRounds);
 await page.locator('#stop').click();
 const pixels=await page.evaluate(async()=>{
  const {CoreDisplay}=await import('./display.mjs');
  const host=document.createElement('div'),c=document.createElement('canvas');host.append(c);document.body.append(host);
  const d=new CoreDisplay(c);d.configure(80);d.setCellSize(24);d.apply(new Uint32Array([1,0,0,0,1,1,0,0]));
  const ctx=c.getContext('2d'),ratio=devicePixelRatio;
  const pixel=(x,y)=>Array.from(ctx.getImageData(x*ratio,y*ratio,1,1).data);
  const result={center:pixel(12,12),quarter:pixel(6,6),empty:pixel(60,12),boundary:pixel(24,12)};
  const rect=c.getBoundingClientRect();
  result.padding=d.addressAt({clientX:rect.left+14*24+12,clientY:rect.top+5*24+12});
  d.observer.disconnect();host.remove();return result;
 });
 assert.deepEqual(pixels.center,pixels.quarter,'Full execution has no internal gap');
 assert.notDeepEqual(pixels.empty,pixels.center);
 assert.notDeepEqual(pixels.boundary,pixels.center,'Cell borders separate adjacent cells');
 assert.equal(pixels.padding,null,'Padding beyond core is not a memory address');
 assert.deepEqual(errors,[]);
 console.log('PASS: cell marks, cycle progress, preset flags, settings collapse, compilation success/failure and live-match preservation.');
} catch(error) { console.log(await page.locator('#consoleOutput').textContent());console.log(await page.locator('.compile-warrior').allTextContents());throw error;} finally {await browser.close();}
