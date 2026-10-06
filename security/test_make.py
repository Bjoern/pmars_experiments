"""Check make entry points/platform selection without compiling.
Usage: python security/test_make.py [make-command]
Platform triples are simulated; this does not validate native compilation.
"""
from pathlib import Path
import os
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
MAKE = sys.argv[1] if len(sys.argv) > 1 else "make"
checks = 0

def run(args, yes=(), no=(), fail=False):
    global checks
    p = subprocess.run([MAKE, "--no-print-directory", "-B", "-n", *args],
                       cwd=ROOT, env=dict(os.environ, DISPLAY=":0"),
                       capture_output=True, text=True, timeout=30)
    output = p.stdout + p.stderr
    assert (p.returncode != 0) == fail, (args, output)
    assert all(x in output for x in yes), (args, output)
    assert all(x not in output for x in no), (args, output)
    checks += 1

win = "TARGET_TRIPLE=x86_64-w64-mingw32"
for triple in ("arm64-apple-darwin", "x86_64-linux-gnu"):
    for entry in ([], ["-C", "src"]):
        run([*entry, "TARGET_TRIPLE=" + triple],
            yes=("Unix Makefiles", "-DPMARS_STATIC=ON", "--target pmars-sdl3",
                 "pmars-sdl3\" \"pmars-sdl3", "-DCMAKE_BUILD_TYPE=\"Release\""),
            no=("-DGDIGRAPHX", "pkg-config", "pmars-sdl3.exe"))
run([win], yes=("-DGDIGRAPHX", "-lgdi32"), no=("cmake",))
run([win, "GRAPHICS=sdl3", "JOBS=3", "SDL_BUILD_TYPE=Debug", "CXX=clang++"],
    yes=("MinGW Makefiles", "--parallel 3", "-DCMAKE_BUILD_TYPE=\"Debug\"",
         "-DCMAKE_CXX_COMPILER=\"clang++\"", "pmars-sdl3.exe"), no=("-DGDIGRAPHX",))
run([win, "sdl3"], yes=("--target pmars-sdl3",), no=("-DGDIGRAPHX",))
run([win, "TARGET=server"], yes=("-DSERVER",), no=("cmake", "-DGDIGRAPHX"))
run([win, "help"], yes=("make help",), no=("--build", "-DGDIGRAPHX"))
run(["-C", "src", "-f", "Makefile.mingw", win], yes=("-DGDIGRAPHX",))
run(["TARGET_TRIPLE=arm64-apple-darwin", "gdi"],
    yes=("GDI requires a Windows-targeting compiler",), fail=True)
run([win, "GRAPHICS=invalid"], yes=("Unsupported GRAPHICS",), fail=True)
run([win, "TARGET=invalid"], yes=("Unsupported TARGET",), fail=True)
print(f"PASS: {checks} make entry-point, platform-selection and override checks")
