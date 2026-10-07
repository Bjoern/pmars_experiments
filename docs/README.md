# Browser integration

This branch adds a client-side pMARS WebAssembly engine, an incremental canvas
display, and a worker for assembly and headless match series. No server-side
simulation, framework, SDL, Asyncify, SharedArrayBuffer, or cross-origin
isolation headers are required.

## Build and preview

Activate an [Emscripten SDK](https://emscripten.org/docs/getting_started/downloads.html)
(tested with 4.0.15), then run from the repository root:

```sh
python docs/build.py
python -m http.server 8765 --bind 127.0.0.1
```

Open http://127.0.0.1:8765/docs/. Use HTTP, not file://. On Windows, set
`EMCC` to the absolute path to `emcc.bat` if the SDK is not on PATH.
Generated `docs/dist/pmars.mjs` and `pmars.wasm` are committed for static hosting.
The browser does not require Emscripten to be installed.

## GitHub Pages deployment

The self-contained `docs/` directory includes the Wasm runtime, license,
`.nojekyll`, and a corresponding-source download (`pmars-source.zip`).
The build script refreshes these artifacts; commit them whenever engine or
browser source changes. Serve over HTTP with JavaScript and WebAssembly MIME
types. No build tools or backend are needed on the host.

When ready to publish, push the branch you intend to deploy and select that
branch and **/docs** in the repository's GitHub Pages settings. Configure
`corewar.dev` as the custom domain and configure its DNS at that time.
This branch does not configure DNS, publish the site, or include a CNAME.
The old `/web/` preview URL redirects to `/docs/`.

## Match settings

The visible summary describes the editable next match. **Edit settings** opens
the full form; rounds and **Run series in background** remain outside it.
The form supports the native options `-r -s -b -c -V -p -k -l -8 -d -f -F -o -S -P -A -=`.
Native parsing, assembly, positioning, scoring, and output are shared with pMARS.
Filesystem options are deliberately unavailable. Fixed-series placement
(`-f`) defaults on for reproducibility; entering `-F` disables it.
Permutation requires two warriors. Zero rounds and assemble-only both assemble
without running a battle.

Preset choices fill the editable form: standard pMARS, KotH '94 no-P-space,
KotH '88, SAL nano, tiny, tiny limited-process, and KotH '94 experimental.
These are historical rule references, with source links in the UI, not claims
about currently operating servers. The no-P-space preset rejects PIN, LDP,
and STP after assembly.

The native console is collapsed by default and includes assembly listings,
diagnostics, and final native results. Brief, verbose, KotH output, sorting,
and score formula settings affect this output. Its retained text is bounded
to 256 KiB; diagnostics retain 64 KiB.

## Controls

- Add/remove warriors: supports 1–36, including solo debugging. Create a new
  editable warrior, upload one or multiple files, or drop files on the upload
  area or Add warrior dialog. Each editor has a Save download button. Editor headings
  update from the source's `;name` directive while typing. An active battle's
  legend and traces retain the loaded names until Reset.
  Changes to loaded sources/settings are marked as pending until Reset.
- Run battle: assemble in a worker and animate the configured number of rounds. With Start paused
  checked, loading stops before instruction one, like the native `-e` option.
  Before the first instruction (including after Reset), the button says Run
  battle and applies any edits made since loading. After execution begins it
  says Resume battle and preserves the loaded settings. The active cycle limit
  is displayed separately from the editable setting.
- Pause suspends scheduling. Step executes one warrior instruction, not a full
  cycle through all warriors. Step can also load a fresh match.
- Reset explicitly reloads current sources/settings and pauses at instruction zero.
- Stop cancels assembly/series work or releases the visual engine.
- Instructions / second: choose 1–100,000; this is a target, not a guarantee.
- Click the arena to pause and list from that address. Right-click lists up to
  the clicked address. Listings default to ten lines, with addresses, wraparound,
  paging, and next-PC markers. Follow selects a warrior's next instruction.
- Executed instructions: separate warrior-colored columns, one combined console,
  or Off. Entries contain the instruction before operand evaluation or writes.
  Histories retain 100 entries per warrior and 300 combined. Text refreshes
  at most 10 times per second while running; Pause/Step refresh immediately.
- Run series is available from idle, paused, running, or completed visual battles.
  It replaces the visual battle with a fresh series using current sources/settings,
  with progress and cumulative scores about every 100 ms. P-space persists
  between rounds within the series.

### Classic display macros

The browser adapts useful display actions from `config/pmars.mac` and
`config/mw.mac`. The original left-click macro is `cls~l ,+lines-4`: it
lists from the selected cell with a console-height-dependent line count.
The browser uses an explicit Lines control instead.

The command field supports `list/l address[,end]` (also `pc` and `.`),
`step/s [count]`, `go/g`, `pause`, `reset`, `progress`, `registers`,
`alive`, `tproc`, and `help`. Commands are interpreted directly, never
passed to JavaScript eval or to a system shell.

Adapted aliases: `macro/m f5`, `f7`, `f8` step once and show 13 lines
following warrior one; `f9` continues; `mouse/mousel/mousem/mouser`
refresh the listing; `up/down/pgup/pgdn` navigate. F5/F7/F8/F9, arrows,
Page Up/Down, and Escape work outside editable controls. The adaptations do
not duplicate native multi-panel switching semantics.

This is a documented browser subset, not the full cdb macro interpreter:
macro loops, breakpoints, operand-pointer expressions, shell/file operations,
and arbitrary .mac loading are not implemented. On-page command help
lists the supported behavior.

The display uses native pMARS quadrant markers in warrior colors: read marks
the top-left quarter, write marks the top-right and bottom-left quarters,
decrement marks the top half, increment marks the left half, and execution
marks the whole cell. Unaffected quarters retain their previous owner.
The legend illustrates these shapes. A white outline marks each warrior's
last execution address. Modern, pMARS classic, and accessible palettes are
selectable. It redraws only
dirty cells except when initializing a round or resizing. All activity events
are consumed in order; multiple operations at the same cell within one browser
frame end with that frame's final visual state. Slow down or step to examine
individual instructions. This prototype does not animate the separate operand
operations within one instruction across multiple frames.

Process history and cumulative series-score charts retain at most 300 samples.
The process chart samples at most ten times a second. Each chart and each
warrior execution log can be paused independently; **Pause live views** pauses
both charts and execution logging while simulation continues. Turning execution
logs off, or pausing all of them, disables native trace capture. Series runs
skip display events and instruction traces. Completed battle totals are shown
for the current run and the current page session.

## Responsiveness

The animation loop uses requestAnimationFrame. Each advance call stops at:

1. Its instruction budget.
2. Its soft wall-clock budget (4 ms in the demo, checked every 64 instructions).
3. The event buffer's safety margin, or the 512-entry execution trace limit.
4. A round boundary or match completion.

A whole instruction always finishes before yielding. The time bound is a soft
budget, not a real-time guarantee: OS scheduling, garbage collection, WebAssembly
initialization, drawing, and core initialization can add latency. The demo caps
catch-up work after slow frames and pauses visual scheduling in hidden tabs.
It does not accumulate an unbounded backlog.

User source assembly runs exclusively in the demo's worker, has a 64 KiB input
limit per warrior, and a 15-second timeout. Stop also cancels it. Only compiled
banks, at most 1000 instructions per warrior, cross to the main thread.
Headless series use the same stepping API without collecting display events.

## JavaScript API

`engine.mjs` wraps the exported C API. Each Engine owns one isolated Wasm
instance. Create a new Engine to reset or load another match; dropping references
allows the browser to collect it. Do not reuse an instance for a second match.

```js
import {Engine} from './engine.mjs';

// In an assembly worker:
const compiler = await Engine.create(options, {visual: false, log: console.log});
const banks = compiler.compile([firstSource, secondSource]);
// postMessage banks back to the page (worker.mjs is a complete example).

// On the page:
const engine = await Engine.create(options);
engine.import(banks);
engine.setTrace(true); // optional pre-execution snapshots
display.apply(engine.start().events);

// In requestAnimationFrame:
const update = engine.advance(100, 4);
display.apply(update.events);
console.log(update.executed, update.round, update.completed, update.done, update.warriors);
console.log(update.trace); // {warrior, address, instruction} in execution order
console.log(engine.inspect(123));
```

The banks are internal data produced by this exact build with these same match
settings. They are not a portable save format or an interface for untrusted
binary input. Core-size-dependent assembly assertions and instruction fields
are resolved by the compiler worker.

Settings and bounds:

| Setting | Default | Allowed |
|---|---:|---:|
| coreSize | 8000 | 80–65536 |
| rounds | 1 | 0–2147483647 |
| cycles | 80000 | 1–10000000 |
| tasks | 8000 | 1–65536 |
| warriors | 2 | 1–36 |

Additional settings are defined in `settings.mjs`: maxLength (1–1000,
default 100), distance (0–65536, zero selects native default), pspace
(0–coreSize, zero selects native default), and the flags/text options described
above. These are browser resource bounds, not unrestricted native limits.
Source/bank count must match settings.warriors. The core must fit at least
max(2, warrior count) times max(maxLength, distance). ICWS '94 extensions
and P-space are enabled unless the selected rules restrict them.

`start()` returns initial loaded cells. `advance(n, milliseconds)` accepts
1–100000 instructions and a time budget greater than zero and at most 8 ms.
It may execute fewer instructions; use `executed`, not the requested count.
A round initialization can return zero executed instructions with load events.
Final core memory remains inspectable after completion.

Each update contains a copied Uint32Array with four words per event:
`[kind, address, warriorIndex, value]`. Copies survive later calls and Wasm
memory growth. No JS callback or worker message is made for each memory access.

| Kind | Meaning | value |
|---:|---|---|
| 0 | Reset display for new round | Round number (1-based) |
| 1 | Initial warrior cell loaded | 0 |
| 2 | Instruction execution | 0 |
| 3 | Read activity | 0 |
| 4 | Write activity | 0 |
| 5 | Decrement activity | 0 |
| 6 | Increment activity | 0 |
| 7 | Process count changed | New process count |
| 8 | Warrior eliminated | 0 |
| 9 | Round completed | Round number (1-based) |

Addresses and warrior indices are zero-based. Addresses on reset, process
count, and round events need not indicate a memory change. Events follow the
existing simulator display hooks, including operand evaluation before the
execution hook; they are an activity stream, not snapshots of instruction data
or P-space writes. Use inspect() at a paused boundary for actual core contents.
Results expose each warrior's name, process count, next PC (-1 if dead), wins,
ties, losses, native score, and native survivor-count outcome bins. A multiwarrior
tie means surviving with at least one other warrior. Solo summaries distinguish
survived versus terminated rounds, since native solo score bins do not distinguish
those cases. `completed` explicitly counts completed rounds for progress reporting.

`setTrace(true)` enables pre-execution instruction text snapshots independently
of display events; the API defaults to tracing off. `trace` is bounded per advance
call and retains exact order across calls. The UI truncates old history as described
above. Turn tracing off for maximum simulation throughput.

## Tests

```sh
node docs/test-engine.mjs /path/to/native/pmars-server
node docs/test-options.mjs /path/to/native/pmars-server
python security/test_security.py /path/to/native/pmars-server
python security/test_096.py /path/to/native/pmars-server
# With the preview server running and Playwright installed:
node docs/test-browser.mjs
node docs/test-debugger.mjs
node docs/test-controls.mjs
node docs/test-features.mjs
```

The engine suite checks native deterministic score parity, exact ordered event
parity between one-instruction and large slices, full final-core parity, worker
bank import, shared P-space, core-size limits, solo and 3/4/36-warrior matches,
self-modification snapshots, and invalid inputs. Browser tests
exercise pause/resume, exact stepping, cancellation/restart, assembly errors,
a 1001-round worker series, uploads/drop/download, presets, native output,
chart/log pausing, themes, mobile layout, and a page heartbeat at maximum speed.
The options suite compares assembly and final output against native pMARS
across 12 configurations, including permutation, '88, fixed positions,
verbose output, assemble-only, and custom scoring.

Optional browser-test environment variables: `BROWSER_CHANNEL=msedge`,
`PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs`, and `PMARS_URL`.
Generated screenshots and test files go into ignored `docs/test-output/`.

Native displays remain selected by their existing build flags. The new
`BROWSER` build uses `SERVER` to prevent blocking stdin/debugger interaction.
Only the scheduling boundaries and selected persistent loop locals differ in
sim.c; the instruction execution switch remains shared.

Cycle limits use native pMARS semantics: a cycle gives each living warrior an
instruction. With two survivors, a limit of 10 ends after 20 total instructions.
Changing settings after execution begins requires Reset; changing them before
the first instruction is applied by Run.
