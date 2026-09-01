# 🏥 AI-Powered Healthcare Intake System & PS47 Medical Engine

An end-to-end, privacy-first, locally deployed medical intake engine, diagnostic case sheet generator, and patient guidance platform. Built for 100% local execution on consumer GPUs (e.g. NVIDIA RTX 3050/4060 or higher), this system ingests complex patient medical records (scanned PDFs, pathology reports, handwritten prescriptions, lab images, and text), normalizes medical language, indexes evidence using a 20/20/60 weighted hybrid RAG pipeline, and synthesizes evidence-grounded Doctor Case Sheets and Patient Guidance.

---

## 🏗️ System Architecture & End-to-End Workflow

```text
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                 FRONTEND APPLICATION                                   │
│                        (React 19 + Vite + Tailwind CSS v4 UI)                           │
│              - Interactive Document Upload & Intake Portal                              │
│              - Patient Symptom Chat & Supportive Guidance Interface                    │
│              - Real-Time Patient History Timeline & Structured Doctor Case Sheet       │
└───────────────────────────────────────────┬─────────────────────────────────────────────┘
                                            │ REST API Calls (Port 8110)
                                            ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                FASTAPI ENGINE BACKEND                                   │
│                        (PS47 Orchestration & Pipeline Gateway)                          │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. Multi-Pass Vision & OCR Consensus Pipeline                                           │
│    ├─> Primary: PaddleOCR-VL-0.9B (GGUF via llama-server on Port 38128)                 │
│    └─> Fallback: TrOCR-base-handwritten (3-Pass Consensus for Low-Confidence Regions)   │
│                                                                                         │
│ 2. Language Normalization & Translation Layer                                            │
│    ├─> IndicTrans2 (Devanagari / Indic to English NMT)                                  │
│    └─> Hinglish / Vernacular Clinical Terminology Glossary Mapping                      │
│                                                                                         │
│ 3. Structured Patient State & History Store                                             │
│    └─> Data Persistence (data/patients/{id}/state.json & data/manifests/)               │
│                                                                                         │
│ 4. 20/20/60 Weighted Hybrid RAG Retrieval Engine                                        │
│    ├─> 20% Dense Vector Embeddings (BAAI/bge-small-en-v1.5 in Qdrant DB on Port 6333)    │
│    ├─> 20% Sparse Keyword Search (BM25Okapi In-Memory Index)                            │
│    └─> 60% Neural CrossEncoder Reranker (ms-marco-MiniLM-L-6-v2) + Recency Boosting     │
│                                                                                         │
│ 5. Grounding & Evidence Sufficiency Evaluation Gate                                     │
│    ├─> Evaluates retrieval score threshold against query                                │
│    └─> Triggers local SearXNG Search (Port 8080) IF local evidence is insufficient      │
│                                                                                         │
│ 6. Local Medical LLM Inference                                                          │
│    └─> Lingshu-I-8B GGUF (via llama-server on Port 38127)                              │
│                                                                                         │
│ 7. Strict Citation Validation & Output Formatter                                        │
│    ├─> Formats Doctor Case Sheet JSON & 5-Section Patient Guidance                      │
│    └─> Strips unsupported citation tags & enforces "I don't know" policy               │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Repository Directory Structure

```text
.
├── src/                          # React + Vite + Tailwind CSS Frontend Application
│   ├── App.tsx                   # Main React Intake & Diagnostic UI Component
│   ├── main.tsx                  # React Application Entrypoint
│   └── index.css                 # Global CSS Entrypoint & Tailwind CSS v4 Theme Imports
├── engine/                       # Core Python AI/ML Diagnostic Engine & REST Gateway
│   ├── app/                      # Engine Modules & Pipeline Logic
│   │   ├── api.py                # FastAPI REST Route Definitions
│   │   ├── document/             # PyMuPDF, PaddleOCR-VL & TrOCR Handwriting Processors
│   │   ├── language/             # IndicTrans2 & Hinglish Medical Normalizer
│   │   ├── llm/                  # llama-server OpenAI-compatible Client
│   │   ├── patient/              # Structured Patient State & History Store
│   │   ├── pipelines/            # PS47 Central Pipeline Orchestrator & Citation Validator
│   │   ├── rag/                  # 20/20/60 Hybrid RAG (Qdrant + BM25 + CrossEncoder)
│   │   ├── safety/               # Evidence Sufficiency Evaluation & Safety Gate
│   │   └── web/                  # SearXNG Web Evidence Retrieval Client
│   ├── config/                   # Configuration Manager & System Settings
│   │   └── settings.py           # Model URLs, Thresholds, Collection Names, & Paths
│   ├── scripts/                  # Service Management & Launch Shell Scripts
│   │   ├── start.sh              # Universal Start Script (LLM, OCR, Qdrant, Uvicorn)
│   │   ├── llama-medical.sh      # Launches Lingshu-I-8B Medical LLM Server
│   │   └── llama-ocr.sh          # Launches PaddleOCR-VL-0.9B Vision OCR Server
│   ├── static/                   # Diagnostic Single-Page HTML Testing Portal
│   │   └── index.html            # Standalone Web UI for Direct Engine Testing
│   ├── main.py                   # FastAPI Server Entrypoint
│   └── requirements.txt          # Engine Python Package Dependencies
├── tests/                        # Comprehensive Testing & Demonstration Suite
│   ├── test_ps47_engine.py       # Pytest Suite (OCR, RAG, Sufficiency, Citation)
│   ├── test_e2e_full_pipeline.py # End-to-End Integration Verification Test
│   ├── demo_ocr_extraction.py    # Live OCR Information Extraction Script
│   └── sample_reports/           # Sample Pathology Lab Reports & Prescriptions
├── index.html                    # Frontend HTML Shell
├── vite.config.ts                # Vite Development Server Configuration
├── package.json                  # Frontend Node.js Dependencies & NPM Scripts
└── README.md                     # Central Setup, Operating & Documentation Guide
```

---

## 🤖 Complete Model Inventory & Required Local Paths

All AI/ML models operate **100% locally**. Model weights must be placed inside `engine/data/models/`:

| Model Component | Exact Model Name | Source / Format | Target Local Path |
|---|---|---|---|
| **Medical LLM** | `Lingshu-I-8B-Q4_K_M.gguf` | Lingshu-AI (GGUF 4-bit) | `engine/data/models/lingshu-i-8b/` |
| **OCR VLM** | `PaddleOCR-VL-0.9B-GGUF.gguf` | PaddlePaddle (GGUF 0.9B) | `engine/data/models/paddleocr-vl-0.9b/` |
| **OCR MMProj** | `PaddleOCR-VL-0.9B-GGUF-mmproj.gguf` | PaddlePaddle (MMPROJ) | `engine/data/models/paddleocr-vl-0.9b/` |
| **Handwriting OCR** | `microsoft/trocr-base-handwritten` | HuggingFace VisionEncoder | HuggingFace Local Cache |
| **Language NMT** | `AI4Bharat/IndicTrans2-indic-en-1B` | HuggingFace NMT | HuggingFace Local Cache |
| **Dense Embeddings** | `BAAI/bge-small-en-v1.5` | SentenceTransformers | HuggingFace Local Cache |
| **CrossEncoder Reranker** | `cross-encoder/ms-marco-MiniLM-L-6-v2` | SentenceTransformers | HuggingFace Local Cache |

---

## 🛠️ Complete Step-by-Step Setup & Installation Guide

Follow these exact steps to install all frontend and backend dependencies, compile inference engines, setup Docker services, and download model weights.

### Step 1: Install System Prerequisites
Run on Ubuntu/Debian Linux:
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
    nodejs \
    npm \
    docker.io \
    docker-compose-v2

# Enable and start Docker service
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
```

---

### Step 2: Setup Frontend Application Dependencies
In the project root directory:
```bash
# Install Node.js dependencies (React 19, Vite, Tailwind CSS v4)
npm install
```

---

### Step 3: Setup Backend Python Environment
```bash
# Create and activate Conda environment
conda create -n ai-ml python=3.10 -y
conda activate ai-ml

# Install PyTorch with CUDA 12.1 acceleration
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121

# Install engine core Python packages
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
    transformers>=4.40.0 \
    pytest>=8.0.0
```

---

### Step 4: Compile `llama.cpp` with CUDA Acceleration
Compile the high-performance C++ LLM server:
```bash
mkdir -p engine/repos && cd engine/repos
git clone https://github.com/ggerganov/llama.cpp.git
cd llama.cpp

mkdir build && cd build
cmake .. -DGGML_CUDA=ON
cmake --build . --config Release -j$(nproc)
cd ../../../..
```
*Compiled binary target path*: `engine/repos/llama.cpp/build/bin/llama-server`

---

### Step 5: Launch Infrastructure Docker Services

#### 1. Qdrant Vector Database (Port 6333)
```bash
docker run -d \
  --name ps47-qdrant \
  --restart unless-stopped \
  -p 6333:6333 \
  -v ps47_qdrant_data:/qdrant/storage \
  qdrant/qdrant:latest
```
*(Note: If Docker is unavailable, the engine automatically falls back to local file storage at `engine/data/qdrant_db`.)*

#### 2. SearXNG Local Search Engine (Port 8080)
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
# Create local target model directories
mkdir -p engine/data/models/lingshu-i-8b
mkdir -p engine/data/models/paddleocr-vl-0.9b

# 1. Download Lingshu Medical LLM GGUF (8B)
huggingface-cli download Lingshu-AI/Lingshu-I-8B-GGUF \
    Lingshu-I-8B-Q4_K_M.gguf \
    --local-dir engine/data/models/lingshu-i-8b

# 2. Download PaddleOCR-VL Vision Model GGUF & MMProj (0.9B)
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
print('✅ All AI/ML models successfully downloaded and cached!')
"
```

---

## 🪟 Windows Setup & Operating Guide (PowerShell / CMD / WSL2)

The system is fully compatible with **Windows 10 / 11** natively via PowerShell or WSL2.

### Step 1: Install Windows Prerequisites
1. **Node.js (v20+)**: Download installer from [nodejs.org](https://nodejs.org/).
2. **Miniconda / Anaconda**: Download from [docs.anaconda.com](https://docs.anaconda.com/free/miniconda/).
3. **Git for Windows**: Download from [git-scm.com](https://git-scm.com/).
4. **Docker Desktop for Windows**: Download from [docker.com](https://www.docker.com/products/docker-desktop/).
5. **Visual Studio 2022 Community** (*Desktop development with C++* workload selected).
6. **NVIDIA CUDA Toolkit 12.x**: Download from [developer.nvidia.com](https://developer.nvidia.com/cuda-downloads).

---

### Step 2: Setup Frontend & Python Backend Environment (PowerShell)

Open **PowerShell as Administrator**:

```powershell
# 1. Install React 19 / Vite Frontend Dependencies
npm install

# 2. Create and Activate Conda Python 3.10 Environment
conda create -n ai-ml python=3.10 -y
conda activate ai-ml

# 3. Install PyTorch with CUDA Acceleration for Windows
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121

# 4. Install Core Engine Packages
pip install fastapi "uvicorn[standard]" httpx pydantic pydantic-settings python-multipart qdrant-client sentence-transformers rank-bm25 numpy pymupdf Pillow opencv-python-headless orjson python-dotenv rapidfuzz beautifulsoup4 huggingface_hub transformers pytest
```

---

### Step 3: Build `llama.cpp` on Windows with CUDA

In PowerShell:
```powershell
New-Item -ItemType Directory -Force -Path "engine\repos"
Set-Location "engine\repos"
git clone https://github.com/ggerganov/llama.cpp.git
Set-Location "llama.cpp"

# Build with CMake & MSVC CUDA compiler
cmake -B build -DGGML_CUDA=ON
cmake --build build --config Release -j 8
Set-Location "..\..\.."
```
*Compiled Windows binary path*: `engine\repos\llama.cpp\build\bin\Release\llama-server.exe`

---

### Step 4: Download Model Weights on Windows

In PowerShell:
```powershell
New-Item -ItemType Directory -Force -Path "engine\data\models\lingshu-i-8b", "engine\data\models\paddleocr-vl-0.9b"

# Download Lingshu Medical LLM GGUF
huggingface-cli download Lingshu-AI/Lingshu-I-8B-GGUF Lingshu-I-8B-Q4_K_M.gguf --local-dir engine\data\models\lingshu-i-8b

# Download PaddleOCR-VL GGUF & MMProj
huggingface-cli download PaddlePaddle/PaddleOCR-VL-0.9B-GGUF PaddleOCR-VL-0.9B-GGUF.gguf --local-dir engine\data\models\paddleocr-vl-0.9b
huggingface-cli download PaddlePaddle/PaddleOCR-VL-0.9B-GGUF PaddleOCR-VL-0.9B-GGUF-mmproj.gguf --local-dir engine\data\models\paddleocr-vl-0.9b
```

---

## 🚀 How to Run the Entire Application (Linux & Windows)

You need to run both the **Backend Engine** and the **Frontend UI**.

### Option A: Recommended Full Application Launch (2 Terminal Windows)

#### Terminal 1: Launch Backend Engine Services

**On Linux / macOS (Bash)**:
```bash
conda activate ai-ml
cd engine
bash scripts/start.sh
```

**On Windows (PowerShell)**:
```powershell
conda activate ai-ml
Set-Location engine
.\scripts\start.ps1
```
*This starts the Lingshu Medical LLM server (port 38127), PaddleOCR Vision server (port 38128), Qdrant database (port 6333), and the FastAPI engine (port 8110).*

#### Terminal 2: Launch Frontend User Interface (Linux / Windows)
```bash
# In project root directory
npm run dev
```
*Access the React Frontend UI in your web browser at `http://localhost:5173`.*

---

### Option B: Manual Server Startup (Individual Control)

If you prefer starting services individually for debugging:

1. **Start Lingshu Medical LLM Server**:
   ```bash
   engine/repos/llama.cpp/build/bin/llama-server \
     -m engine/data/models/lingshu-i-8b/Lingshu-I-8B-Q4_K_M.gguf \
     --host 127.0.0.1 --port 38127 -ngl 4 -c 4096 -np 1
   ```

2. **Start PaddleOCR Vision VLM Server**:
   ```bash
   engine/repos/llama.cpp/build/bin/llama-server \
     -m engine/data/models/paddleocr-vl-0.9b/PaddleOCR-VL-0.9B-GGUF.gguf \
     --mmproj engine/data/models/paddleocr-vl-0.9b/PaddleOCR-VL-0.9B-GGUF-mmproj.gguf \
     --host 127.0.0.1 --port 38128 -ngl 8 -c 2048 -np 1
   ```

3. **Start FastAPI Engine Server**:
   ```bash
   cd engine
   conda activate ai-ml
   uvicorn main:app --host 127.0.0.1 --port 8110
   ```

4. **Start React Frontend UI**:
   ```bash
   npm run dev
   ```

---

## 💻 Standalone Diagnostic Web Portal

The backend engine also includes a self-contained diagnostic single-page testing portal accessible directly via the FastAPI backend:

- **Diagnostic HTML Portal**: `http://127.0.0.1:8110/`
- **Backend Health Status**: `http://127.0.0.1:8110/health`

---

## 📖 End-to-End User Workflow & How to Use

1. **Patient Document Ingestion**:
   - Open the application UI (`http://localhost:5173` or `http://127.0.0.1:8110/`).
   - Select or drag-and-drop patient records (blood test reports, scanned prescription PNG/PDFs, clinical notes, or text files).
   - Click **"Upload & Ingest Document"**. The engine runs multi-pass PaddleOCR + TrOCR consensus, extracts structured medical entities, normalizes terms, and updates the patient vector index in real time.

2. **Viewing Structured Timeline & State**:
   - The engine automatically updates the active patient timeline (`/patients/{id}/state`), organizing symptoms, vitals, lab values, and medications chronologically.

3. **Generating Evidence-Grounded Doctor Case Sheet**:
   - Click **"Generate Doctor Case Sheet"**.
   - The engine retrieves relevant evidence using 20/20/60 Hybrid RAG, evaluates sufficiency, prompts the Lingshu Medical LLM, validates all citations against ground-truth evidence, and renders a structured JSON Doctor Case Sheet containing:
     - Chief Complaints & History of Present Illness
     - Vitals & Clinical Examination Findings
     - Key Pathology / Radiology Lab Findings
     - Working Diagnosis & Differential Diagnoses
     - Recommended Treatment Plan & Follow-up Advice

4. **Patient Guidance & Symptom Chat**:
   - Patients can ask questions regarding their symptoms or uploaded lab reports.
   - The engine responds with supportive, non-prescriptive, evidence-grounded guidance with strict citation enforcement.

---

## 🧪 Live Sample OCR Information Extraction Demos

You can execute live OCR information extraction on sample medical reports and prescriptions using the PS47 multi-pass vision consensus engine:

```bash
# Run OCR extraction demo script
conda run -n ai-ml python tests/demo_ocr_extraction.py
```

### Extracted Sample Results (`tests/OCR_EXTRACTION_DEMO_RESULTS.md`)

#### 📄 1. Laboratory Blood Report (`sample_blood_report.png`)
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

#### 📄 2. Medical Doctor Prescription (`sample_prescription.png`)
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

## 🧪 Running Automated Unit & Pipeline Tests

Run the complete backend test suite to verify OCR consensus, language normalization, RAG retrieval scoring, evidence sufficiency gates, and citation validation:

```bash
conda run -n ai-ml pytest tests/test_ps47_engine.py -v
```

---

## 🔑 Key API Endpoints Reference

| HTTP Method | Endpoint Path | Description |
|---|---|---|
| `GET` | `/health` | Health check reporting status of all 6 runtime microservices |
| `POST` | `/documents/ingest` | Ingest PDF, PNG, JPG, or TXT file for a given `patient_id` |
| `GET` | `/patients/{id}/state` | Retrieve active structured patient state, history & timeline |
| `POST` | `/patients/{id}/case-sheet` | Generate evidence-grounded JSON Doctor Case Sheet |
| `POST` | `/patients/{id}/chat` | Send patient question (`message`) and retrieve grounded response |
| `GET` | `/patients/{id}/sources` | Retrieve all verified evidence source spans & document metadata |

---

## 🛡️ License & Safety Disclaimer

This system is an engineering prototype designed for healthcare intake research and diagnostic assistance. All outputs require review and clinical validation by a licensed medical professional prior to real-world patient care decisions. Patient mode is strictly restricted to supportive, non-prescriptive guidance and emergency escalation alerts.
