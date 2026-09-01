from __future__ import annotations
from dataclasses import dataclass, field, asdict
from pathlib import Path
import json
from typing import Any

@dataclass
class PatientState:
    patient_id: str
    current_symptoms: list[str] = field(default_factory=list)
    medical_history: list[str] = field(default_factory=list)
    medications: list[str] = field(default_factory=list)
    allergies: list[str] = field(default_factory=list)
    lab_results: list[str] = field(default_factory=list)
    conditions: list[str] = field(default_factory=list)
    timeline: list[dict[str, Any]] = field(default_factory=list)
    summary: str = ""
    evidence_ids: list[str] = field(default_factory=list)

class PatientStateStore:
    def __init__(self, root: Path):
        self.root = root / "patients"
        self.root.mkdir(parents=True, exist_ok=True)

    def path(self, patient_id: str) -> Path:
        p = self.root / patient_id
        p.mkdir(parents=True, exist_ok=True)
        return p / "state.json"

    def get(self, patient_id: str) -> PatientState:
        p = self.path(patient_id)
        if not p.exists():
            return PatientState(patient_id=patient_id)
        return PatientState(**json.loads(p.read_text(encoding="utf-8")))

    def save(self, state: PatientState) -> None:
        self.path(state.patient_id).write_text(
            json.dumps(asdict(state), ensure_ascii=False, indent=2), encoding="utf-8"
        )

    def merge(self, patient_id: str, patch: dict[str, Any]) -> PatientState:
        state = self.get(patient_id)
        for key, value in patch.items():
            if key not in state.__dataclass_fields__:
                continue
            if isinstance(getattr(state, key), list) and isinstance(value, list):
                merged = list(dict.fromkeys(getattr(state, key) + value))
                setattr(state, key, merged)
            elif value not in (None, ""):
                setattr(state, key, value)
        self.save(state)
        return state
