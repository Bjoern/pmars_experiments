// SPDX-License-Identifier: GPL-2.0-or-later
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const browser=await chromium.launch({headless:true,channel:'msedge'}),page=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:8765/docs/');await page.locator('#newWarrior').click();
 const source=';redcode\n;name Editor test\n;assert 1\nmov missing,0\n';
 await page.locator('#first').fill(source);
 await page.locator('#first').press('Control+Home');await page.locator('#first').press('Tab');
 assert(await page.locator('#first').evaluate(el=>el===document.activeElement));assert((await page.locator('#first').innerText()).startsWith('  ;redcode'));
 await page.locator('#first').press('Shift+Tab');assert((await page.locator('#first').innerText()).startsWith(';redcode'));
 await page.waitForFunction(()=>document.querySelector('.compile-warrior').dataset.result==='failed');
 assert(await page.locator('.cm-lintRange-error').count()>0);
 await page.getByRole('button',{name:'Edit or collapse warrior 1',exact:true}).click();
 await page.locator('#consoleWindow summary').click();
 await page.locator('.source-diagnostic').first().click();
 assert(await page.locator('#first').isVisible());assert(await page.locator('#first').evaluate(el=>el===document.activeElement));
 assert((await page.evaluate(()=>window.getSelection().toString())).includes('mov missing,0'));
 await page.locator('#first').fill(';redcode\n;name Editor test\n;assert 1\nmov.i 0,1\n');
 await page.waitForFunction(()=>document.querySelector('.compile-warrior').dataset.result==='ok');
 assert.equal(await page.locator('.cm-lintRange-error').count(),0);
 assert(await page.locator('.cm-line span').count()>0,'Redcode has syntax highlighting');
 const beforeTheme=await page.locator('#first').textContent();const backgrounds=[];
 for(const name of ['light','contrast','dark']){await page.locator('#editorTheme').selectOption(name);backgrounds.push(await page.locator('.cm-editor').evaluate(el=>getComputedStyle(el).backgroundColor));assert.equal(await page.locator('#first').textContent(),beforeTheme);}
 assert.equal(new Set(backgrounds).size,3);
 await page.getByRole('button',{name:'Edit or collapse warrior 1',exact:true}).click();assert(await page.locator('#first').isHidden());
 await page.getByRole('button',{name:'Edit warrior 1',exact:true}).click();assert(await page.locator('#first').isVisible());

 await page.locator('#first').press('Control+End');await page.locator('#first').press('End');await page.keyboard.type('; undo me');
 await page.locator('#first').press('Control+z');assert(!(await page.locator('#first').textContent()).includes('undo me'));
 await page.locator('#first').press('Control+f');assert(await page.locator('.cm-search').isVisible());await page.locator('.cm-search input').first().press('Escape');
 await page.locator('#reset').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Paused before'));
 const before=await page.locator('#legendNames .process-count').boundingBox();await page.locator('#step').click();const after=await page.locator('#legendNames .process-count').boundingBox();assert.equal(before.width,after.width);
 assert.equal(await page.locator('#addConsole').evaluate(el=>el.parentElement.id),'execution');
 await page.screenshot({path:'docs/test-output/editor-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:'docs/test-output/editor-mobile.png',fullPage:true});
 await page.locator('#editorTheme').selectOption('light');await page.reload();assert.equal(await page.locator('#editorTheme').inputValue(),'light');
 assert.deepEqual(errors,[]);console.log('PASS: Redcode editor highlighting, delayed diagnostics, error navigation, undo/search, stable process counter width, console placeholder and mobile layout.');
}finally{await browser.close();}
