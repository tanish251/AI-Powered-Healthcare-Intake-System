# 🏥 PS47 AI-Powered Healthcare Intake System & Medical Engine

An end-to-end, privacy-first, locally deployed medical intake engine and diagnostic testing system. Designed for local operation on consumer GPUs (e.g. NVIDIA RTX 3050), this platform ingests complex patient medical reports (scanned PDFs, lab images, handwritten clinical notes, and text), normalizes medical language, indexes evidence using a weighted 20/20/60 hybrid RAG pipeline, and generates evidence-grounded doctor case sheets and patient guidance.

---

## 🏗️ System Architecture & Workflow

```text
Patient Medical Reports / Lab Images / Symptoms
 ├─> Document Upload (FastAPI / REST API)
 │    └─> Multi-Pass Consensus OCR & Document Processing
 │         ├─> Primary: PaddleOCR-VL-0.9B (Visual Layout & Text Extraction)
 │         ├─> Fallback: TrOCR-base-handwritten (3-Pass Consensus for Low-Confidence Regions)
 │         └─> Language Normalizer (Hinglish/Devanagari Glossary & IndicTrans2)
 ├─> Structured Patient State & History Timeline (data/patients/{id}/state.json)
 ├─> Hybrid Vector & Sparse Retrieval Pipeline (Qdrant + BM25 + CrossEncoder Reranker)
 │    ├─> 20% Dense Vector Embeddings (BAAI/bge-small-en-v1.5)
 │    ├─> 20% Sparse Keyword Search (BM25Okapi)
 │    └─> 60% Neural CrossEncoder Reranking (ms-marco-MiniLM-L-6-v2) + Recency Boosting
 ├─> Evidence Sufficiency & Grounding Layer
 │    ├─> Evaluates retrieval score threshold
 │    └─> Triggers SearXNG local web search IF local evidence is insufficient
 └─> Local Medical LLM Inference (Lingshu-I-8B GGUF via llama-server)
      ├─> Synthesizes Doctor Case Sheet (JSON) & Patient Guidance (5 Clinical Sections)
      └─> Strict Citation Validation Layer (Strips unsupported tags & enforces "I don't know")
```

---

## 📁 Repository Directory Structure

```text
.
├── engine/                       # Core AI/ML FastAPI Engine (Scope for Python Engine)
│   ├── app/                      # Pipeline Application Logic
│   │   ├── api.py                # FastAPI REST Route Definitions
│   │   ├── document/             # PyMuPDF, PaddleOCR-VL & TrOCR Handwriting Processor
│   │   ├── language/             # IndicTrans2 & Hinglish Medical Normalizer
│   │   ├── llm/                  # llama-server OpenAI-compatible Client
│   │   ├── patient/              # Structured Patient State & Timeline Persistence
│   │   ├── pipelines/            # PS47 Central Orchestrator & Citation Validator
│   │   ├── rag/                  # 20/20/60 Hybrid RAG (Qdrant + BM25 + Reranker)
│   │   ├── safety/               # Grounding & Evidence Sufficiency Evaluation
│   │   └── web/                  # SearXNG Web Evidence Retrieval Client
│   ├── config/                   # System Settings & Pydantic Config Manager
│   │   └── settings.py           # Model URLs, Collection Names & Threshold Defaults
│   ├── scripts/                  # Service Startup Scripts
│   │   └── start.sh              # Launches LLM, OCR, and FastAPI Uvicorn Server
│   ├── static/                   # Diagnostic Single-Page HTML Testing Portal
│   │   └── index.html            # Web UI for Document Upload, Chat, & Case Sheet
│   ├── main.py                   # FastAPI Application Entrypoint
│   └── requirements.txt          # Engine Python Package Dependencies
├── src/                          # React + Vite + Tailwind CSS Frontend Application
│   ├── App.tsx                   # Main React Application Component
│   ├── main.tsx                  # React Entrypoint
│   └── index.css                 # Global CSS & Tailwind v4 Customizations
├── tests/                        # Comprehensive Unit & Integration Tests
│   ├── test_ps47_engine.py       # Engine Unit Tests (OCR, Sufficiency, Citation)
│   └── test_e2e_full_pipeline.py # End-to-End Pipeline Verification
├── index.html                    # Frontend HTML Shell
├── vite.config.ts                # Vite Development Server Configuration
└── README.md                     # System Setup & Documentation Guide
```

---

## 🤖 Complete Model Inventory & File Locations

All AI/ML models run 100% locally. The required model files are located inside `engine/data/models/`:

| Model Purpose | Exact Model Name | Source / Format | Local Directory Target Path |
|---|---|---|---|
| **Medical LLM** | `Lingshu-I-8B-Q4_K_M.gguf` | Lingshu-AI (GGUF 4-bit) | `engine/data/models/lingshu-i-8b/` |
| **OCR VLM** | `PaddleOCR-VL-0.9B-GGUF.gguf` | PaddlePaddle (GGUF 0.9B) | `engine/data/models/paddleocr-vl-0.9b/` |
| **OCR Vision Projection** | `PaddleOCR-VL-0.9B-GGUF-mmproj.gguf` | PaddlePaddle (MMPROJ) | `engine/data/models/paddleocr-vl-0.9b/` |
| **Handwriting OCR** | `microsoft/trocr-base-handwritten` | HuggingFace VisionEncoder | Pre-cached / HuggingFace Cache |
| **Language Normalizer** | `AI4Bharat/IndicTrans2-indic-en-1B` | HuggingFace NMT | Pre-cached / HuggingFace Cache |
| **Dense Embeddings** | `BAAI/bge-small-en-v1.5` | SentenceTransformers | Pre-cached / HuggingFace Cache |
| **CrossEncoder Reranker** | `cross-encoder/ms-marco-MiniLM-L-6-v2` | SentenceTransformers | Pre-cached / HuggingFace Cache |

---

## 🛠️ Step-by-Step Installation & Setup Guide

Follow this sequence to install dependencies, download models, build inference binaries, and run the engine locally.

### Step 1: Install System Prerequisites
```bash
sudo apt update && sudo apt install -y \
    build-essential \
    cmake \
    git \
    git-lfs \
    curl \
    wget \
    ffmpeg \
    libgl1-mesa-glx \
    libglib2.0-0 \
    docker.io \
    docker-compose-v2
```

---

### Step 2: Create & Activate Conda Environment
```bash
conda create -n ai-ml python=3.10 -y
conda activate ai-ml
```

---

### Step 3: Install Python Dependencies
```bash
# Install PyTorch with CUDA 12.1 acceleration
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121

# Install engine core libraries
pip install \
    fastapi>=0.115.0 \
    "uvicorn[standard]>=0.34.0" \
    httpx>=0.28.0 \
    pydantic>=2.10.0 \
    pydantic-settings>=2.7.0 \
    python-multipart>=0.0.20 \
    qdrant-client>=1.14.0 \
    sentence-transformers>=3.4.0 \
    rank-bm25>=0.2.2 \
    numpy>=1.26.0 \
    pymupdf>=1.25.0 \
    Pillow>=10.4.0 \
    opencv-python-headless>=4.10.0 \
    orjson>=3.10.0 \
    python-dotenv>=1.0.0 \
    rapidfuzz>=3.12.0 \
    beautifulsoup4>=4.12.0 \
    huggingface_hub>=0.30.0 \
    transformers>=4.40.0
```

---

### Step 4: Build `llama.cpp` with CUDA Acceleration
```bash
mkdir -p engine/repos && cd engine/repos
git clone https://github.com/ggerganov/llama.cpp.git
cd llama.cpp

mkdir build && cd build
cmake .. -DGGML_CUDA=ON
cmake --build . --config Release -j$(nproc)
cd ../../../..
```
*Binary path*: `engine/repos/llama.cpp/build/bin/llama-server`

---

### Step 5: Start Docker Infrastructure Services

#### Launch Qdrant Vector Database (Port 6333)
```bash
docker run -d \
  --name ps47-qdrant \
  --restart unless-stopped \
  -p 6333:6333 \
  -v ps47_qdrant_data:/qdrant/storage \
  qdrant/qdrant:latest
```

#### Launch SearXNG Search Engine (Port 8080)
```bash
docker run -d \
  --name ps47-searxng \
  --restart unless-stopped \
  -p 8080:8080 \
  -e "SEARXNG_BASE_URL=http://localhost:8080/" \
  searxng/searxng:latest
```

---

### Step 6: Download All Model Weights in Sequence

```bash
# Create model target directories
mkdir -p engine/data/models/lingshu-i-8b
mkdir -p engine/data/models/paddleocr-vl-0.9b

# 1. Download Lingshu Medical LLM GGUF (8B)
huggingface-cli download Lingshu-AI/Lingshu-I-8B-GGUF \
    Lingshu-I-8B-Q4_K_M.gguf \
    --local-dir engine/data/models/lingshu-i-8b

# 2. Download PaddleOCR-VL GGUF & Vision MMProj
huggingface-cli download PaddlePaddle/PaddleOCR-VL-0.9B-GGUF \
    PaddleOCR-VL-0.9B-GGUF.gguf \
    --local-dir engine/data/models/paddleocr-vl-0.9b

huggingface-cli download PaddlePaddle/PaddleOCR-VL-0.9B-GGUF \
    PaddleOCR-VL-0.9B-GGUF-mmproj.gguf \
    --local-dir engine/data/models/paddleocr-vl-0.9b

# 3. Pre-cache HuggingFace Vision & Embedding Models
python3 -c "
from transformers import TrOCRProcessor, VisionEncoderDecoderModel
TrOCRProcessor.from_pretrained('microsoft/trocr-base-handwritten')
VisionEncoderDecoderModel.from_pretrained('microsoft/trocr-base-handwritten')

from sentence_transformers import SentenceTransformer, CrossEncoder
SentenceTransformer('BAAI/bge-small-en-v1.5')
CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2')
print('All models successfully downloaded and cached!')
"
```

---

## ⚡ 7. Running & Testing the Engine

### Start All Services
```bash
cd engine
bash scripts/start.sh
```

### Access Ports & Services

- **FastAPI Core Engine & Web Portal**: `http://127.0.0.1:8110/`
- **Health Check Endpoint**: `http://127.0.0.1:8110/health`
- **Medical LLM Server**: `http://127.0.0.1:38127`
- **OCR VLM Server**: `http://127.0.0.1:38128`
- **Qdrant Vector Database**: `http://127.0.0.1:6333`
- **SearXNG Search**: `http://127.0.0.1:8080`

### Running Automated Test Suite & OCR Extraction Demos
```bash
# Run unit & pipeline tests
conda run -n ai-ml pytest tests/test_ps47_engine.py -v

# Run live OCR extraction demo on sample lab report and prescription
python3 tests/demo_ocr_extraction.py
```

---

## 🧪 Live Sample OCR Information Extraction Demos

The PS47 Engine includes a live demonstration script (`tests/demo_ocr_extraction.py`) that processes sample lab reports and prescriptions through the multi-pass vision consensus engine (`PaddleOCR-VL-0.9B` + `TrOCR`):

### 1. Laboratory Blood Report (`sample_blood_report.png`)
- **Processing Time**: `6457.27 ms`
- **OCR Engine**: `paddleocr-vl-0.9b` (Confidence: `0.763`, Status: `VERIFIED`)
- **Patient**: Rahul Verma (45 / Male) | **Date**: 01-Sep-2026
- **Extracted Lab Parameters**:
  - `Hemoglobin (Hb)`: **8.5 g/dL (LOW)** *(Ref: 13.5 - 17.5)*
  - `Total WBC Count`: **14,800 /uL (HIGH)** *(Ref: 4,000 - 11,000)*
  - `Platelet Count`: **92,000 /uL (LOW)** *(Ref: 150,000 - 450,000)*
  - `Fasting Blood Sugar (FBS)`: **148 mg/dL (HIGH)** *(Ref: 70 - 99)*
  - `HbA1c`: **7.8% (HIGH)** *(Ref: 4.0 - 5.6)*
  - `Serum Creatinine`: **1.1 mg/dL** | `Sodium (Na+)`: **138 mEq/L** | `Potassium (K+)`: **4.2 mEq/L**
- **Clinical Impression Extracted**:
  1. *Moderate Anemia with Leukocytosis (Elevated WBC suggesting active infection)*
  2. *Thrombocytopenia (Mild to Moderate Low Platelets)*
  3. *Uncontrolled Glycemia (HbA1c 7.8%) — Endocrinology consultation recommended*

### 2. Medical Doctor Prescription (`sample_prescription.png`)
- **Processing Time**: `3503.22 ms`
- **OCR Engine**: `paddleocr-vl-0.9b` (Confidence: `0.768`, Status: `VERIFIED`)
- **Doctor**: Dr. Sanjay Mehta, MD (MMC-84721) | **Patient**: Mrs. Sunita Patel (52 yrs / Female)
- **Diagnosis Extracted**: *Acute Bronchial Infection with Productive Cough, Low Grade Fever (100.4 F)*
- **Extracted Prescribed Medications (Rx)**:
  1. `Tab. Amoxicillin + Clavulanate 625mg`: 1 tablet twice daily after meals (5 Days)
  2. `Tab. Paracetamol 650mg (Dolo)`: 1 tablet thrice daily when fever > 100 F (3 Days)
  3. `Cap. Pantoprazole 40mg (Pan-40)`: 1 capsule once daily in morning (7 Days)
  4. `Syr. Benadryl Cough Formula 10ml`: 2 teaspoonfuls thrice daily after meals (5 Days)
  5. `Tab. Cetirizine 10mg`: 1 tablet once daily at bedtime (5 Days)

---

## 🔑 Key API Endpoints

- `GET /health`: Comprehensive health check of all 6 runtime services.
- `POST /documents/ingest`: Ingest PDF, PNG, JPG, or TXT file for a given `patient_id`.
- `GET /patients/{id}/state`: Retrieve active structured patient state & timeline.
- `POST /patients/{id}/chat`: Ask patient symptoms / report question (`message` form field).
- `POST /patients/{id}/case-sheet`: Synthesize evidence-grounded Doctor Case Sheet JSON.
