// SPDX-License-Identifier: GPL-2.0-or-later
import createModule from './dist/pmars.mjs';

export const defaults = Object.freeze({coreSize: 8000, rounds: 1, cycles: 80000, tasks: 8000, warriors: 2});
export function settings(input = {}) {
  const result = {...defaults, ...input};
  for (const [key, min, max] of [
    ['coreSize', 800, 65536], ['rounds', 1, 1000],
    ['cycles', 1, 10000000], ['tasks', 1, 65536], ['warriors', 1, 36]
  ]) {
    if (!Number.isInteger(result[key]) || result[key] < min || result[key] > max)
      throw new Error(`${key} must be an integer from ${min} to ${max}.`);
  }
  if (result.coreSize < result.warriors * 100) throw new Error('Core must have at least 100 cells per warrior.');
  return result;
}
function check(code) {
  if (code) throw new Error(`pMARS returned error ${code}; see assembly diagnostics.`);
}

// A fresh instance per match isolates pMARS's legacy global state.
// User source compilation belongs in worker.mjs; the main thread imports banks.
export class Engine {
  static async create(options, {visual = true, log = () => {}} = {}) {
    const config = settings(options);
    const module = await createModule({noInitialRun: true, print: log, printErr: log});
    check(module._web_configure(config.coreSize, config.rounds, config.cycles, config.tasks, +visual, config.warriors));
    return new Engine(module, config);
  }
  constructor(module, config) { this.module = module; this.config = config; this.started = false; }
  compile(sources) {
    if (!Array.isArray(sources) || sources.length !== this.config.warriors) throw new Error('Source count must match settings.warriors.');
    const m = this.module;
    sources.forEach((source, i) => {
      if (typeof source !== 'string' || new TextEncoder().encode(source).length > 65536)
        throw new Error('Each warrior source must be at most 64 KiB.');
      m.FS.writeFile('/warrior-' + i + '.red', source);
      check(m._web_compile(i));
    });
    return sources.map((_, i) => {
      const field = n => m._web_field(i, n);
      const ptr = field(0);
      return {
        code: m.HEAPU8.slice(ptr, ptr + field(1) * field(5)),
        length: field(1), offset: field(2), pinState: field(3), pin: field(4),
        name: m.ccall('web_name', 'string', ['number', 'number'], [i, 0]),
        author: m.ccall('web_name', 'string', ['number', 'number'], [i, 1])
      };
    });
  }
  import(banks) {
    if (!Array.isArray(banks) || banks.length !== this.config.warriors) throw new Error('Compiled bank count must match settings.warriors.');
    const m = this.module;
    banks.forEach((bank, i) => {
      if (!(bank.code instanceof Uint8Array) || !Number.isInteger(bank.length) ||
          bank.length < 1 || bank.length > 100 ||
          bank.code.length !== bank.length * m._web_field(i, 5))
        throw new Error('Invalid compiled bank. Use banks from this exact build.');
      const ptr = m._malloc(bank.code.length);
      if (!ptr) throw new Error('Cannot allocate warrior bank.');
      m.HEAPU8.set(bank.code, ptr);
      check(m.ccall('web_import', 'number',
        ['number','number','number','number','number','number','string','string'],
        [i, ptr, bank.length, bank.offset, bank.pinState, bank.pin, bank.name, bank.author]));
    });
  }
  start() {
    check(this.module._web_start());
    this.started = true;
    return this.update(false);
  }
  advance(instructions = 1, milliseconds = 4) {
    const done = this.module._web_advance(instructions, milliseconds);
    if (done < 0) throw new Error('advance requires 1..100000 instructions and a time budget in (0,8] ms.');
    return this.update(!!done);
  }
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
      trace, completed: m._web_completed(),
      // A copy remains valid across calls and Wasm memory growth.
      events: m.HEAPU32.slice(ptr, ptr + m._web_event_count() * 4),
      executed: m._web_steps(), round: m._web_round(), done,
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
