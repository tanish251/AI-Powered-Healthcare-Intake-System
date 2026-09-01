#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODEL_DIR="$ROOT/data/models/lingshu-i-8b"
LLAMA_BIN="${LLAMA_BIN:-$HOME/.local/bin/llama-server}"
if [[ ! -x "$LLAMA_BIN" ]]; then
  LLAMA_BIN="$ROOT/repos/llama.cpp/build/bin/llama-server"
fi
MODEL="$MODEL_DIR/Lingshu-I-8B-Q4_K_M.gguf"

[[ -x "$LLAMA_BIN" ]] || { echo "llama-server not found: $LLAMA_BIN"; exit 1; }
[[ -f "$MODEL" ]] || { echo "Model missing: $MODEL. Run scripts/bootstrap.sh"; exit 1; }

exec "$LLAMA_BIN" \
  -m "$MODEL" \
  --host 127.0.0.1 \
  --port 38127 \
  -ngl 999 \
  -c 8192 \
  -np 1 \
  --flash-attn on

