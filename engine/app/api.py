from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pathlib import Path
import shutil
from app.pipelines.engine import PS47Engine

router = APIRouter()
engine = PS47Engine()

@router.get("/health")
async def health():
    return await engine.health_check()

@router.post("/documents/ingest")
async def ingest(patient_id: str = Form(...), file: UploadFile = File(...)):
    safe_filename = engine.docs.sanitize_filename(file.filename or "upload.bin")
    base = Path("./data/uploads") / patient_id
    base.mkdir(parents=True, exist_ok=True)
    target = base / safe_filename
    with target.open("wb") as f:
        shutil.copyfileobj(file.file, f)
    try:
        return await engine.ingest_document(patient_id, str(target))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

@router.get("/patients/{patient_id}/state")
async def patient_state(patient_id: str):
    return engine.get_patient_state(patient_id).__dict__

@router.post("/patients/{patient_id}/case-sheet")
async def case_sheet(patient_id: str):
    try:
        return await engine.generate_case_sheet(patient_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

@router.post("/patients/{patient_id}/chat")
async def patient_chat(patient_id: str, message: str = Form(...)):
    try:
        return await engine.patient_chat(patient_id, message)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

