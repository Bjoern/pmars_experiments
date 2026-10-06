"""Verify bundle integrity and LF-normalized reconstructed source files.
Usage: python verify.py path/to/reconstructed-source
Extra generated files (such as executable/build outputs) are ignored.
"""
from pathlib import Path
import hashlib,json,sys
bundle=Path(__file__).resolve().parent
root=Path(sys.argv[1]).resolve()
m=json.loads((bundle/'manifest.json').read_text())
def check(path,expected,normalize=False):
    data=path.read_bytes()
    if normalize:data=data.replace(b'\r\n',b'\n').replace(b'\r',b'\n')
    if hashlib.sha256(data).hexdigest()!=expected:
        raise SystemExit('Hash mismatch: '+str(path))
check(bundle/m['baseline']['file'],m['baseline']['sha256'])
for name,h in m['patches'].items():check(bundle/name,h)
for name,h in m['files'].items():check(root/name,h,True)
print(f"PASS: {len(m['files'])} source/document/test files, baseline and all patch hashes")
