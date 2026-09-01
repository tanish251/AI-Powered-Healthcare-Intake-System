# PS47 Local Medical Engine

Local, frontend-agnostic core for SIH26047 (Patient Case-Taking Software).

## Product contract

- **Doctor output:** a generated case sheet. No doctor chatbot.
- **Patient output:** a restricted chat for immediate supportive guidance while waiting for professional care. It must not act as a diagnosing or prescribing clinician.
- **Local-first:** OCR, translation, retrieval and medical LLM can run locally. SearXNG is used only as a controlled web fallback.
- **Evidence-first:** every extracted patient fact carries provenance to the original document/page/region where available.

## Recommended runtime

- Python 3.11 or 3.12
- Persistent llama.cpp `llama-server`
- Qdrant
- SearXNG
- PaddleOCR / PaddleOCR-VL
- TrOCR handwriting fallback
- IndicTrans2
- MedGemma 1.5 4B Q4 for llama.cpp

### Why MedGemma 1.5 4B instead of Lingshu-I-8B by default?
The current Lingshu-I-8B release is an official Transformers model, but a trustworthy llama.cpp GGUF release could not be verified. The engine therefore defaults to a verified llama.cpp-compatible MedGemma 1.5 4B Q4 build. Lingshu can be added later behind another adapter if a compatible GGUF is validated.

## Services

Default endpoints:

- Medical LLM: `http://127.0.0.1:38127/v1`
- OCR llama.cpp service (optional): `http://127.0.0.1:38128/v1`
- Qdrant: `http://127.0.0.1:6333`
- SearXNG: `http://127.0.0.1:8080`

## Quick start

```bash
cd ps47_engine
conda create -y -n ai-ml python=3.11  # bootstrap.sh does this automatically if missing
conda activate ai-ml
pip install -r requirements.txt
cp .env.example .env
```

Then run `scripts/bootstrap.sh` to install/clone dependencies and download the selected local model artifacts. Edit `.env` before starting services.

### OCR Information Extraction Demo
```bash
# Process sample lab report & doctor prescription through OCR consensus pipeline
python3 ../tests/demo_ocr_extraction.py
```

## API

```text
POST /documents/ingest
GET  /patients/{patient_id}/state
POST /patients/{patient_id}/case-sheet
POST /patients/{patient_id}/chat
GET  /patients/{patient_id}/sources
GET  /health
```

## Source provenance

Patient evidence is stored as JSON metadata containing `document_id`, `page`, `region`, `ocr_confidence`, and original path. Web evidence contains URL/title/snippet. The model is prompted to cite only provided evidence IDs.

## Safety note

This is an engineering prototype, not a clinical device. Medical outputs require clinician review and validation before any real-world use. Patient mode is intentionally restricted to supportive guidance and escalation/red-flag messaging.
