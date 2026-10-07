// SPDX-License-Identifier: GPL-2.0-or-later
import {Engine} from './engine.mjs';
let busy = false;
self.onmessage = async ({data}) => {
  if (busy) return;
  busy = true;
  let logBytes = 0;
  const log = line => {
    if (logBytes >= 65536) return;
    const text = String(line).slice(0, 65536 - logBytes);
    logBytes += text.length + 1;
    self.postMessage({type: 'log', text});
  };
  try {
    const engine = await Engine.create(data.settings, {visual: false, log});
    const banks = engine.compile(data.sources);
    if (data.type === 'compile') {
      self.postMessage({type: 'compiled', banks}, banks.map(b => b.code.buffer));
    } else if (data.type === 'series') {
      let update = engine.start(), last = performance.now();
      while (!update.done) {
        update = engine.advance(100000, 8);
        if (performance.now() - last >= 100 || update.done) {
          self.postMessage({type: 'progress', update});
          last = performance.now();
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
      self.postMessage({type: 'done', update});
    } else throw new Error('Unknown worker command.');
  } catch (error) {
    self.postMessage({type: 'error', message: error.message || String(error)});
  } finally {
    self.close();
  }
};
