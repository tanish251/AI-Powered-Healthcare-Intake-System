from __future__ import annotations
from pathlib import Path
import json, re
from typing import Any, Dict, List

from config import settings
from app.document.processor import DocumentProcessor, SourceSpan
from app.document.llamacpp_ocr import LlamaCppOCR
from app.document.trocr import TrOCRHandwriting
from app.language.normalize import LanguageNormalizer
from app.patient.state import PatientStateStore
from app.rag.hybrid import HybridRAG, Evidence
from app.llm.llamacpp import LlamaCppClient
from app.web.search import SearXNGClient, WebEvidence
from app.safety.policy import PATIENT_SYSTEM, DOCTOR_SYSTEM

class PS47Engine:
    def __init__(self):
        from qdrant_client import QdrantClient
        self.ocr = LlamaCppOCR(settings.ocr_llm_base_url, settings.ocr_model) if settings.ocr_enabled else None
        self.handwriting = TrOCRHandwriting(device="cpu")
        self.docs = DocumentProcessor(settings.data_dir, self.ocr, self.handwriting)
        self.lang = LanguageNormalizer()
        self.state = PatientStateStore(settings.data_dir)
        
        qdrant_db_path = settings.data_dir / "qdrant_db"
        qdrant_db_path.mkdir(parents=True, exist_ok=True)
        try:
            client = QdrantClient(url=settings.qdrant_url, timeout=2.0)
            client.get_collections()
            self.qdrant = client
        except Exception:
            self.qdrant = QdrantClient(path=str(qdrant_db_path))

        self.rag = HybridRAG(
            self.qdrant,
            settings.embedding_model,
            settings.patient_collection,
            settings.medical_collection,
            settings.reranker_model
        )
        self.llm = LlamaCppClient(
            settings.medical_llm_base_url,
            settings.medical_model,
            settings.medical_fallback_base_url,
            settings.medical_fallback_model
        )
        self.web = SearXNGClient(settings.searxng_url)

    async def health_check(self) -> Dict[str, Any]:
        llm_health = await self.llm.health_check()
        ocr_health = await self.ocr.health_check() if self.ocr else {"status": "disabled"}
        trocr_health = self.handwriting.health_check()
        indic_health = self.lang.health_check()
        qdrant_health = self.rag.health_check()
        web_health = await self.web.health_check()

        all_ok = (
            llm_health.get("status") in ["online", "fallback_online"] and
            qdrant_health.get("status") in ["online", "degraded"]
        )

        return {
            "engine": "ps47",
            "status": "ok" if all_ok else "degraded",
            "medical_llm": llm_health,
            "ocr": ocr_health,
            "trocr": trocr_health,
            "indictrans2": indic_health,
            "qdrant": qdrant_health,
            "searxng": web_health,
        }

    def _chunks(self, span: SourceSpan, chunk_size: int = 1200) -> List[str]:
        norm = self.lang.normalize(span.text)
        text = self.docs.normalize(norm.normalized_english)
        if not text:
            return []
        parts = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
        if not parts:
            parts = [text]
        out = []
        for part in parts:
            for start in range(0, len(part), chunk_size):
                out.append(part[start:start + chunk_size])
        return out

    def _evidence_from_spans(self, patient_id: str, spans: List[SourceSpan]) -> List[Evidence]:
        evidence = []
        for span in spans:
            for i, chunk in enumerate(self._chunks(span)):
                evidence.append(Evidence(
                    evidence_id=f"EVID-{patient_id[:8]}-{span.document_id[:8]}-p{span.page}-c{i+1}",
                    text=chunk,
                    source_type="patient_document",
                    source=span.source_path or span.document_id,
                    page=span.page,
                    region=span.region,
                    status=span.status,
                    candidates=span.candidates,
                    agreement=span.agreement,
                    metadata={
                        "ocr_confidence": span.confidence,
                        "patient_id": patient_id,
                        "document_id": span.document_id,
                        "ocr_engine": span.ocr_engine,
                        "status": span.status,
                        "candidates": span.candidates,
                        "agreement": span.agreement
                    },
                ))
        return evidence

    async def ingest_document(self, patient_id: str, path: str) -> Dict[str, Any]:
        import time
        t0 = time.perf_counter()
        spans = await self.docs.process_async(path, patient_id=patient_id)
        ocr_ms = round((time.perf_counter() - t0) * 1000, 2)
        
        self.docs.persist_manifest(patient_id, spans)
        evidence = self._evidence_from_spans(patient_id, spans)
        self.rag.index(settings.patient_collection, evidence)
        self.state.merge(patient_id, {"evidence_ids": [e.evidence_id for e in evidence]})
        
        return {
            "patient_id": patient_id,
            "document_id": spans[0].document_id if spans else None,
            "pages": len(spans),
            "indexed": len(evidence),
            "status": spans[0].status if spans else "VERIFIED",
            "ocr_ms": ocr_ms
        }

    def get_patient_state(self, patient_id: str):
        return self.state.get(patient_id)

    async def retrieve_patient(self, patient_id: str, query: str) -> List[Evidence]:
        res = self.rag.search(query, settings.patient_collection, settings.top_k, patient_id=patient_id)
        # Filter out UNREADABLE evidence from entering LLM context
        return [e for e in (res or []) if e.status != "UNREADABLE"]

    async def retrieve_medical(self, query: str) -> List[Evidence]:
        res = self.rag.search(query, settings.medical_collection, settings.top_k)
        return [e for e in (res or []) if e.status != "UNREADABLE"]

    def validate_citations(self, content: str, valid_evidence_map: Dict[str, Any]) -> Dict[str, Any]:
        found_citations = re.findall(r"\[(EVID-[A-Za-z0-9_\-]+|WEB-[A-Za-z0-9_\-]+)\]", content)
        valid_citations = []
        invalid_citations = []
        uncertain_citations = []
        unreadable_citations = []

        for cite_id in set(found_citations):
            if cite_id in valid_evidence_map:
                ev = valid_evidence_map[cite_id]
                status = getattr(ev, 'status', 'VERIFIED')
                if status == "UNREADABLE":
                    unreadable_citations.append(cite_id)
                elif status == "UNCERTAIN":
                    uncertain_citations.append(cite_id)
                    valid_citations.append(cite_id)
                else:
                    valid_citations.append(cite_id)
            else:
                invalid_citations.append(cite_id)

        cleaned_content = content
        for bad_id in invalid_citations + unreadable_citations:
            cleaned_content = cleaned_content.replace(f"[{bad_id}]", "[UNSUPPORTED CITATION REMOVED]")

        return {
            "cleaned_content": cleaned_content,
            "valid_citations": valid_citations,
            "invalid_citations": invalid_citations,
            "uncertain_citations": uncertain_citations,
            "unreadable_citations": unreadable_citations,
        }

    async def _medical_chat(self, system: str, context: str, user: str, max_tokens: int = 1400):
        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": context + "\n\nUSER INPUT:\n" + user},
        ]
        return await self.llm.chat(messages, temperature=0.1, max_tokens=max_tokens)

    async def _extract_patient_facts(self, patient_id: str, evidence: List[Evidence]):
        if not evidence:
            return
        context = "\n\n".join(f"[{e.evidence_id}] {e.text} (Status: {e.status})" for e in evidence[:10])
        prompt = """
Extract only explicit patient facts from the supplied evidence. Return JSON with keys:
medical_history, medications, allergies, lab_results, conditions, timeline, summary.
Do not infer. Do not diagnose. Preserve UNCERTAIN status for ambiguous readings.
""".strip()
        try:
            result = await self._medical_chat(
                "Extract structured patient facts. Never invent missing facts. Return JSON only.",
                context,
                prompt,
                max_tokens=1000,
            )
            text = result["choices"][0]["message"].get("content", "") if isinstance(result, dict) else ""
            start, end = text.find("{"), text.rfind("}")
            if start >= 0 and end > start:
                data = json.loads(text[start:end + 1])
                self.state.merge(patient_id, data)
        except Exception:
            return

    async def generate_case_sheet(self, patient_id: str):
        state = self.state.get(patient_id)
        evidence = await self.retrieve_patient(patient_id, "current symptoms medical history medications allergies laboratory findings previous conditions timeline")
        await self._extract_patient_facts(patient_id, evidence)
        state = self.state.get(patient_id)
        context = self._format_context(state, evidence)
        
        result = await self._medical_chat(
            DOCTOR_SYSTEM,
            context,
            "Generate the doctor-facing case sheet as valid JSON only with keys: patient_summary, current_complaints, relevant_history, medications, allergies, relevant_reports, symptom_timeline, possible_conditions_to_consider, risk_indicators, missing_information, immediate_supportive_guidance, red_flags, citations.",
            max_tokens=1800,
        )
        return self._normalize_llm_json(result)

    async def patient_chat(self, patient_id: str, message: str):
        import time
        t_start = time.perf_counter()
        state = self.state.get(patient_id)

        # 1. Query-specific retrieval
        history = (await self.retrieve_patient(patient_id, message)) or []
        medical = (await self.retrieve_medical(message)) or []
        
        all_evidence = history + medical
        evidence_map = {e.evidence_id: e for e in all_evidence}

        # 2. Evidence Sufficiency Evaluation
        suff_eval = self.rag.evaluate_evidence_sufficiency(all_evidence, message)
        needs_web = (
            not suff_eval["is_sufficient"] or
            any(k in message.lower() for k in ["latest", "current guideline", "today", "updated recommendation", "new guidance"])
        )

        web: List[WebEvidence] = []
        if needs_web:
            raw_web = await self.web.search(message, settings.web_top_k)
            for w in raw_web:
                fetched = await self.web.fetch_text(w)
                web.append(fetched)
                evidence_map[fetched.evidence_id] = fetched

        # 3. Explicit No-Evidence Handling
        if not all_evidence and not web:
            return {
                "choices": [{
                    "message": {
                        "content": (
                            "WHAT YOU CAN DO NOW\n"
                            "Insufficient reliable information in the available records or web sources to answer this question safely.\n\n"
                            "WHAT TO MONITOR\n"
                            "Monitor any persistent or worsening symptoms.\n\n"
                            "AVOID\n"
                            "Do not take unprescribed medications or make sudden treatment changes without medical advice.\n\n"
                            "GET URGENT HELP IF\n"
                            "You develop high fever, severe pain, difficulty breathing, or confusion.\n\n"
                            "WHEN NOT TO WAIT\n"
                            "Seek emergency medical evaluation if your symptoms rapidly escalate.\n\n"
                            "SOURCES\n"
                            "None available."
                        )
                    }
                }],
                "sufficiency": suff_eval,
                "citations": {"valid": [], "invalid": [], "uncertain": [], "unreadable": []}
            }

        # 4. Context Construction & LLM Call
        context = self._format_context(state, all_evidence, web)
        result = await self._medical_chat(
            PATIENT_SYSTEM,
            context,
            message,
            max_tokens=900,
        )

        content = result.get("choices", [{}])[0].get("message", {}).get("content", "") if isinstance(result, dict) else ""
        
        # 5. Citation Validation
        val_res = self.validate_citations(content, evidence_map)
        if isinstance(result, dict) and "choices" in result and result["choices"]:
            result["choices"][0]["message"]["content"] = val_res["cleaned_content"]
            result["citations"] = val_res
            result["sufficiency"] = suff_eval

        return result

    def _normalize_llm_json(self, result):
        content = result.get("choices", [{}])[0].get("message", {}).get("content", "") if isinstance(result, dict) else ""
        try:
            start, end = content.find("{"), content.rfind("}")
            if start >= 0 and end > start:
                data = json.loads(content[start:end + 1])
                if "citations" not in data:
                    data["citations"] = []
                return data
        except Exception:
            pass
        return {"raw_output": content, "citations": []}

    def _format_context(self, state, evidence, web=None):
        parts = ["PATIENT STATE:\n" + json.dumps(state.__dict__, ensure_ascii=False, indent=2)]
        if evidence:
            parts.append("PATIENT/MEDICAL EVIDENCE:")
            for e in evidence:
                status_tag = f" [Status: {e.status}]" if hasattr(e, 'status') and e.status != "VERIFIED" else ""
                parts.append(f"[{e.evidence_id}]{status_tag} {e.text}\nSource: {e.source} | Page: {e.page} | Region: {e.region}")
        if web:
            parts.append("WEB EVIDENCE:")
            for w in web:
                text = getattr(w, 'extracted_text', '') or getattr(w, 'snippet', '')
                parts.append(f"[{w.evidence_id}] {w.title}\nURL: {w.url}\n{text[:4000]}")
        return "\n\n".join(parts)

