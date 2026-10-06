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

## Build on macOS or Linux

On macOS, install the Xcode command-line tools and CMake 3.21 or newer.
On Linux, install GCC/G++, GNU make, CMake and the development dependencies
for SDL's windowing backends. From the repository root, simply run:

```sh
make
./src/pmars-sdl3 -v 834 warriors/sunset.red warriors/excalibur.red
```

Make configures a Release build with CMake, builds the included SDL3 source
statically and copies the executable to `src/pmars-sdl3`. An installed SDL3
or pkg-config is not needed. System libraries/frameworks remain dependencies.
The exact macOS/Linux build remains unverified here; please retain any
compiler diagnostic, including the previously reported missing-include error.

## Choose a target or change the defaults

```sh
make sdl3                       # explicitly select SDL3
make server                     # headless build
make GRAPHICS=sdl3 JOBS=4        # override graphics choice / build parallelism
make SDL_BUILD_TYPE=Debug        # SDL3 debug build
make help                       # targets and settings
```

Edit the settings near the top of `src/Makefile` to persist your choices:
`TARGET` (default `graphics`), `GRAPHICS` (GDI on Windows, SDL3 elsewhere),
`JOBS`, `SDL_BUILD_TYPE`, compiler paths and `CMAKE_ARGS`. Command-line
assignments override these defaults. `make TARGET=server` is equivalent to
selecting the server target directly. `make -C src` works too; paths such as
`SDL_DIR` and `SDL_BUILD_DIR` are always relative to `src`.

The classic `default` (console/debugger), `server`, `curses` and `xwin`
targets retain their shared object build. Run `make clean` when switching
between those classic targets or changing their compiler flags.
GDI and SDL3 have separate build paths and need no cleaning when switching.

## Windows builds

With MinGW-w64 GCC and GNU make:

```powershell
mingw32-make                     # GDI: small, no SDL/CMake dependency
mingw32-make sdl3                # SDL3: requires CMake and G++ too
```

`make` works instead if that is the name of your GNU make executable.
See [BUILD-DISPLAYS.md](BUILD-DISPLAYS.md) for options and validation details.

## Working between computers

Run `git pull --ff-only` before making changes. Commit and push fixes from
one machine, then pull them on the other. Builds, local dependency tools,
extracted SDL sources and executables are excluded by `.gitignore`.

The patch bundle describes the initial tested GDI/SDL3 state. Subsequent
commits do not automatically update those patches or their manifests; rebuild
the bundle when preparing a new submission to upstream. Git configuration
and history stay in `.git` and are not included in the patches.
