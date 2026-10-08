// SPDX-License-Identifier: GPL-2.0-or-later
import {Engine, settings} from './engine.mjs';
import {CoreDisplay, warriorColor, setTheme} from './display.mjs';
import {readSettings,setupSettings} from './settings-ui.mjs';
import {HistoryChart} from './charts.mjs';
const $ = id => document.getElementById(id);
const display = new CoreDisplay($('core'));
let engine = null, worker = null, workerTimer = null, generation = 0;
let state = 'idle', animation = 0, previous = 0, credit = 0, total = 0;
let fastMode = false;
let maxSlice = 0, pendingReject = null, latest = null, history = [], combined = [];
let lastText = 0, dirty = false, stepping = false, stepEpoch = 0;
let collapsedEditors=[], scoreViewKey=null;
let sources = [$('first').value, $('second').value];
let consoleText='',sessionBattles=0,countedCompleted=0,lastScoreSample=-1;
let compileStates=[], compileWorker=null, compileTimer=null, revision=0, chartRound=0;
let validationTimer=null, validationQueue=[];
function cancelAutoValidation(){clearTimeout(validationTimer);validationQueue=[];}
function nextValidation(){
 const index=validationQueue.shift();
 if(index!==undefined)checkWarrior(index,true);
}
function scheduleValidation(){
 cancelAutoValidation();
 validationTimer=setTimeout(()=>{validationQueue=sources.map((_,i)=>i);nextValidation();},1000);
}
function showConsole() {
 $('consoleWindow').open=true;
 $('consoleOutput').textContent=consoleText || 'Validate a warrior or run a battle to see assembly output here.';
}
function refreshCompileButtons() {
 document.querySelectorAll('.compile-warrior').forEach((button,i)=>{
  const result=compileStates[i] || '';
  button.textContent='↻ '+(result==='busy'?'Validating…':result==='ok'?'Valid ✓':result==='failed'?'Invalid — retry':'Validate');
  button.dataset.result=result;button.disabled=result==='busy';
 });
}
function cancelCompileCheck() {
 if(compileWorker)compileWorker.terminate();
 compileWorker=null;clearTimeout(compileTimer);
 compileStates=compileStates.map(s=>s==='busy'?'':s);
 refreshCompileButtons();
}
function checkWarrior(index,automatic=false) {
 if(!automatic)cancelAutoValidation();
 cancelCompileCheck();if(!automatic)showConsole();
 let config;
 try {config={...options(),brief:automatic,assembleOnly:true};}
 catch(error){compileStates[index]='failed';refreshCompileButtons();log(error.message);if(automatic)nextValidation();return;}
 const ticket=revision;
 if(!automatic)log('Compiling '+draftName(sources[index],index)+'…','stdout');
 compileStates[index]='busy';refreshCompileButtons();
 const w=compileWorker=new Worker(new URL('./worker.mjs',import.meta.url),{type:'module'});
 const finish=(ok,message)=>{
  if(compileWorker!==w)return;
  w.terminate();compileWorker=null;clearTimeout(compileTimer);
  if(ticket!==revision)return;
  compileStates[index]=ok?'ok':'failed';refreshCompileButtons();
  log(message,ok?'stdout':'stderr');if(!automatic)showConsole();
  if(automatic)nextValidation();
 };
 compileTimer=setTimeout(()=>finish(false,'Compilation timed out after 15 seconds.'),15000);
 w.onerror=e=>finish(false,e.message || 'Compiler worker failed.');
 w.onmessage=({data})=>{
  if(compileWorker!==w || ticket!==revision)return;
  if(data.type==='log')log(data.text,data.channel);
  else if(data.type==='error')finish(false,'Compilation failed: '+data.message);
  else if(data.type==='compiled')finish(true,'Compilation succeeded: '+draftName(sources[index],index));
 };
 w.postMessage({type:'check',index,settings:config,sources:[...sources]});
}
const pausedWarriors=new Set();
const processChart=new HistoryChart($('processChart'),'Processes / cycle in current round');
const scoreChart=new HistoryChart($('scoreChart'),'Cumulative score / completed battles');
const addressText = n => String(n).padStart(String((engine?.config.coreSize || 8000) - 1).length, '0');
function status(text) { $('status').textContent = text; }
function log(text,channel='stderr') {
 consoleText=(consoleText+text+'\n').slice(-262144);
 if($('consoleWindow').open)$('consoleOutput').textContent=consoleText;
 if(channel==='stderr')$('log').textContent=($('log').textContent+text+'\n').slice(-65536);
}
function draftName(source, i) {
  return source.match(/^\s*;name\s+([^\r\n]*)/im)?.[1].trim() || `Warrior ${i + 1}`;
}
function markDirty() {
  revision++;cancelCompileCheck();compileStates=[];refreshCompileButtons();scheduleValidation();
  dirty = !!engine || state === 'loading';
  $('changed').textContent = dirty ? 'Sources or settings changed. Run applies them before instruction 1; otherwise Reset applies them and Resume keeps the loaded battle.' : '';
}
function legend() {
  const names = engine && latest ? latest.warriors.map(w => w.name) : sources.map(draftName);
  $('legendNames').replaceChildren(...names.map((name,i) => {
    const span = document.createElement('span');
    span.style.color = warriorColor(i); span.textContent = `■ ${name}`; return span;
  }));
}
function editors() {
  $('editors').replaceChildren(...sources.map((source, i) => {
    const box = document.createElement('div'), top = document.createElement('div');
    top.className = 'editor-title';
    const label = document.createElement('label');
    label.htmlFor = i === 0 ? 'first' : i === 1 ? 'second' : `warrior-${i}`;
    label.className = 'warrior'; label.style.color = warriorColor(i);
    label.textContent = `${String(i+1).padStart(2,'0')} / ${draftName(source,i)}`;
    const remove = document.createElement('button');
    remove.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></svg>';remove.title='Remove warrior'; remove.className = 'remove-warrior';
    remove.disabled = sources.length === 1;
    remove.setAttribute('aria-label', `Remove warrior ${i+1}`);
    remove.onclick = () => { sources.splice(i,1);collapsedEditors.splice(i,1); markDirty(); editors(); };
    const save=document.createElement('button');save.textContent='Download';save.className='save-warrior';save.setAttribute('aria-label','Download warrior '+(i+1));save.onclick=()=>saveWarrior(i);
    const compile=document.createElement('button');compile.className='compile-warrior';
    compile.title='Revalidate warrior and show assembly output';compile.setAttribute('aria-label','Validate warrior '+(i+1));compile.onclick=()=>checkWarrior(i);
    const edit=document.createElement('button');edit.className='edit-warrior';
    edit.setAttribute('aria-controls',label.htmlFor);edit.setAttribute('aria-label','Edit or collapse warrior '+(i+1));
    edit.onclick=()=>{collapsedEditors[i]=collapsedEditors[i]===false;editorVisibility();if(!collapsedEditors[i])$(label.htmlFor).focus();};
    top.append(edit,label,compile,save,remove);
    const area = document.createElement('textarea');
    area.id = label.htmlFor; area.value = source; area.spellcheck = false;
    area.setAttribute('aria-label', `Warrior ${i+1} source`);
    area.oninput = () => {
      sources[i] = area.value;
      label.textContent = `${String(i+1).padStart(2,'0')} / ${draftName(area.value,i)}`;
      legend(); markDirty();
    };
    box.append(top,area); return box;
  }));
  editorVisibility();refreshCompileButtons();
  $('warriorCount').textContent = `${sources.length} warrior${sources.length === 1 ? '' : 's'}`;
  $('newWarrior').disabled = sources.length >= 36;
  legend();
}
function editorVisibility(){
 document.querySelectorAll('#editors textarea').forEach((area,i)=>{
  area.hidden=collapsedEditors[i]!==false;
  const button=document.querySelectorAll('.edit-warrior')[i];
  button.textContent=area.hidden?'▸':'▾';
  button.title=area.hidden?'Edit warrior':'Collapse editor';
  button.setAttribute('aria-expanded',String(!area.hidden));
 });
 const allClosed=sources.every((_,i)=>collapsedEditors[i]!==false);
 $('toggleEditors').textContent=allClosed?'▸ Expand all':'▾ Collapse all';
 $('toggleEditors').setAttribute('aria-expanded',String(!allClosed));
}
$('toggleEditors').onclick=()=>{
 const collapse=!sources.every((_,i)=>collapsedEditors[i]!==false);
 collapsedEditors=sources.map(()=>collapse);editorVisibility();
};
function processIndicators(update){
 if($('pauseViews').checked || $('pauseProcesses').checked)return;
 $('processCounts').replaceChildren(...update.warriors.map((w,i)=>{
  const row=document.createElement('div');row.style.color=warriorColor(i);
  row.textContent=w.name+' · '+w.tasks.toLocaleString()+' processes';return row;
 }));
}
function seriesActive() { return state.startsWith("series"); }
function controls() {
  const busy = state === 'loading' || seriesActive() || stepping;
  $('run').disabled = (busy && !['series','series-paused'].includes(state)) || state==='done';
  const running=['running','series'].includes(state), done=state==='done';
  $('run').innerHTML='<span class="control-icon" aria-hidden="true">'+(running?'Ⅱ':done?'✓':'▶')+'</span> '+(running?'Pause':done?'Done':'Run');
  $('debugRun').disabled=busy || state==='done';
  $('fast').disabled=busy || state==='done';
  $('step').disabled = busy || state === 'running' || state === 'done';
  $('reset').disabled = state === 'loading';
}
function stop() {
  setFast(false);
  cancelAutoValidation();cancelCompileCheck();
  generation++; stepEpoch++; stepping = false; cancelAnimationFrame(animation);
  if (worker) worker.terminate();
  worker = null; clearTimeout(workerTimer);
  if (pendingReject) pendingReject(new DOMException('Stopped', 'AbortError'));
  pendingReject = null; engine = null; latest = null;
  history = []; combined = []; renderTrace(); countedCompleted=0;lastScoreSample=-1;
  processChart.clear();scoreChart.clear();
  state = 'idle'; dirty = false; $('changed').textContent = ''; $('activeSettings').textContent = ''; legend();
  $('progress').hidden = true; status('Stopped. Ready for another battle.'); controls();
}
function options() { return readSettings({warriors:sources.length}); }
function work(type, config) {
  cancelAutoValidation();cancelCompileCheck();
  compileStates=sources.map(()=> '');refreshCompileButtons();
  const ticket=revision;
  const assemblyStatus=(index,ok)=>{
    if(ticket!==revision || !Number.isInteger(index))return;
    compileStates[index]=ok?'ok':'failed';refreshCompileButtons();
  };
  return new Promise((resolve, reject) => {
    pendingReject = reject;
    const w = worker = new Worker(new URL('./worker.mjs', import.meta.url), {type:'module'});
    const finish = (error, value) => {
      clearTimeout(workerTimer); w.terminate();
      if (worker === w) worker = null;
      pendingReject = null; error ? reject(error) : resolve(value);
    };
    workerTimer = setTimeout(() => finish(new Error('Assembly timed out after 15 seconds.')),15000);
    w.onerror = event => finish(new Error(event.message || 'Worker failed to load.'));
    w.onmessage = ({data}) => {
      if(worker!==w)return;
      if (data.type === 'log') log(data.text,data.channel);
      else if (data.type === 'assembly') assemblyStatus(data.index,data.ok);
      else if (data.type === 'error') {assemblyStatus(data.index,false);showConsole();finish(new Error(data.message));}
      else if (data.type === 'compiled') finish(null,data.banks);
      else if (data.type === 'paused') {
        clearTimeout(workerTimer);state='series-paused';
        $('progress').value=data.update.completed;latest=data.update;scores(data.update);sampleScores(data.update);
        status('Series paused at '+data.update.completed+' completed rounds. Resume series to continue.');controls();
      } else if (data.type === 'progress') {
        clearTimeout(workerTimer);
        $('progress').value = data.update.completed;
        status(`Series: ${data.update.completed} / ${config.rounds} rounds completed.`);
        latest=data.update;scores(data.update); sampleScores(data.update);
      } else if (data.type === 'done') finish(null,data.update);
    };
    w.postMessage({type, settings:config, sources:[...sources]});
  });
}
function scores(update) {
  processIndicators(update);
  const order=update.warriors.map((w,i)=>({w,i}));
  if($('sort').checked)order.sort((a,b)=>b.w.score-a.w.score);
  const key=JSON.stringify(order.map(({w,i})=>[w.name,w.wins,w.ties,w.losses,w.score,warriorColor(i)]));
  if(key===scoreViewKey)return;
  scoreViewKey=key;
  $('scores').replaceChildren(...order.map(({w,i}) => {
    const row = document.createElement('div'); row.className = 'score'; row.style.color = warriorColor(i);
    const outcome = update.warriors.length === 1
      ? `${w.wins} survived / ${w.losses} terminated`
      : `${w.wins} wins / ${w.ties} ties / ${w.losses} losses · score ${w.score}`;
    row.textContent = `${w.name} · ${outcome}`;
    return row;
  }));
}
function wrap(n) { const size = engine?.config.coreSize || 8000; return ((n % size) + size) % size; }
function lineCount() { return Math.max(1,Math.min(100,Number($('lines').value) || 10)); }
function inspect() {
  if (!engine) return;
  const follow = Number($('follow').value);
  if (follow >= 0 && latest?.warriors[follow]?.pc >= 0) $('address').value = wrap(latest.warriors[follow].pc - Math.floor(lineCount()/2));
  const start = wrap(Number($('address').value) || 0);
  $('instruction').replaceChildren(...Array.from({length:lineCount()},(_,i) => {
    const addr = wrap(start+i), line = document.createElement('span');
    const owners = latest.warriors.flatMap((w,j) => w.pc === addr ? [j] : []);
    line.className = 'listing-line';
    if (owners.length) line.style.color = warriorColor(owners[0]);
    line.textContent = `${addressText(addr)}  ${engine.inspect(addr)}${owners.length ? '  ← next: '+owners.map(j => latest.warriors[j].name).join(', ') : ''}\n`;
    return line;
  }));
}
function showAddress(n) { $('follow').value = '-1'; $('address').value = wrap(n); inspect(); }
function renderTrace() {
  const mode = $('traceMode').value;
  const host = $('execution');
  host.className = mode === 'columns' ? 'execution columns' : 'execution';
  if (mode === 'off') { host.textContent = 'Execution logging is off.'; return; }
  if (!latest) { host.textContent = 'Load a battle to watch executed instructions.'; return; }
  if (mode === 'combined') {
    const pre = document.createElement('pre');
    for (const entry of combined) {
      const span = document.createElement('span'); span.style.color = warriorColor(entry.warrior);
      span.textContent = `#${entry.number} ${latest.warriors[entry.warrior].name}  ${addressText(entry.address)}  ${entry.instruction}\n`;
      pre.append(span);
    }
    host.replaceChildren(pre); pre.scrollTop = pre.scrollHeight;
  } else {
    host.replaceChildren(...latest.warriors.map((w,i) => {
      const panel = document.createElement('section'), title = document.createElement('h3'), pre = document.createElement('pre');
      panel.style.color = warriorColor(i); title.textContent = w.name;
      pre.textContent = (history[i] || []).map(e => `#${e.number} ${addressText(e.address)}  ${e.instruction}`).join('\n');
      panel.append(title,pre); return panel;
    }));
    for (const pre of host.querySelectorAll('pre')) pre.scrollTop = pre.scrollHeight;
  }
}
function textViews() {
  if (latest) { scores(latest); inspect(); }
  renderTrace(); lastText = performance.now();
}
function present(update) {
  latest = update; display.apply(update.events,!fastMode);
  $('activeSettings').textContent = 'Loaded cycle limit: ' + engine.config.cycles.toLocaleString() +
    ' per warrior per round · ' + engine.config.warriors + ' warriors';
  let n = total;
  for (const entry of update.trace) {
    entry.number = ++n;
    if($('pauseViews').checked || pausedWarriors.has(entry.warrior))continue;
    (history[entry.warrior] ||= []).push(entry);
    if (history[entry.warrior].length > 100) history[entry.warrior].shift();
    combined.push(entry);
  }
  if (combined.length > 300) combined.splice(0,combined.length-300);
  total += update.executed;
  $('timing').dataset.instructions=String(total);

  if(!fastMode)sampleScores(update);
  $('timing').textContent = `Cycle ${update.cycle.toLocaleString()} / ${engine.config.cycles.toLocaleString()} · round ${update.round}`;
  if($('diagnostics').open && !fastMode)$('sliceTiming').textContent='Peak simulation slice: '+maxSlice.toFixed(1)+' ms';
  if(update.debugHit>=0){pause();$('follow').value=String(update.debugHit);inspect();status('Debug marker: '+update.warriors[update.debugHit].name+' at '+addressText(update.warriors[update.debugHit].pc)+'. Paused before execution.');}
  if (update.done) { setFast(false);sampleScores(update);state = 'done'; status('Battle complete. Inspect the core; Reset starts again.'); controls(); }
  if (!fastMode && (state !== 'running' || performance.now()-lastText >= 100)) {
    if(!$('pauseViews').checked && !$('pauseProcesses').checked){
      if(chartRound!==update.round){processChart.clear();chartRound=update.round;}
      processChart.add(update.cycle,update.warriors.map(w=>w.tasks));
    }
    textViews();
  }
}
async function load() {
  stop(); const token = generation;
  state = 'loading'; controls(); $('log').textContent = ''; consoleText='';$('consoleOutput').textContent='';
  status('Assembling warriors in a background worker…');
  const config = options(), banks = await work('compile',config);
  if (token !== generation) return false;
  const next = await Engine.create(config,{log});
  if (token !== generation) return false;
  next.import(banks);
  engine = next; total = 0; maxSlice = 0; credit = 0; history = []; combined = [];
  display.configure(config.coreSize);clearHover(); $('address').max = config.coreSize-1; $('address').value = 0;
  $('follow').replaceChildren(new Option('Fixed address','-1'), ...banks.map((b,i) => new Option(b.name,String(i))));
  traceControls(banks.map(b=>b.name));engine.setDebug($('debugEnabled').checked);
  const initial=engine.start();present(initial);legend();
  if(initial.done){state='done';status('Assembly complete. No battles run.');controls();return false;}
  state = 'paused'; controls();
  status('Paused before instruction 1. Step or Run battle.');
  return true;
}
function pause() {
  if(state==='series'){state='series-pausing';worker?.postMessage({type:'pause'});status('Pausing series…');controls();return;}
  if (state !== 'running') return;
  cancelAnimationFrame(animation);setFast(false); state = 'paused'; status('Paused. Step or Resume battle.'); controls(); textViews();
}
function frame(now) {
  if (state !== 'running') return;
  if (document.hidden) { previous = now; animation = requestAnimationFrame(frame); return; }
  const rate = Math.round(10 ** Number($('speed').value));
  credit = Math.min(credit + Math.min(now-previous,50)*rate/1000,rate/20+1); previous = now;
  if (fastMode || credit >= 1) {
    const before = performance.now();
    const update = engine.advance(fastMode?100000:Math.min(100000,Math.floor(credit)),4);
    maxSlice = Math.max(maxSlice,performance.now()-before);
    if(!fastMode)credit -= update.executed; present(update);
  }
  if (state === 'running') animation = requestAnimationFrame(frame);
}
function resume() {
  if (!engine || state === 'done') return;
  stepEpoch++; stepping = false;
  state = 'running'; previous = performance.now(); controls();
  status('Battle running. Click the core to pause and list instructions.');
  animation = requestAnimationFrame(frame);
}
function safe(action) {
  return async () => {
    try { await action(); }
    catch (error) {
      if (error.name === 'AbortError') return;
      stop(); state = 'error'; controls(); log(error.message); showConsole(); status(error.message);
    }
  };
}
async function step(n = 1) {
  if (stepping || state === 'loading' || seriesActive()) return;
  pause();
  if (!engine && !(await load())) return;
  if (state === 'done') return;
  const token = generation, ticket = ++stepEpoch;
  stepping = true;engine.setDebug(false);controls();
  try {
    while (n > 0 && state === 'paused' && token === generation && ticket === stepEpoch) {
      const update = engine.advance(Math.min(n,100000),4);
      n -= update.executed; present(update);
      if (n > 0) await new Promise(resolve => setTimeout(resolve,0));
    }
    if (state === 'paused' && token === generation && ticket === stepEpoch)
      status('Paused after stepping. Step or Resume battle.');
  } finally {
    if (ticket === stepEpoch) {engine?.setDebug($('debugEnabled').checked);stepping = false; controls(); }
  }
}
async function run() {
  if(state==='running' || state==='series'){pause();return;}
  if(state==='series-paused'){state='series';worker?.postMessage({type:'resume'});status('Resuming series…');controls();return;}
  if (engine) {
    if (state === 'paused') {
      // Before instruction one, Run applies edits made since Reset/loading.
      // After execution begins, resuming preserves that match's settings.
      if (total === 0 && dirty && !(await load())) return;
      resume();
    }
    return;
  }
  if (await load()) { if (!$('debugStart').checked) resume(); }
}
async function command(text) {
  if (state === 'loading' || seriesActive()) return log('Stop the current operation before entering debugger commands.');
  const reply = message => { log(message); return message; };
  const parts = text.trim().toLowerCase().replace(/^(l|s)(?=[0-9.-])/,'$1 ').split(/\s+/), verb = parts.shift(), rest = parts.join(' ');
  if (['m','macro'].includes(verb)) return command(rest);
  if (['s','step','f5','f7','f8','alt-s'].includes(verb)) {
    const count = rest ? Number(rest) : 1;
    if (!Number.isInteger(count) || count < 1 || count > 100000) throw new Error('Step count must be 1–100000.');
    await step(count);
    if (verb.startsWith('f')) { $('follow').value = '0'; $('lines').value = 13; inspect(); }
  } else if (['g','go','continue','alt-g','f9'].includes(verb)) {
    if (!engine && !(await load())) return; resume();
  } else if (['l','list'].includes(verb)) {
    pause();
    const [a,b] = rest.split(',').map(v => v?.trim());
    const pc = latest?.warriors[Math.max(0,Number($('follow').value))]?.pc ?? 0;
    const parse = v => v === 'pc' ? pc : v === '.' || !v ? Number($('address').value) : Number(v);
    if (!Number.isInteger(parse(a)) || (b !== undefined && !Number.isInteger(parse(b)))) throw new Error('Use list address or list start,end (also pc and .).');
    if (b !== undefined) $('lines').value = Math.min(100,wrap(parse(b)-parse(a))+1);
    showAddress(parse(a));
  } else if (['up','ctrl-u'].includes(verb)) showAddress(Number($('address').value)-1);
  else if (['down','ctrl-d'].includes(verb)) showAddress(Number($('address').value)+1);
  else if (['pgup','ctrl-k'].includes(verb)) showAddress(Number($('address').value)-lineCount());
  else if (['pgdn','ctrl-l'].includes(verb)) showAddress(Number($('address').value)+lineCount());
  else if (['mouse','mousel','mousem','mouser'].includes(verb)) { pause(); inspect(); }
  else if (['progress','p','alive','tproc','registers','reg','key-p'].includes(verb)) {
    if (!latest) return reply('Load a battle first.');
    const output = [`Round ${latest.round}; cycle ${latest.cycle}; ${latest.warriors.filter(w=>w.tasks>0).length} alive; ${latest.warriors.reduce((n,w)=>n+w.tasks,0)} processes.`];
    if (['registers','reg','key-p'].includes(verb)) latest.warriors.forEach((w,i)=>output.push(`${i+1} ${w.name}: next PC ${w.pc < 0 ? '—' : addressText(w.pc)}, ${w.tasks} processes`));
    return reply(output.join('\n'));
  } else if (verb === 'pause') pause();
  else if (verb === 'reset') await load();
  else if (['help','f1','?'].includes(verb)) $('debugHelp').open = true;
  else return reply('Unsupported command. Open Browser debugger commands for the supported subset.');
}
function setFast(enabled){
 const wasFast=fastMode;fastMode=enabled;$('fast').setAttribute('aria-pressed',String(enabled));
 $('speed').disabled=enabled;syncTrace();
 if(!enabled){display.redraw();if(latest){if(wasFast)sampleScores(latest);textViews();}}
}
$('fast').onclick=safe(async()=>{
 const enable=!fastMode;
 if((!engine || (total===0 && dirty)) && !(await load()))return;
 setFast(enable);
 if(enable && state==='paused')resume();
});
$('debugRun').onclick=safe(async()=>{
 $('debugEnabled').checked=true;
 pause();
 if((!engine || (total===0 && dirty)) && !(await load()))return;
 engine.setDebug(true);resume();
});
$('debugEnabled').onchange=()=>engine?.setDebug($('debugEnabled').checked);
$('diagnostics').ontoggle=()=>{if($('diagnostics').open)$('sliceTiming').textContent='Peak simulation slice: '+maxSlice.toFixed(1)+' ms';};
$('run').onclick = safe(run);
$('step').onclick = safe(() => step());
$('reset').onclick = safe(load);
$('speed').oninput = () => { $('speedValue').textContent = Math.round(10 ** Number($('speed').value)).toLocaleString(); };
$('address').oninput = () => { $('follow').value = '-1'; inspect(); };
$('lines').oninput = inspect; $('follow').onchange = inspect;
$('prevPage').onclick = () => showAddress(Number($('address').value)-lineCount());
$('nextPage').onclick = () => showAddress(Number($('address').value)+lineCount());
$('traceMode').onchange = () => { syncTrace(); renderTrace(); };
$('arenaLayout').onchange=()=>{
 const layout=$('arenaLayout').value,viewport=document.querySelector('.arena-viewport');
 viewport.dataset.layout=layout;
 viewport.scrollLeft=0;viewport.scrollTop=0;
 viewport.setAttribute('aria-label',{'vertical':'Core arena scrolling vertically','horizontal':'Core arena scrolling horizontally','fill':'Core arena filling vertically','fill-horizontal':'Core arena filling horizontally'}[layout]);
 clearHover();display.redraw();
};
function clearHover(){ $('hoverAddress').textContent='Cell: —'; }
$('cellSize').onchange = () => {clearHover();display.setCellSize(Number($('cellSize').value));};
$('core').onpointermove=event=>{
 const address=display.addressAt(event),text=address===null?'Cell: —':'Cell: '+String(address).padStart(String(display.size-1).length,'0');
 if($('hoverAddress').textContent!==text)$('hoverAddress').textContent=text;
};
$('core').onpointerleave=clearHover;
document.querySelector('.arena-viewport').addEventListener('scroll',clearHover);
$('core').onclick = event => { const address=display.addressAt(event);if(address===null)return;pause();showAddress(address); };
$('core').oncontextmenu = event => { event.preventDefault();const address=display.addressAt(event);if(address===null)return;pause();showAddress(address-lineCount()+1); };
$('commandForm').onsubmit = event => {
  event.preventDefault(); const text = $('command').value; $('command').value = '';
  // Invalid debugger commands must not destroy an active battle.
  $('commandOutput').textContent='> '+text+'\n';
  command(text).then(result=>{$('commandOutput').textContent += result || 'Done. '+$('status').textContent;}).catch(error=>{$('commandOutput').textContent += error.message;log(error.message);});
};

document.addEventListener('keydown',event => {
  if (event.target.closest('textarea,input,select,button') || event.ctrlKey || event.altKey || event.metaKey) return;
  const key = {F1:'help',F5:'f5',F7:'f7',F8:'f8',F9:'go',ArrowUp:'up',ArrowDown:'down',PageUp:'pgup',PageDown:'pgdn',Escape:'pause'}[event.key];
  if (key) { event.preventDefault(); command(key).catch(error=>log(error.message)); }
});
document.addEventListener('visibilitychange',() => { previous = performance.now(); credit = 0; });

function traceControls(names) {
 pausedWarriors.clear();
 $('tracePauses').replaceChildren(...names.map((name,i)=>{
  const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';
  check.onchange=()=>{check.checked?pausedWarriors.add(i):pausedWarriors.delete(i);syncTrace();};
  label.style.color=warriorColor(i);label.append(check,' Pause '+name);return label;
 }));
 syncTrace();
}
function syncTrace(){
 engine?.setTrace(!fastMode && !$('pauseViews').checked && $('traceMode').value!=='off' &&
   pausedWarriors.size < (engine?.config.warriors || sources.length));
}
function battleCount(update){
 sessionBattles += Math.max(0,update.completed-countedCompleted);countedCompleted=update.completed;
 $('battleTotals').textContent='Warriors · '+update.completed.toLocaleString()+' battles this run';
 $('diagnosticsTitle').textContent='Show diagnostics · '+sessionBattles.toLocaleString()+' battles this session';
}
function sampleScores(update){
 battleCount(update);
 if(!$('pauseViews').checked && !$('pauseScores').checked && update.completed!==lastScoreSample){
  scoreChart.add(update.completed,update.warriors.map(w=>w.score));lastScoreSample=update.completed;
 }
}
function saveWarrior(i){
 const a=document.createElement('a'),url=URL.createObjectURL(new Blob([sources[i]],{type:'text/plain;charset=utf-8'}));
 a.href=url;a.download=(draftName(sources[i],i).replace(/[^a-z0-9_.-]+/gi,'_')||'warrior')+'.red';
 document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function importFiles(files){
 const list=Array.from(files);
 if(!list.length)return;
 if(sources.length+list.length>36)throw new Error('At most 36 warriors can be loaded. Remove some before importing.');
 if(list.some(f=>f.size>65536))throw new Error('Warrior files must be at most 64 KiB each.');
 const texts=await Promise.all(list.map(f=>f.text()));
 if(sources.length+texts.length>36)throw new Error('Too many warriors after concurrent imports.');
 sources.push(...texts);markDirty();editors();
 status('Imported '+list.length+' warrior files. Edit them below or Reset to load them.');
}
$('newWarrior').onclick=()=>{
 if(sources.length>=36)return;
 collapsedEditors[sources.length]=false;
 sources.push(';redcode-94\n;name Warrior '+(sources.length+1)+'\n;assert 1\nmov.i 0, 1\nend\n');
 markDirty();editors();
};
$('dropZone').onclick=()=>$('warriorFiles').click();
$('dropZone').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('warriorFiles').click();}};
$('warriorFiles').onchange=()=>{importFiles($('warriorFiles').files).catch(e=>status(e.message));$('warriorFiles').value='';};
for(const id of ['dropZone']){
 const zone=$(id);
 zone.ondragover=e=>{e.preventDefault();zone.classList.add('dragging');};
 zone.ondragleave=()=>zone.classList.remove('dragging');
 zone.ondrop=e=>{e.preventDefault();zone.classList.remove('dragging');importFiles(e.dataTransfer.files).catch(err=>status(err.message));};
}
$('theme').onchange=()=>{
 setTheme($('theme').value);
 for(const selector of ['#tracePauses label','#editors .warrior']) document.querySelectorAll(selector).forEach((label,i)=>{label.style.color=warriorColor(i);});
 display.redraw();legend();textViews();processChart.draw();scoreChart.draw();
};
$('pauseProcesses').onchange=()=>{if(latest)processIndicators(latest);};
$('pauseViews').onchange=()=>{syncTrace();if(latest)processIndicators(latest);};
$('clearConsole').onclick=event=>{event.preventDefault();event.stopPropagation();consoleText='';$('consoleOutput').textContent='';};
$('consoleWindow').ontoggle=()=>{if($('consoleWindow').open)$('consoleOutput').textContent=consoleText;};
setupSettings(markDirty);
processChart.clear();scoreChart.clear();

editors(); controls();scheduleValidation();
