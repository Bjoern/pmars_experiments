# pMARS 0.9.6-dev: core fixes and selectable GDI/SDL3

Prepared 2026-10-06. Two equivalent routes reconstruct the current source.
**Use the two-patch series for review/maintenance; use the combined patch
for convenient one-step application. Apply one route only.**

| File | Applies to | Result |
| --- | --- | --- |
| `0001-security-hardening.patch` | Preserved original 0.9.6-dev | Core security/bug fixes, server build and regression tests; unchanged from the previous series |
| `0002-gdi-sdl3-displays.patch` | Original plus patch 1 | Final selectable GDI/SDL3 displays, makefile configuration, dependencies/build setup, display tests and documentation |
| `pmars-0.9.6-dev-all.patch` | Preserved original 0.9.6-dev | Same final result as patches 1 and 2 together |

The display patch consolidates the earlier SDL improvements, GDI adapter,
SDL3 port and final selection changes. It includes display integration in
core/debugger files, not just new display source files. The single combined
patch is generated directly from the original baseline to the final tree;
it is not a concatenation of overlapping patch files.

## How this relates to the older patches

Previously, patch 1 was core hardening/bug fixes; patch 2 improved the SDL
1.2 display. Two **alternative** third patches then existed:
`0003-optional-win32-gdi.patch` added GDI to that SDL 1.2 tree, whereas
`0003-sdl3-static.patch` ported the SDL-only tree to SDL3. They were not a
sequence to apply together.

This new bundle retains patch 1 byte-for-byte and replaces all the display
steps with a new patch 2. All old published patch files remain unchanged.
Do not apply the new patch 2 over an old display patch or apply the combined
patch to an already-patched tree. Start fresh as below. If only the original
core patch has been applied, apply just this bundle's patch 2.

## Exact baseline

`upstream/pmars-0.9.6-dev-local-baseline.zip` is included. It is the preserved
local source originally supplied, not an authenticated publisher archive.
SHA-256:

```
d34926948c7dff71a27eb1ec9da00045e742dba68b265990f07276ac4f00247f
```

These patches target that 0.9.6-dev baseline, not 0.9.5 or 0.9.2-5.
No Git repository is needed, but the Git command must be installed.
Use a destination folder that does not already exist.

## Route A: recommended reviewable series

Open PowerShell in this `dual-display` bundle directory:

```powershell
Expand-Archive .\upstream\pmars-0.9.6-dev-local-baseline.zip .\applied-series
Push-Location .\applied-series
git apply --check --whitespace=nowarn ../0001-security-hardening.patch
git apply --whitespace=nowarn ../0001-security-hardening.patch
git apply --check --whitespace=nowarn ../0002-gdi-sdl3-displays.patch
git apply --whitespace=nowarn ../0002-gdi-sdl3-displays.patch
Pop-Location
python .\verify.py .\applied-series
```

The `series` file records this order. Check/apply each patch in sequence;
patch 2 requires the result of patch 1.

## Route B: one combined patch

From the same bundle directory, using a separate fresh destination:

```powershell
Expand-Archive .\upstream\pmars-0.9.6-dev-local-baseline.zip .\applied-combined
Push-Location .\applied-combined
git apply --check --whitespace=nowarn ../pmars-0.9.6-dev-all.patch
git apply --whitespace=nowarn ../pmars-0.9.6-dev-all.patch
Pop-Location
python .\verify.py .\applied-combined
```

Both routes produce the same 88 source/document/test files. `verify.py`
checks them against `manifest.json`, plus the baseline and patch hashes.
Source text is normalized to LF for hashes; patch/archive hashes use raw
bytes. Build outputs and other extra files are ignored by the verifier.
`SHA256SUMS` covers the bundle files for independent integrity checks.

## Build the result

From the reconstructed source folder:

```powershell
mingw32-make -C src graphics GRAPHICS=gdi
mingw32-make -C src graphics GRAPHICS=sdl3
```

GDI is the default graphics selection: Windows-only, small, and requires
only MinGW-w64 GCC plus make. SDL3 requires CMake 3.21+, GCC/G++, and SDL3
sources on Windows, and produces a larger statically linked executable.
Set `GRAPHICS` in `src/Makefile` to persist the choice. Executables are
`src/pmars-gdi.exe` and `src/pmars-sdl3.exe`.

This patch bundle contains no binaries or SDL source archive. For SDL3,
copy the existing `SDL3-3.4.16.zip` into the reconstructed source's
`dependencies` folder, or pass `SDL_DIR` pointing to the existing extracted
SDL3 source. `SDL_DIR` is resolved relative to `src`; absolute paths also
work. The CMake build does not download dependencies automatically.
The project's existing `dependencies` directory supplies SDL3 and the
local CMake tool used in prior validation. No SDL dependency is needed for
GDI. See `BUILD-DISPLAYS.md` in the patched source for options and tests.

## Verification

Both routes were applied with `git apply --check` followed by `git apply`
on separate fresh baseline extractions. Their complete source file sets
and all 88 normalized hashes matched the live combined tree. The unchanged
core patch was also checked against its original manifest.
The resulting code had already passed GDI and SDL3 regression suites and
native Windows rendering/input checks. A fresh build from the reconstructed
two-patch tree also ran the GDI test suite; see VALIDATION.txt.
Unix/macOS builds remain untested.
