# pMARS 0.9.6-dev security and display port

Historical review of the SDL 1.2/GDI stage. For the current selectable
GDI/SDL3 build, source layout and validation, see BUILD-DISPLAYS.md.

Here, "candidate" always means the original 0.9.6-dev source.

Reviewed the supplied local candidate on 2026-10-02. Its ChangeLog calls it
the 2026-06-03 release candidate; `global.h` says version 96 and date
03/05/2026. These upstream identifiers are preserved. No remote release or
publisher signature was used to identify this local baseline.

## Security applicability

| 0.9.5 hardening area | Supplied 0.9.6-dev status | Port decision |
| --- | --- | --- |
| Byte-sized source/token offsets | The physical-line reader uses `int ri`, but token, whitespace, modifier and macro offsets remain byte-sized. The unpatched candidate still hangs on a 512-space instruction. | Retain upstream assembler fixes; widen all remaining offsets and bound source/continuation input. |
| Numeric parser overwrite | `getval` still uses `char buffer[BIGNUM]`, BIGNUM=20, then writes a terminator after 20 digits. | Use the checked evaluator. |
| Expression syntax and arithmetic | Upstream improves single/double-character operator parsing, but missing parentheses, unchecked signed overflow and LONG_MIN/-1 remain. | Checked parser already handles these operator fixes; verify assignments and comparisons against upstream. |
| Assembly work/stack exhaustion | No recursion/work/input budget; FOR still narrows counts to unsigned short. | Port budgets and nonwrapping iteration; reject positive counts above 65,535. Replace the candidate's workaround that silently skips positive multiples of 65,536. |
| Diagnostic buffers and allocation handling | Most formatting and ownership issues remain. | Port bounded formatting, allocation checks and cleanup, including the candidate's relocated assertion code. |
| Option files and configuration arithmetic | Unbounded token/copy paths, cyclic includes and overflow checks remain. | Port bounded parsing, include limits, checksums and allocation/counter validation. |
| SERVER/display conflict | GRAPHX still undefines SERVER. | Reject conflicts at compile time, including STDGRAPHX, SDL and GDI. |
| P-space isolation | Matching PIN checks still include a warrior that did not explicitly request sharing. | Require explicit matching PINs on both warriors. |
| SPEEDLEVELS visibility | Already fixed by the candidate. | Preserve the upstream placement; no new semantic change. |

Patch 1 contains the applicable core hardening and headless build/tests.
Patch 2 contains SDL improvements and Windows build support.
Patch 3 optionally adds GDI on top of the security and SDL patches. The original 0.9.5 patch
cannot be applied unchanged: the candidate moved assertion processing into
`lineswitch`, changed multiline EQU handling, and already added SDL/STDGRAPHX.
The port preserves those changes rather than replacing the candidate's core
with the older sources.

The new makefiles follow 0.9.6-dev and leave RWLIMIT disabled by default.
Enable it explicitly when needed. Read/write limits govern simulated core
access; they are independent of the host parser hardening.

## SDL comparison

Both versions use the SDL 1.2 API, the same bitmap font, layout/panel system,
sprites, event loop and debugger. The 0.9.6 renderer is an evolution of the
same pMARS-SDL renderer, not a rewrite in SDL2 or SDL3.

| Area | Earlier local 0.9.5 SDL port | Supplied 0.9.6-dev SDL | Merged result |
| --- | --- | --- | --- |
| Palette | Original palette | Optional Okabe-Ito `SAFECOLORS`; blue/orange warriors with lighter death colors | Preserve candidate palette for both SDL and GDI |
| Window icon | No SDL icon | Uses `pmarsicnsdl.h` through SDL palette/icon functions | Preserve for SDL; GDI keeps its native adapter's default window icon |
| Controls | Space/R clears; plain status labels | Adds C to clear and bracketed status hints | Preserve candidate controls for both displays |
| Multiwarrior colors | Sequence starts at palette index 9 | Sequence starts at palette index 1 | Preserve candidate sequence |
| Windows startup | CRT console main, returns SDL_main status | Legacy WinMain wrapper reparses arguments and calls exit(0) after SDL_main returns | Use console wrapper on Windows; generic Unix SDL target stays available |
| Redirected input | Detects Windows pipes/files; skips completion wait | Excludes WIN32 from detection and always requests final key wait | Port Windows detection and completion behavior |
| Display configuration | Command-line `-m` | Renderer supports mode strings but command parser exposes no `-m` | Add `-m` for SDL/GDI with bounded conversion from GDI port |
| Timing | Separate SDL refresh interval table | Reuses legacy display intervals | Port bitmap-renderer intervals; retain candidate intervals for other backends |
| No RWLIMIT | Initializes A predec/postinc mark address | Uses uninitialized `waddrA` for drawing in this default build | Initialize the address before either renderer uses it |

The GDI adapter uses the candidate's shared renderer through private SDL-style
surface/event names. It links only Windows system libraries and needs no SDL
runtime. The SDL build still needs SDL 1.2 or sdl12-compat runtime libraries.
`SAFECOLORS` is supported and tested with both drivers.

## Validation and boundaries

See `patches/VALIDATION.md` for actual build/test results and
`patches/README.md` for reproducible patch application. This is a targeted
hardening port, not a complete audit of the debugger or every legacy display.
Windows x64 is tested here; Linux sanitizers and interactive desktop behavior
of this 0.9.6 port remain unverified. The earlier GDI adapter's manual UI tests
do not substitute for testing this merge on the intended desktop.

## Unified SDL build entry point

`make -C src sdl` now selects SDL compilation and startup by compiler target.
Windows uses the console entry point and excludes SDLmain; Unix/macOS retain
sdl-config and their platform SDL startup libraries. The SDL target compiles
all sources together to avoid reusing another build variant's object files.
Makefile.mingw is a compatibility wrapper around this same target.
`make -C src check-sdl` runs the SDL and candidate assembler regressions.
Windows stdout behavior is tested; Unix/macOS are not tested here.
