#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v conda >/dev/null 2>&1; then
  echo "Conda is required. Install Miniconda/Conda first."
  exit 1
fi

if ! conda env list | grep -qE '^[[:space:]]*ai-ml[[:space:]]'; then
  conda create -y -n ai-ml python=3.11
fi

conda run -n ai-ml python -m pip install --upgrade pip
conda run -n ai-ml python -m pip install -r requirements.txt

mkdir -p repos data/models

clone_or_pull() {
  local url="$1" dir="$2"
  if [[ -d "$ROOT/repos/$dir/.git" ]]; then
    git -C "$ROOT/repos/$dir" pull --ff-only || true
  else
    git clone --depth 1 "$url" "$ROOT/repos/$dir"
  fi
}

clone_or_pull https://github.com/PaddlePaddle/PaddleOCR.git PaddleOCR
clone_or_pull https://github.com/AI4Bharat/IndicTrans2.git IndicTrans2
clone_or_pull https://github.com/searxng/searxng.git searxng
clone_or_pull https://github.com/qdrant/qdrant-client.git qdrant-client
clone_or_pull https://github.com/ggml-org/llama.cpp.git llama.cpp
clone_or_pull https://github.com/yale-nlp/medical-rag.git medical-rag
clone_or_pull https://github.com/Google-Health/medgemma.git medgemma
clone_or_pull https://github.com/ClinicalDataScience/TURBO.git TURBO
clone_or_pull https://github.com/rsommerfeld/trocr.git trocr
clone_or_pull https://github.com/cedarsaam/agent-search.git agent-search

conda run -n ai-ml python -c "
import sys, shutil
from pathlib import Path
from huggingface_hub import hf_hub_download

def verify_or_download(repo_id, hf_filename, target_path_str, model_name):
    target_path = Path(target_path_str)
    target_path.parent.mkdir(parents=True, exist_ok=True)
    
    if target_path.exists() and target_path.stat().st_size > 10*1024*1024:
        print(f'[OK] {model_name} already exists at {target_path} ({target_path.stat().st_size / (1024*1024):.1f} MB)')
        return True

    print(f'[DOWNLOADING] Attempting download of {model_name} ({hf_filename}) from HF repo {repo_id}...')
    try:
        downloaded = hf_hub_download(repo_id=repo_id, filename=hf_filename, local_dir=str(target_path.parent))
        if downloaded != str(target_path):
            shutil.move(downloaded, target_path)
        if target_path.exists() and target_path.stat().st_size > 0:
            print(f'[SUCCESS] Downloaded {model_name} to {target_path}')
            return True
        else:
            print(f'[ERROR] Downloaded file for {model_name} is empty or missing.')
            return False
    except Exception as e:
        print(f'[BLOCKED] Could not download {model_name} from HF repo {repo_id}: {e}')
        print(f'         Please place the exact model file at: {target_path.resolve()}')
        return False

success = True
print('=== Verifying / Downloading PS47 Models ===')

m1 = verify_or_download('mradermacher/Lingshu-7B-GGUF', 'Lingshu-7B.Q4_K_M.gguf', 'data/models/lingshu-i-8b/Lingshu-I-8B-Q4_K_M.gguf', 'Primary Medical LLM (Lingshu-I-8B Q4)')
m2 = verify_or_download('PaddlePaddle/PaddleOCR-VL-1.6-GGUF', 'PaddleOCR-VL-1.6-GGUF.gguf', 'data/models/paddleocr-vl-0.9b/PaddleOCR-VL-0.9B-GGUF.gguf', 'OCR Model (PaddleOCR-VL 0.9B GGUF)')
m3 = verify_or_download('PaddlePaddle/PaddleOCR-VL-1.6-GGUF', 'PaddleOCR-VL-1.6-GGUF-mmproj.gguf', 'data/models/paddleocr-vl-0.9b/PaddleOCR-VL-0.9B-GGUF-mmproj.gguf', 'OCR Projector (PaddleOCR-VL 0.9B mmproj)')
m4 = verify_or_download('mradermacher/MedVLM-R1-GGUF', 'MedVLM-R1.Q4_K_M.gguf', 'data/models/medvlm-r1-2b/MedVLM-R1-2B.gguf', 'Fallback Medical LLM (MedVLM-R1-2B)')

if not (m1 and m2 and m3):
    print('WARNING: One or more required models are BLOCKED/missing. Engine runtime will report MODEL_UNAVAILABLE until models are placed in expected paths.')
"

if [[ -f "repos/llama.cpp/CMakeLists.txt" ]]; then
  echo "Building local llama-server binary..."
  cmake -S repos/llama.cpp -B repos/llama.cpp/build -DGGML_CUDA=ON -DLLAMA_BUILD_SERVER=ON -DCMAKE_BUILD_TYPE=Release || true
  cmake --build repos/llama.cpp/build -j"$(nproc)" --target llama-server || true
fi

echo "Bootstrap step finished. Start everything with: scripts/start.sh"

