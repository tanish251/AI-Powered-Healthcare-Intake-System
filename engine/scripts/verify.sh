#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
python -m compileall -q app main.py
python - <<'PY'
from app.pipelines.engine import PS47Engine
print('PS47 engine import: OK')
PY
