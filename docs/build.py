"""Build with an activated Emscripten SDK, or EMCC=/path/to/emcc."""
from pathlib import Path
import os
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
emcc = os.environ.get("EMCC") or shutil.which("emcc")
if not emcc:
    raise SystemExit("Activate emsdk_env first, or set EMCC to emcc (emcc.bat on Windows).")
out = ROOT / "docs" / "dist"
out.mkdir(exist_ok=True)
sources = "pmars asm eval disasm cdb sim pos clparse global token str_eng webapi".split()
subprocess.run([emcc, "-O2", "-std=gnu99", "-Wno-deprecated-non-prototype",
    "-DSERVER", "-DBROWSER", "-DEXT94", "-DPERMUTATE",
    *[str(ROOT / "src" / f"{s}.c") for s in sources],
    "-sMODULARIZE=1", "-sEXPORT_ES6=1", "-sENVIRONMENT=web,worker,node",
    "-sALLOW_MEMORY_GROWTH=1", "-sMAXIMUM_MEMORY=134217728",
    "-sSTACK_SIZE=1048576", "-sINVOKE_RUN=0",
    "-sEXPORTED_FUNCTIONS=['_malloc','_free']",
    "-sEXPORTED_RUNTIME_METHODS=['ccall','FS','HEAPU8','HEAPU32']",
    "-o", str(out / "pmars.mjs")], check=True)

# A /docs Pages deployment must contain its runtime and corresponding sources.
import zipfile
shutil.copyfile(ROOT / "COPYING", ROOT / "docs" / "COPYING")
(ROOT / "docs" / ".nojekyll").touch()
with zipfile.ZipFile(ROOT / "docs" / "pmars-source.zip", "w", zipfile.ZIP_DEFLATED) as archive:
    paths = [ROOT / "COPYING", ROOT / "AUTHORS", ROOT / "README.md"]
    paths += sorted((ROOT / "src").glob("*.c")) + sorted((ROOT / "src").glob("*.h"))
    paths += sorted(p for p in (ROOT / "docs").iterdir() if p.suffix in (".mjs", ".py", ".css", ".html", ".md"))
    for p in paths:
        entry = zipfile.ZipInfo(p.relative_to(ROOT).as_posix(), (1980,1,1,0,0,0))
        archive.writestr(entry, p.read_bytes(), compress_type=zipfile.ZIP_DEFLATED)
