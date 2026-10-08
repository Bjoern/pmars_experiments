// SPDX-License-Identifier: GPL-2.0-or-later
import createModule from './dist/pmars.mjs';

import {settings, argumentsFor} from './settings.mjs';
export {settings, defaults} from './settings.mjs';
function check(code) {
  if (code) throw new Error(`pMARS returned error ${code}; see assembly diagnostics.`);
}

// A fresh instance per match isolates pMARS's legacy global state.
// User source compilation belongs in worker.mjs; the main thread imports banks.
export class Engine {
  static async create(options, {visual = true, log = () => {}} = {}) {
    const config = settings(options);
    const module = await createModule({noInitialRun: true, print: line => log(line,'stdout'), printErr: line => log(line,'stderr')});
    check(module.ccall('web_configure','number',['string','number','number'],[argumentsFor(config).join('\n'),+visual,config.warriors]));
    config.rounds = module._web_round_limit();
    return new Engine(module, config);
  }
  constructor(module, config) { this.module = module; this.config = config; this.started = false; }
  compile(sources, onCompiled = () => {}, only = null) {
    if (!Array.isArray(sources) || sources.length !== this.config.warriors) throw new Error('Source count must match settings.warriors.');
    if (only !== null && (!Number.isInteger(only) || only < 0 || only >= sources.length)) throw new Error('Invalid warrior index.');
    const m = this.module;
    const indices = sources.map((_,i)=>i).filter(i=>only===null || i===only);
    const banks = [];
    for (const i of indices) {
      const source = sources[i];
      try {
        if (typeof source !== 'string' || new TextEncoder().encode(source).length > 65536)
          throw new Error('Each warrior source must be at most 64 KiB.');
        m.FS.writeFile('/warrior-' + i + '.red', source);
        check(m._web_compile(i));

        const field = n => m._web_field(i, n);
        const ptr = field(0);
        const bank = {
          code: m.HEAPU8.slice(ptr, ptr + field(1) * field(5)),
          copyDebugInfo:m._web_debug_copy(), length: field(1), offset: field(2), pinState: field(3), pin: field(4),
          name: m.ccall('web_name', 'string', ['number', 'number'], [i, 0]),
          author: m.ccall('web_name', 'string', ['number', 'number'], [i, 1])
        };
        if (!bank.length) throw new Error("Warrior has no instructions.");
        if (this.config.noPspace) {
          if (bank.pinState === -2) throw new Error('This hill preset forbids PIN and P-space instructions.');
          const stride = m._web_field(0,5);
          for (let offset=8; offset<bank.code.length; offset+=stride)
            if ((bank.code[offset] >>> 3) >= 17) throw new Error('This hill preset forbids LDP/STP instructions.');
        }
        banks.push(bank); onCompiled(i);
      } catch(error) { error.warriorIndex=i; throw error; }
    }
    return banks;
  }
  import(banks) {
    if (!Array.isArray(banks) || banks.length !== this.config.warriors) throw new Error('Compiled bank count must match settings.warriors.');
    const m = this.module;
    banks.forEach((bank, i) => {
      if (!(bank.code instanceof Uint8Array) || !Number.isInteger(bank.length) ||
          bank.length < 1 || bank.length > this.config.maxLength ||
          bank.code.length !== bank.length * m._web_field(i, 5))
        throw new Error('Invalid compiled bank. Use banks from this exact build.');
      const ptr = m._malloc(bank.code.length);
      if (!ptr) throw new Error('Cannot allocate warrior bank.');
      m.HEAPU8.set(bank.code, ptr);
      check(m.ccall('web_import', 'number',
        ['number','number','number','number','number','number','string','string'],
        [i, ptr, bank.length, bank.offset, bank.pinState, bank.pin, bank.name, bank.author]));
    });
    m._web_set_debug_copy(banks.at(-1).copyDebugInfo ?? 1);
  }
  start() {
    if (this.config.assembleOnly || this.config.rounds===0) return this.update(true);
    check(this.module._web_start());
    this.started = true;
    return this.update(false);
  }
  advance(instructions = 1, milliseconds = 4) {
    const done = this.module._web_advance(instructions, milliseconds);
    if (done < 0) throw new Error('advance requires 1..100000 instructions and a time budget in (0,8] ms.');
    if (done && !this.printedResults) { this.module._web_print_results(); this.printedResults = true; }
    return this.update(!!done);
  }
  setDebug(enabled) { this.module._web_set_debug(+enabled); }
  setTrace(enabled) { this.module._web_set_trace(+enabled); }
  update(done) {
    const m = this.module;
    const ptr = m._web_event_ptr() >>> 2;
    const trace = [];
    const decoder = new TextDecoder();
    const stride = m._web_trace_stride(), base = m._web_trace_ptr();
    for (let i = 0; i < m._web_trace_count(); ++i) {
      const p = base + i * stride, text = m.HEAPU8.subarray(p + 8, p + stride);
      trace.push({warrior: m.HEAPU32[p >>> 2], address: m.HEAPU32[(p >>> 2) + 1],
        instruction: decoder.decode(text.subarray(0, text.indexOf(0)))});
    }
    return {
      trace, debugHit: m._web_debug_hit()-1, completed: m._web_completed(),
      // A copy remains valid across calls and Wasm memory growth.
      events: m.HEAPU32.slice(ptr, ptr + m._web_event_count() * 4),
      executed: m._web_steps(), cycle: m._web_cycle(), round: m._web_round(), done,
      warriors: Array.from({length: this.config.warriors}, (_, i) => ({
        name: m.ccall('web_name', 'string', ['number','number'], [i, 0]),
        tasks: m._web_field(i, 6), wins: m._web_field(i, 7),
        ties: m._web_field(i, 8), losses: m._web_field(i, 9),
        pc: m._web_field(i, 10), score: m._web_field(i, 11),
        outcomes: Array.from({length: this.config.warriors}, (_, n) => m._web_outcome(i, n))
      }))
    };
  }
  inspect(address) {
    return this.module.ccall('web_inspect', 'string', ['number'], [address]);
  }
}
