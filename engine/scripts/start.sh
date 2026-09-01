#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
source "$(conda info --base)/etc/profile.d/conda.sh"
conda activate ai-ml

LLAMA_BIN="${LLAMA_BIN:-$HOME/.local/bin/llama-server}"
if [[ ! -x "$LLAMA_BIN" ]]; then
  LLAMA_BIN="$ROOT/repos/llama.cpp/build/bin/llama-server"
fi
mkdir -p logs

"$LLAMA_BIN" -m data/models/lingshu-i-8b/Lingshu-I-8B-Q4_K_M.gguf \
  --host 127.0.0.1 --port 38127 -ngl 4 -c 4096 -np 1 > logs/llama-medical.log 2>&1 &
MED_PID=$!

"$LLAMA_BIN" -m data/models/paddleocr-vl-0.9b/PaddleOCR-VL-0.9B-GGUF.gguf \
  --mmproj data/models/paddleocr-vl-0.9b/PaddleOCR-VL-0.9B-GGUF-mmproj.gguf \
  --host 127.0.0.1 --port 38128 -ngl 8 -c 2048 -np 1 > logs/llama-ocr.log 2>&1 &
OCR_PID=$!

cleanup() { kill "$MED_PID" "$OCR_PID" 2>/dev/null || true; }
trap cleanup EXIT INT TERM

sleep 2
exec uvicorn main:app --host 127.0.0.1 --port 8110
