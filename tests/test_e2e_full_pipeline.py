"""
PS47 Real E2E Pipeline Integration Test
Executes a complete end-to-end flow:
1. Ingest clinical report document (PDF/text)
2. Perform OCR & confidence check
3. Normalize Hindi/Hinglish language input
4. Store in Qdrant hybrid RAG with patient isolation
5. Query patient timeline & chat with local medical LLM (Lingshu-I-8B)
6. Generate doctor case sheet with citations and safety disclaimer
"""

import sys
import requests
import json
from pathlib import Path

BASE_URL = "http://127.0.0.1:8110"

def test_full_e2e_pipeline():
    print("=== Step 1: Health Check ===")
    r = requests.get(f"{BASE_URL}/health")
    assert r.status_code == 200, f"Health check failed: {r.text}"
    health = r.json()
    print("Health Status:", health["status"])
    assert health["status"] in ["ok", "degraded"], f"Unexpected status: {health}"

    patient_id = "patient_e2e_99"
    
    print("\n=== Step 2: Document Ingestion & Extraction ===")
    sample_clinical_text = """
    PATIENT HEALTH RECORD
    Patient Name: Ramesh Sharma
    Age: 45 | Gender: Male
    Date: 2026-08-31
    
    Chief Complaints:
    Patient reports severe abdominal pain in lower right quadrant (pet me dard) for 2 days.
    High fever (tez bukhar) reaching 102F with nausea and loss of appetite.
    
    Past Medical History:
    Diagnosed with Type 2 Diabetes Mellitus in 2022.
    Currently taking Metformin 500mg BD.
    No known drug allergies.
    
    Vitals:
    BP: 130/84 mmHg, HR: 98 bpm, Temp: 101.8 F, SpO2: 97%
    """
    
    doc_path = Path("/tmp/sample_clinical_report.txt")
    doc_path.write_text(sample_clinical_text)
    
    with open(doc_path, "rb") as f:
        resp = requests.post(
            f"{BASE_URL}/documents/ingest",
            data={"patient_id": patient_id},
            files={"file": ("sample_clinical_report.txt", f, "text/plain")}
        )
    assert resp.status_code == 200, f"Ingest failed: {resp.text}"
    ingest_res = resp.json()
    print("Ingest Result:", json.dumps(ingest_res, indent=2))
    assert ingest_res["indexed"] > 0
    
    print("\n=== Step 3: Fetch Patient State ===")
    resp = requests.get(f"{BASE_URL}/patients/{patient_id}/state")
    assert resp.status_code == 200
    state = resp.json()
    print(f"Patient State ({patient_id}):", json.dumps(state, indent=2))
    assert len(state["evidence_ids"]) > 0

    print("\n=== Step 4: Patient Chat Query (Language Normalization + RAG + Local Medical LLM) ===")
    chat_payload = {
        "message": "Mujhe bahut tez pet me dard aur bukhar hai, mujhe kya karna chahiye?"
    }
    resp = requests.post(f"{BASE_URL}/patients/{patient_id}/chat", data=chat_payload)
    assert resp.status_code == 200, f"Chat failed: {resp.text}"
    chat_res = resp.json()
    print("Patient Chat Response:", json.dumps(chat_res, indent=2))
    chat_text = chat_res["choices"][0]["message"]["content"]
    assert len(chat_text) > 0

    print("\n=== Step 5: Doctor Case Sheet Generation (Evidence Grounding + Citations) ===")
    resp = requests.post(f"{BASE_URL}/patients/{patient_id}/case-sheet")
    assert resp.status_code == 200, f"Case sheet failed: {resp.text}"
    casesheet = resp.json()
    print("Doctor Case Sheet Output:\n", json.dumps(casesheet, indent=2))
    assert "patient_summary" in casesheet
    assert "citations" in casesheet
    
    print("\n=== E2E Pipeline Completed Successfully! ===")

if __name__ == "__main__":
    test_full_e2e_pipeline()
