from __future__ import annotations
from dataclasses import dataclass, asdict, field
from pathlib import Path
import hashlib, json, re, asyncio
from typing import List, Optional, Any, Dict

try:
    import fitz  # PyMuPDF
except Exception:
    fitz = None

from difflib import SequenceMatcher

@dataclass
class SourceSpan:
    document_id: str
    patient_id: str
    page: int
    text: str
    confidence: float = 1.0
    region: Optional[List[float]] = None  # [x_min, y_min, x_max, y_max]
    source_path: Optional[str] = None
    source_type: str = "document"
    ocr_engine: str = "pymupdf"
    status: str = "VERIFIED"  # "VERIFIED", "UNCERTAIN", "UNREADABLE"
    candidates: List[str] = field(default_factory=list)
    agreement: float = 1.0

class DocumentProcessor:
    def __init__(self, data_dir: Path, ocr=None, handwriting=None):
        self.data_dir = data_dir
        self.ocr = ocr
        self.handwriting = handwriting

    @staticmethod
    def sanitize_filename(filename: str) -> str:
        safe = Path(filename).name
        safe = re.sub(r"[^\w\.-]", "_", safe)
        return safe or "uploaded_document.bin"

    @staticmethod
    def document_id(path: str) -> str:
        p = Path(path)
        stat = p.stat()
        raw = f"{p.resolve()}:{stat.st_size}:{stat.st_mtime_ns}".encode()
        return hashlib.sha256(raw).hexdigest()[:20]

    @staticmethod
    def compute_confidence(text: str, is_ocr: bool = False) -> float:
        if not text or not text.strip():
            return 0.0
        words = text.split()
        if not words:
            return 0.0
        alphanumeric = sum(1 for w in words if re.search(r"[a-zA-Z0-9]", w))
        ratio = alphanumeric / len(words)
        base = 0.85 if is_ocr else 0.98
        return round(min(1.0, max(0.1, base * ratio)), 3)

    def _extract_pdf_sync(self, path: Path, patient_id: str) -> List[SourceSpan]:
        if fitz is None:
            raise RuntimeError("PyMuPDF is required for PDF processing")
        doc_id = self.document_id(str(path))
        spans: List[SourceSpan] = []
        with fitz.open(path) as pdf:
            for idx, page in enumerate(pdf, start=1):
                text = page.get_text("text").strip()
                rect = page.rect
                bbox = [float(rect.x0), float(rect.y0), float(rect.x1), float(rect.y1)]
                conf = self.compute_confidence(text, is_ocr=False) if text else 0.0
                spans.append(SourceSpan(
                    document_id=doc_id,
                    patient_id=patient_id,
                    page=idx,
                    text=text,
                    confidence=conf,
                    region=bbox,
                    source_path=str(path),
                    source_type="pdf",
                    ocr_engine="pymupdf"
                ))
        return spans

    def _render_page_sync(self, pdf_path: Path, page_num: int) -> Path:
        out_dir = self.data_dir / "rendered"
        out_dir.mkdir(parents=True, exist_ok=True)
        out = out_dir / f"{self.document_id(str(pdf_path))}_p{page_num}.png"
        if not out.exists() and fitz is not None:
            with fitz.open(pdf_path) as pdf:
                page = pdf[page_num - 1]
                pix = page.get_pixmap(matrix=fitz.Matrix(1.8, 1.8), alpha=False)
                pix.save(str(out))
        return out

    @staticmethod
    def compute_similarity(s1: str, s2: str) -> float:
        if not s1 or not s2:
            return 0.0
        return SequenceMatcher(None, s1.strip().lower(), s2.strip().lower()).ratio()

    async def _evaluate_ocr_consensus(self, img_path: str) -> Dict[str, Any]:
        candidates = []
        engines = []
        
        # Pass 1: Primary VLM OCR
        if self.ocr:
            pass1 = await self.ocr.image_to_text(img_path)
            if pass1 and pass1.strip():
                candidates.append(pass1.strip())
                engines.append("paddleocr-vl-0.9b")

        # Pass 2: Secondary pass if Pass 1 is uncertain or contains [UNCLEAR]
        conf1 = self.compute_confidence(candidates[0], is_ocr=True) if candidates else 0.0
        if self.ocr and (not candidates or conf1 < 0.6 or "[UNCLEAR]" in candidates[0]):
            pass2 = await self.ocr.image_to_text(img_path)
            if pass2 and pass2.strip() and pass2.strip() not in candidates:
                candidates.append(pass2.strip())
                engines.append("paddleocr-vl-0.9b-pass2")

        # Pass 3: TrOCR handwriting pass if still uncertain or handwriting suspected
        if self.handwriting and (not candidates or conf1 < 0.4 or "[UNCLEAR]" in candidates[0] or "handwriting" in candidates[0].lower()):
            pass3 = await asyncio.to_thread(self.handwriting.transcribe, img_path)
            if pass3 and pass3 != "[UNCLEAR_HANDWRITING]" and pass3.strip() not in candidates:
                candidates.append(f"[Handwriting: {pass3.strip()}]")
                engines.append("trocr-base-handwritten")

        if not candidates:
            return {
                "text": "[UNREADABLE DOCUMENT]",
                "confidence": 0.0,
                "status": "UNREADABLE",
                "candidates": [],
                "agreement": 0.0,
                "engine": "none"
            }

        # Calculate agreement across candidate passes
        if len(candidates) == 1:
            agreement = 1.0
            final_text = candidates[0]
        else:
            sims = []
            for i in range(len(candidates)):
                for j in range(i + 1, len(candidates)):
                    sims.append(self.compute_similarity(candidates[i], candidates[j]))
            agreement = round(sum(sims) / len(sims), 3) if sims else 1.0
            # Merge text: primary candidate + additional distinct notes
            final_text = candidates[0]
            for extra in candidates[1:]:
                if extra not in final_text and extra.startswith("[Handwriting:"):
                    final_text += f"\n{extra}"

        final_conf = self.compute_confidence(final_text, is_ocr=True)
        engine_str = "+".join(set(engines))

        # Categorize status: VERIFIED, UNCERTAIN, UNREADABLE
        if final_conf >= 0.70 and agreement >= 0.70 and "[UNCLEAR]" not in final_text:
            status = "VERIFIED"
        elif final_conf < 0.25 or agreement < 0.35 or final_text == "[UNREADABLE DOCUMENT]":
            status = "UNREADABLE"
        else:
            status = "UNCERTAIN"

        return {
            "text": final_text,
            "confidence": final_conf,
            "status": status,
            "candidates": candidates,
            "agreement": agreement,
            "engine": engine_str
        }

    async def process_async(self, path: str, patient_id: str = "default") -> List[SourceSpan]:
        p = Path(path)
        if not p.exists():
            raise FileNotFoundError(path)

        if p.suffix.lower() in [".txt", ".text", ".md", ".json", ".csv"]:
            text = p.read_text(encoding="utf-8", errors="replace")
            doc_id = self.document_id(str(p))
            conf = self.compute_confidence(text, is_ocr=False)
            return [SourceSpan(
                document_id=doc_id,
                patient_id=patient_id,
                page=1,
                text=text,
                confidence=conf,
                region=[0.0, 0.0, 1000.0, 1000.0],
                source_path=str(p),
                source_type="text",
                ocr_engine="text_parser",
                status="VERIFIED",
                candidates=[text],
                agreement=1.0
            )]

        if p.suffix.lower() == ".pdf":
            spans = await asyncio.to_thread(self._extract_pdf_sync, p, patient_id)
            if self.ocr:
                for span in spans:
                    if not span.text or span.confidence < 0.5:
                        pix_path = await asyncio.to_thread(self._render_page_sync, p, span.page)
                        ocr_res = await self._evaluate_ocr_consensus(str(pix_path))
                        span.text = ocr_res["text"]
                        span.confidence = ocr_res["confidence"]
                        span.status = ocr_res["status"]
                        span.candidates = ocr_res["candidates"]
                        span.agreement = ocr_res["agreement"]
                        span.ocr_engine = ocr_res["engine"]
            return spans

        # Image processing
        doc_id = self.document_id(str(p))
        ocr_res = await self._evaluate_ocr_consensus(str(p))
        return [SourceSpan(
            document_id=doc_id,
            patient_id=patient_id,
            page=1,
            text=ocr_res["text"],
            confidence=ocr_res["confidence"],
            region=[0.0, 0.0, 1000.0, 1000.0],
            source_path=str(p),
            source_type="image",
            ocr_engine=ocr_res["engine"],
            status=ocr_res["status"],
            candidates=ocr_res["candidates"],
            agreement=ocr_res["agreement"]
        )]

    @staticmethod
    def normalize(text: str) -> str:
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()

    def persist_manifest(self, patient_id: str, spans: List[SourceSpan]) -> Path:
        target = self.data_dir / "patients" / patient_id
        target.mkdir(parents=True, exist_ok=True)
        manifest = target / "documents.jsonl"
        with manifest.open("a", encoding="utf-8") as f:
            for span in spans:
                f.write(json.dumps(asdict(span), ensure_ascii=False) + "\n")
        return manifest

