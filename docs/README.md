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
The included `docs/CNAME` names `corewar.dev`. Publishing setup is still required:
1. Push `browser-integration` (or merge and push your default branch).
2. In repository Settings → Pages, choose Deploy from a branch, that branch,
   and `/docs`, then Save.
3. Set Custom domain to `corewar.dev` in Pages settings before changing DNS.
4. At your DNS provider, point the apex domain at GitHub Pages using ALIAS/ANAME
   to `bjoern.github.io`, or the A records in GitHub's current instructions.
   Optional `www` uses a CNAME to `bjoern.github.io`, without a repository path.
5. Once GitHub finishes the DNS check and issues the certificate, enable
   Enforce HTTPS. The public entry point is `https://corewar.dev/`, not `/docs/`.

See [GitHub's custom-domain instructions](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site).
These files prepare the site; they do not change GitHub settings or DNS.
The old `/web/` preview URL redirects to `/docs/`.

## Match settings

The visible summary describes the editable next match. **Edit settings** opens
the full form. Rounds, Run/Pause, Step, Reset, Debug, Fast, cycle count, and speed share the arena toolbar. Layout, cell size, and theme sit above the arena.
The form supports the native options `-r -s -b -c -V -p -k -l -8 -d -f -F -o -S -P -A -=`.
Native parsing, assembly, positioning, scoring, and output are shared with pMARS.
Filesystem options are deliberately unavailable. Fixed-series placement
(`-f`) defaults off, including in all presets. Enable it explicitly for
repeatable placement. Entering `-F` also disables it.
Permutation requires two warriors. Zero rounds and assemble-only both assemble
without running a battle.

Preset choices fill the editable form: standard pMARS, KotH '94 no-P-space,
KotH '88, SAL nano, tiny, tiny limited-process, and KotH '94 experimental.
These are historical rule references, with source links in the UI, not claims
about currently operating servers. The no-P-space preset rejects PIN, LDP,
and STP after assembly.

The native console sits below the battle controls and is collapsed by default.
Click its heading to show/hide it; per-warrior Validate and compilation failures
open it automatically. Clear output beside the console heading clears the console without toggling it; starting a new battle
or series also clears it. Validation is optional: Run assembles automatically. Validate checks just that warrior with the current match
settings (including warrior count), always prints its listing, and preserves
the active battle. Buttons show success/failure and reset when inputs change.
All warriors are validated on page load and one second after the latest source
or settings edit, one worker at a time. Editing cancels stale checks. Automatic
validation updates labels without opening the console; the ↻ Validate/Valid button revalidates
immediately and opens the output. Run battle also reports the failing warrior. The console includes assembly listings,
diagnostics, and final native results. Brief, verbose, KotH output, sorting,
and score formula settings affect this output. Its retained text is bounded
to 256 KiB; diagnostics retain 64 KiB.

## Controls

- Add/remove warriors: supports 1–36, including solo debugging. Use New warrior below the editors to create an
  editable warrior, upload one or multiple files, or drop files on the upload
  area below the editors. Each editor has a Download button. Existing and imported editors start collapsed; New warrior opens its editor.
  The arrow before its name hides or opens
  its source textarea. One Collapse all / Expand all toggle controls every editor without changing
  sources or validation status. Editor headings
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
- Cell size defaults to 8 CSS pixels. Classic uses a 2×2 mark with 2 pixels
  of inter-cell spacing (4-pixel pitch), matching native SDL modes 0/1.
  Compact uses a 4×4 mark with 2-pixel spacing (6-pixel pitch, native mode 3).
  These are CSS pixels, scaled by the browser/device pixel ratio. Choose 12, 16, or 24 pixels for larger
  markers, or Auto for an overview using even whole-pixel cell sizes. Layout offers:
  Scroll vertically (fit columns to width, scroll inside a bounded-height panel),
  Scroll horizontally (fit rows to a bounded height, scroll sideways inside the
  panel), Fill vertically (fit columns to width and grow down the page), and
  Fill horizontally (fit rows to height and extend across the page).
  Layout is a page control above the emulator: CSS sets the container constraints,
  and the display reads its actual inner width/height to choose rows and columns.
  Horizontal layouts use at least the available width, even when the core fits.
  Cell-size and container-size changes recompute the grid without changing memory.
  Automatic sizing redraws using even whole CSS pixels rather than stretching.
  Very large arenas retain their full scroll extent but paint a movable canvas
  window to avoid oversized bitmap allocations; no horizontal fallback is used.
  Changing size preserves memory marks and battle state.
- Hover over the arena to see the address under the pointer beside the size
  selector. Leaving or scrolling clears the indicator.
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
  between rounds within the series. Pause suspends the worker at a bounded
  execution boundary; Resume series continues the same match, preserving
  scores and P-space. Rounds sit beside the series button, with no demo cap
  beyond native pMARS’s 2,147,483,647-round integer limit.

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
macro loops, interactive breakpoint editing, operand-pointer expressions, shell/file operations,
and arbitrary .mac loading are not implemented. On-page command help
lists the supported behavior.

The display uses native pMARS quadrant markers in warrior colors: read marks
the top-left quarter, write marks the top-right and bottom-left quarters,
decrement marks the top half, increment marks the left half, and execution
marks the whole cell. Unaffected quarters retain their previous owner.
Full-cell marks are solid. A border separates neighboring cells, but there
are no internal gaps between a cell’s four quadrants. Every address has
a faint background: dark cells still contain memory (initially DAT 0, 0);
activity markers do not indicate whether memory is empty. Padding after the
last address is not selectable. The legend illustrates these shapes. A white outline marks each warrior's
last execution address. Modern, pMARS classic, and accessible palettes are
selectable. It redraws only
dirty cells except when initializing a round or resizing. All activity events
are consumed in order; multiple operations at the same cell within one browser
frame end with that frame's final visual state. Slow down or step to examine
individual instructions. This prototype does not animate the separate operand
operations within one instruction across multiple frames.

Process history and cumulative series-score charts retain at most 300 samples.
Per-warrior process counts sit below the process chart and share its pause
control, including the global pause. Pausing skips process-count DOM updates;
score rows also avoid rebuilding when their values are unchanged.
The process chart uses the current round’s cycle number, resets each round,
and samples at most ten times a second. Each chart and each
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
node docs/test-feedback.mjs
node docs/test-layout.mjs
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

The main readout shows the current cycle: zero before execution, one while
each living warrior takes its first turn, and so on. Cycle counting follows
the scheduler and resets each round, including after warrior elimination.
Step and execution-log sequence numbers still count individual instructions.
The speed control also retains its explicit instructions/second unit.

### Compact battle controls

Run and Fast both use the configured number of rounds. Fast suppresses canvas,
charts, and instruction tracing, removes the speed throttle, and still yields
between short simulation slices. Run changes to Pause; pausing Fast restores
visual updates. Reset reloads edited sources/settings and pauses at instruction
zero. A hidden tab suspends this execution; the former separate worker-series
buttons are no longer exposed. The worker API remains available for integrations.

Debug enables stopping at native `;break` / `;trace` markers (enabled with
`;debug`) before execution. Step executes the held instruction. Diagnostics,
including peak simulation slice time, are collapsed by default.
