# pMARS experiments

Personal working copy of pMARS 0.9.6-dev for Windows/macOS development and
preparing patches for upstream. This is not the official pMARS repository.
The original AUTHORS, COPYING and ChangeLog are retained.

The source includes core hardening fixes and selectable Windows GDI / SDL3
displays. The original source snapshot, two-patch series and equivalent
combined patch are in [patches/dual-display](patches/dual-display/README.md).
The checkout is already patched: do not apply those patches to it.

## Clone on the Mac

```sh
git clone https://github.com/Bjoern/pmars_experiments.git
cd pmars_experiments
```

The repository is private, so authenticate with your GitHub account through
a credential manager or GitHub CLI. Do not use your GitHub account password
as a Git HTTPS password.

## Try the macOS build

Requires Xcode command-line tools and CMake 3.21 or newer. The pinned SDL3
source archive is included; CMake extracts it into the build directory.

```sh
cmake -S . -B build-macos -DCMAKE_BUILD_TYPE=Release -DPMARS_STATIC=ON
cmake --build build-macos --target pmars-sdl3 --parallel
./build-macos/pmars-sdl3 -v 834 warriors/sunset.red warriors/excalibur.red
```

This links SDL3 statically, while retaining macOS system dependencies.
The exact macOS build is not yet verified. A previous attempt reportedly
worked after adding a missing include; that fix still needs to be identified
and committed. Preserve the compiler diagnostic when reproducing it.
The Unix/macOS makefile path uses an installed SDL3 via pkg-config; the
CMake commands above use the included SDL3 source archive instead.

## Windows builds

With MinGW-w64 GCC and GNU make:

```powershell
mingw32-make -C src graphics GRAPHICS=gdi
mingw32-make -C src graphics GRAPHICS=sdl3
```

SDL3 additionally requires CMake and G++. GDI is the smaller, simpler default.
See [BUILD-DISPLAYS.md](BUILD-DISPLAYS.md) for options and validation details.

## Working between computers

Run `git pull --ff-only` before making changes. Commit and push fixes from
one machine, then pull them on the other. Builds, local dependency tools,
extracted SDL sources and executables are excluded by `.gitignore`.

The patch bundle describes the initial tested GDI/SDL3 state. Subsequent
commits do not automatically update those patches or their manifests; rebuild
the bundle when preparing a new submission to upstream. Git configuration
and history stay in `.git` and are not included in the patches.
