# Choosing the graphics display

The current 0.9.6-dev source tree supports both native Windows GDI and SDL3.
Choose a backend in `src/Makefile` by editing the platform-specific
`GRAPHICS` defaults, or override it on the command line. Selection is at compile time; the executables have
separate names and can be kept side by side.

| Setting | Output under `src/` | Requirements | Reasons to choose it |
| --- | --- | --- | --- |
| `GRAPHICS=gdi` (Windows default) | `pmars-gdi.exe` | Windows, MinGW-w64 GCC, GNU make | Small binary, simple build, no SDL or CMake dependency |
| `GRAPHICS=sdl3` (macOS/Linux default) | `pmars-sdl3` (`.exe` on Windows) | C/C++ compilers, GNU make, CMake 3.21+, included SDL3 source; MinGW-w64 on Windows | Portable display with embedded SDL3; larger binary and longer first build |

Both Windows executables retain the command-line console and graphical
core/debugger panels. They link compiler runtimes statically and require
only Windows system DLLs. SDL3 is also linked statically in its Windows
build; no separate SDL DLL is needed. GDI is Windows-only. SDL3 on Unix/macOS
also builds the included SDL3 source through CMake, with output
`src/pmars-sdl3`; the macOS build and dummy-driver tests were verified on
2026-10-06. Linux builds remain unverified.

## Build

From this directory, with tools on PATH, plain `make` builds SDL3 on
macOS/Linux, while `mingw32-make` builds GDI on Windows. `make -C src` also
works. CMake configuration runs automatically for SDL3. To choose explicitly:

```powershell
mingw32-make -C src graphics GRAPHICS=gdi
mingw32-make -C src graphics GRAPHICS=sdl3
```

Explicit shortcuts `gdi` and `sdl3` ignore the configured GRAPHICS choice.
The older `sdl` target is an alias for the SDL3 build. Running make with no
target builds `TARGET` (defaults to `graphics`). Use `make help` for help;
`make default` still builds the console/debugger version.
The separate `Makefile.server` remains available for headless builds.

GDI needs only GCC and make. SDL3's CMake build finds the supplied
`dependencies/SDL3-3.4.16` source directory or `SDL3-3.4.16.zip`; it can
extract the archive automatically. Set `SDL_DIR` to use another SDL3 source
location. Tool paths can also be overridden, for example:

```powershell
mingw32-make -C src graphics GRAPHICS=sdl3 CMAKE=../dependencies/build-tools/cmake/data/bin/cmake.exe
```

Additional make settings: `TARGET`, `CC`, `CXX`, `CMAKE`, `JOBS`,
`SDL_BUILD_TYPE` (Release by default), `CMAKE_ARGS`, `SDL_BUILD_DIR`,
`GDI_PROGRAM`, `SDL_PROGRAM`, `CPPFLAGS`, `CFLAGS` and `LDFLAGS`.
Backend-specific flags are described beside their definitions in the makefile.
Paths are relative to `src` after `-C src`. Keep different executable names
if you override them. GDI recompiles all sources on each request; SDL3 keeps
its own CMake build directory, so switching display does not reuse GDI objects.
To enable optional core features without replacing the default CFLAGS, use
`CPPFLAGS="-DRWLIMIT -DSAFECOLORS"`.

`Makefile.gdi` forwards to the main GDI targets. `Makefile.mingw` uses the
configured GRAPHICS and accepts an override, for example:
`mingw32-make -C src -f Makefile.mingw GRAPHICS=sdl3`.
Both wrappers accept `PROGRAM=...` for a custom executable name.

## Run and test

```powershell
.\src\pmars-gdi.exe -v 834 warriors\sunset.red warriors\excalibur.red
.\src\pmars-sdl3.exe -v 834 warriors\sunset.red warriors\excalibur.red
mingw32-make -C src check-graphics GRAPHICS=gdi
mingw32-make -C src check-graphics GRAPHICS=sdl3
```

Tests additionally require Python 3; SDL3 import checks use MinGW `objdump`.
GDI tests briefly open windows. SDL3 tests use its dummy video driver by
default; `check-sdl-native` additionally exercises native windows and input.
Add `-e` when running either executable to open the debugger.
See `BUILD-WINDOWS-GDI.md` for GDI controls.

## Source layout and older packages

`gdicore.c` preserves the existing GDI bitmap renderer through the local
`gdidisp.c`/`gdidisp.h` adapter. `sdldisp.c` contains the SDL3 renderer.
The simulator/debugger interface is shared; only the selected renderer is
compiled. Defining both GDIGRAPHX and SDLGRAPHX is rejected by config.h.

The initial combined tree can be reconstructed using the bundle in
`patches/dual-display`: apply its two-patch series or its single combined
patch to the preserved original 0.9.6-dev baseline. See that bundle's README
for exact steps. Older SDL-only ZIP files, patch series and manifests remain
historical snapshots; do not mix their alternative display patches with the
new series. That snapshot predates the plain-make convenience changes;
its source instructions describe its own commands.

## Verified on Windows (2026-10-06)

Built both variants with 64-bit MinGW-w64. GDI is 259,502 bytes (about
253 KiB); statically linked SDL3 is 5,558,970 bytes (about 5.30 MiB) in this
build. Sizes depend on compiler and flags; these are the unstripped outputs.
Both passed security/compatibility and assembler regressions, debugger/mode
checks and deterministic battle comparisons against the server build.
GDI also passed its surface-operation tests. SDL3 passed dummy and native
Windows event/rendering tests, static-import checks and clean-directory
launch checks. Makefile selection, compatibility wrappers, invalid values
and non-Windows GDI rejection were checked.

## Verified on macOS (2026-10-06)

Plain `make` built the bundled static SDL3 display after adding the missing
`<errno.h>` include used by its mode parser. `make check-sdl` passed security,
assembler, deterministic battle, debugger/mode and dummy-driver event tests.
All 13 make entry-point and platform-selection checks passed. Native macOS
window tests and Linux builds remain unverified; Windows was not retested.

Plain-make convenience support was added after the initial patch bundle.
The existing bundle remains a snapshot of the earlier GDI/SDL3 state.
