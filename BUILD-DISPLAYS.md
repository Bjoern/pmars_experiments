# Choosing the graphics display

The current 0.9.6-dev source tree supports both native Windows GDI and SDL3.
Choose a backend in `src/Makefile` by editing `GRAPHICS ?= gdi`, or override
it on the command line. Selection is at compile time; the executables have
separate names and can be kept side by side.

| Setting | Output under `src/` | Requirements | Reasons to choose it |
| --- | --- | --- | --- |
| `GRAPHICS=gdi` (default graphics choice) | `pmars-gdi.exe` | Windows, MinGW-w64 GCC, GNU make | Small binary, simple build, no SDL or CMake dependency |
| `GRAPHICS=sdl3` | `pmars-sdl3.exe` on Windows | 64-bit MinGW-w64 GCC/G++, CMake 3.21+, SDL3 source | SDL3 window/input support and a portable display backend; static Windows build is larger and takes longer |

Both Windows executables retain the command-line console and graphical
core/debugger panels. They link compiler runtimes statically and require
only Windows system DLLs. SDL3 is also linked statically in its Windows
build; no separate SDL DLL is needed. GDI is Windows-only. SDL3 on Unix/macOS
uses an installed SDL3 development package and `pkg-config`, with output
`src/pmars-sdl3`; that path has not been tested here.

## Build

From this directory, with tools on PATH:

```powershell
mingw32-make -C src graphics GRAPHICS=gdi
mingw32-make -C src graphics GRAPHICS=sdl3
```

Explicit shortcuts `gdi` and `sdl3` ignore the configured GRAPHICS choice.
The older `sdl` target is an alias for the SDL3 build. Running make with no
target prints help; `make default` still builds the console/debugger version.
The separate `Makefile.server` remains available for headless builds.

GDI needs only GCC and make. SDL3's CMake build finds the supplied
`dependencies/SDL3-3.4.16` source directory or `SDL3-3.4.16.zip`; it can
extract the archive automatically. Set `SDL_DIR` to use another SDL3 source
location. Tool paths can also be overridden, for example:

```powershell
mingw32-make -C src graphics GRAPHICS=sdl3 CMAKE=../dependencies/build-tools/cmake/data/bin/cmake.exe
```

Additional make settings: `CC`, `CXX`, `CMAKE`, `JOBS`, `SDL_BUILD_DIR`,
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

The current combined tree can be reconstructed using the new bundle in
`patches/dual-display`: apply its two-patch series or its single combined
patch to the preserved original 0.9.6-dev baseline. See that bundle's README
for exact steps. Older SDL-only ZIP files, patch series and manifests remain
historical snapshots; do not mix their alternative display patches with the
new series. Build the reconstructed sources using the commands above.

## Verified on Windows (2026-10-06)

Built both variants with 64-bit MinGW-w64. GDI is 259,502 bytes (about
253 KiB); statically linked SDL3 is 5,558,970 bytes (about 5.30 MiB) in this
build. Sizes depend on compiler and flags; these are the unstripped outputs.
Both passed security/compatibility and assembler regressions, debugger/mode
checks and deterministic battle comparisons against the server build.
GDI also passed its surface-operation tests. SDL3 passed dummy and native
Windows event/rendering tests, static-import checks and clean-directory
launch checks. Makefile selection, compatibility wrappers, invalid values
and non-Windows GDI rejection were checked. Unix/macOS builds are unverified.
