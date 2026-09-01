"""
PS47 Local Medical Engine Integration Test Suite
Validates end-to-end functionality across document processing, language normalization,
hybrid RAG with patient isolation, and LLM case sheet generation.
"""

import os
import sys
import pytest
from pathlib import Path

# Add engine directory to sys.path
engine_dir = Path(__file__).resolve().parent.parent / "engine"
sys.path.insert(0, str(engine_dir))

from config import settings
from app.document.processor import DocumentProcessor, SourceSpan
from app.language.normalize import LanguageNormalizer
from app.rag.hybrid import HybridRAG, Evidence
from app.llm.llamacpp import LlamaCppClient
from app.pipelines.engine import PS47Engine
from app.web.search import SearXNGClient

def test_language_normalization():
    normalizer = LanguageNormalizer()
    
    # Devanagari script detection
    hin_res = normalizer.normalize("मुझे बहुत तेज पेट दर्द और बुखार है")
    assert hin_res.source_language == "hin_Deva"
    assert hin_res.original == "मुझे बहुत तेज पेट दर्द और बुखार है"
    
    # Transliterated Hinglish glossary test
    eng_res = normalizer.normalize("Patient has pet dard and bukhar since morning")
    assert "abdominal pain" in eng_res.normalized_english
    assert "fever" in eng_res.normalized_english

def test_document_processor_confidence_and_spans():
    proc = DocumentProcessor(data_dir=settings.data_dir)
    
    conf_high = proc.compute_confidence("Patient presented with fever and shortness of breath.", is_ocr=False)
    assert conf_high > 0.8
    
    conf_low = proc.compute_confidence("??? !!! ###", is_ocr=True)
    assert conf_low < 0.5
    
    filename = proc.sanitize_filename("../../../etc/passwd")
    assert "passwd" in filename
    assert ".." not in filename

def test_hybrid_rag_patient_isolation():
    from qdrant_client import QdrantClient
    
    client = QdrantClient(location=":memory:")
    rag = HybridRAG(client, settings.embedding_model, "test_patient_col", "test_med_col")
    
    ev_p1 = Evidence(
        evidence_id="EVID-P1-001",
        text="Patient A has severe type 2 diabetes treated with Metformin 500mg.",
        source_type="patient_document",
        source="doc1.pdf",
        page=1,
        region=[10.0, 10.0, 200.0, 50.0],
        metadata={"patient_id": "patient_A"}
    )
    
    ev_p2 = Evidence(
        evidence_id="EVID-P2-001",
        text="Patient B has acute appendicitis with localized lower right quadrant pain.",
        source_type="patient_document",
        source="doc2.pdf",
        page=1,
        region=[15.0, 15.0, 180.0, 40.0],
        metadata={"patient_id": "patient_B"}
    )
    
    rag.index("test_patient_col", [ev_p1, ev_p2])
    
    # Retrieve specifically for patient_A
    hits_a = rag.search("diabetes metformin", "test_patient_col", top_k=5, patient_id="patient_A")
    assert len(hits_a) > 0
    for hit in hits_a:
        assert hit.metadata["patient_id"] == "patient_A"
        assert "appendicitis" not in hit.text
        
    # Retrieve specifically for patient_B
    hits_b = rag.search("appendicitis pain", "test_patient_col", top_k=5, patient_id="patient_B")
    assert len(hits_b) > 0
    for hit in hits_b:
        assert hit.metadata["patient_id"] == "patient_B"
        assert "diabetes" not in hit.text

import asyncio

def test_llm_client_offline_explicit_failure():
    async def _inner():
        # Attempting to call non-existent server port should raise RuntimeError, NOT return static fake JSON
        client = LlamaCppClient(base_url="http://127.0.0.1:59999", model="non_existent_model")
        with pytest.raises(RuntimeError) as exc_info:
            await client.chat([{"role": "user", "content": "hello"}])
        err = str(exc_info.value)
        assert "MODEL_UNAVAILABLE" in err or "LLM_SERVICE_UNAVAILABLE" in err
    asyncio.run(_inner())


def test_ocr_consensus_and_status_categorization():
    proc = DocumentProcessor(data_dir=settings.data_dir)
    
    # 1. Similarity computation test
    sim = proc.compute_similarity("Hb 11.5 g/dL", "hb 11.5 g/dl")
    assert sim > 0.90
    
    sim_diff = proc.compute_similarity("Hb 11.5 g/dL", "Hb 10.2 g/dL")
    assert sim_diff < 0.85

    # 2. SourceSpan default status and candidates
    span_verified = SourceSpan(
        document_id="doc1",
        patient_id="p1",
        page=1,
        text="Clear blood test result: Hb 12.0",
        confidence=0.95,
        status="VERIFIED",
        candidates=["Clear blood test result: Hb 12.0"],
        agreement=1.0
    )
    assert span_verified.status == "VERIFIED"
    assert span_verified.agreement == 1.0

    span_uncertain = SourceSpan(
        document_id="doc2",
        patient_id="p1",
        page=1,
        text="Metf... 500mg [UNCLEAR]",
        confidence=0.45,
        status="UNCERTAIN",
        candidates=["Metf... 500mg", "Metformin 500mg"],
        agreement=0.55
    )
    assert span_uncertain.status == "UNCERTAIN"
    assert len(span_uncertain.candidates) == 2

def test_citation_validation_and_unsupported_rejection():
    async def _inner():
        engine = PS47Engine()
        valid_ev = Evidence(
            evidence_id="EVID-P1-001",
            text="Patient reports allergy to Penicillin.",
            source_type="patient_document",
            source="doc1.pdf",
            status="VERIFIED"
        )
        uncertain_ev = Evidence(
            evidence_id="EVID-P1-002",
            text="Hb value 10.2 g/dL [UNCLEAR]",
            source_type="patient_document",
            source="doc2.pdf",
            status="UNCERTAIN"
        )
        unreadable_ev = Evidence(
            evidence_id="EVID-P1-003",
            text="[UNREADABLE DOCUMENT]",
            source_type="patient_document",
            source="doc3.pdf",
            status="UNREADABLE"
        )

        evidence_map = {
            "EVID-P1-001": valid_ev,
            "EVID-P1-002": uncertain_ev,
            "EVID-P1-003": unreadable_ev,
        }

        # Content referencing valid, uncertain, unreadable, and invalid fake citations
        sample_text = "Patient allergic to penicillin [EVID-P1-001]. Hb is 10.2 [EVID-P1-002]. Unreadable note [EVID-P1-003]. Fake claim [EVID-FAKE-999]."
        val_res = engine.validate_citations(sample_text, evidence_map)

        assert "EVID-P1-001" in val_res["valid_citations"]
        assert "EVID-P1-002" in val_res["uncertain_citations"]
        assert "EVID-P1-003" in val_res["unreadable_citations"]
        assert "EVID-FAKE-999" in val_res["invalid_citations"]
        
        # Ensure invalid and unreadable citations were removed from cleaned text
        assert "[EVID-FAKE-999]" not in val_res["cleaned_content"]
        assert "[EVID-P1-003]" not in val_res["cleaned_content"]
        assert "[UNSUPPORTED CITATION REMOVED]" in val_res["cleaned_content"]

    asyncio.run(_inner())

def test_evidence_sufficiency_evaluation():
    from qdrant_client import QdrantClient
    client = QdrantClient(location=":memory:")
    rag = HybridRAG(client, settings.embedding_model, "test_patient_col", "test_med_col")
    
    # 1. Sufficient evidence
    ev_rich = [
        Evidence(
            evidence_id="EVID-001",
            text="Patient Sunil has high fever of 102F and headache starting yesterday.",
            source_type="patient_document",
            source="report.txt",
            score=0.85
        )
    ]
    eval_rich = rag.evaluate_evidence_sufficiency(ev_rich, "fever and headache treatment")
    assert eval_rich["is_sufficient"] is True
    assert eval_rich["status"] == "SUFFICIENT_LOCAL_EVIDENCE"

    # 2. Empty/Insufficient evidence
    eval_empty = rag.evaluate_evidence_sufficiency([], "What is my cholesterol level?")
    assert eval_empty["is_sufficient"] is False
    assert eval_empty["status"] == "INSUFFICIENT_LOCAL_EVIDENCE"

if __name__ == "__main__":
    pytest.main([__file__, "-v"])

