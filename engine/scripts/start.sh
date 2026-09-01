#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Ensure Conda activation if available
if command -v conda &> /dev/null; then
  eval "$(conda shell.bash hook 2>/dev/null || true)"
  conda activate ai-ml 2>/dev/null || true
fi

# Locate llama-server binary across common installation paths
LLAMA_BIN=""
if command -v llama-server &> /dev/null; then
  LLAMA_BIN="$(command -v llama-server)"
elif [[ -x "$HOME/.local/bin/llama-server" ]]; then
  LLAMA_BIN="$HOME/.local/bin/llama-server"
elif [[ -x "$ROOT/repos/llama.cpp/build/bin/llama-server" ]]; then
  LLAMA_BIN="$ROOT/repos/llama.cpp/build/bin/llama-server"
fi

if [[ -z "$LLAMA_BIN" ]]; then
  echo "❌ Error: llama-server binary not found!"
  echo "Please build llama.cpp with CUDA support by following the steps in README.md."
  exit 1
fi

mkdir -p logs
mkdir -p data/uploads data/patients data/manifests data/qdrant_db

# Auto-start Qdrant Docker container if docker service is available
if command -v docker &> /dev/null; then
  if ! docker ps --format '{{.Names}}' | grep -q "ps47-qdrant"; then
    echo "🐳 Starting Qdrant Docker container..."
    docker start ps47-qdrant 2>/dev/null || docker run -d --name ps47-qdrant -p 6333:6333 -v ps47_qdrant_data:/qdrant/storage qdrant/qdrant:latest 2>/dev/null || echo "⚠️ Qdrant container could not start; Engine will auto-fallback to embedded local storage."
  fi
fi

echo "🚀 Starting Local Medical LLM Server (Port 38127)..."
"$LLAMA_BIN" -m data/models/lingshu-i-8b/Lingshu-I-8B-Q4_K_M.gguf \
  --host 127.0.0.1 --port 38127 -ngl 4 -c 4096 -np 1 > logs/llama-medical.log 2>&1 &
MED_PID=$!

echo "🚀 Starting Local OCR VLM Server (Port 38128)..."
"$LLAMA_BIN" -m data/models/paddleocr-vl-0.9b/PaddleOCR-VL-0.9B-GGUF.gguf \
  --mmproj data/models/paddleocr-vl-0.9b/PaddleOCR-VL-0.9B-GGUF-mmproj.gguf \
  --host 127.0.0.1 --port 38128 -ngl 8 -c 2048 -np 1 > logs/llama-ocr.log 2>&1 &
OCR_PID=$!

cleanup() {
  echo "Stopping backend services..."
  kill "$MED_PID" "$OCR_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

sleep 3
echo "✨ Starting PS47 FastAPI Engine on http://127.0.0.1:8110 ..."
exec uvicorn main:app --host 127.0.0.1 --port 8110
