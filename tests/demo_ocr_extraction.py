import asyncio
import json
import os
import sys
import time
from pathlib import Path

# Add engine directory to python path
engine_dir = Path(__file__).resolve().parent.parent / "engine"
sys.path.insert(0, str(engine_dir))

from app.document.processor import DocumentProcessor
from app.document.llamacpp_ocr import LlamaCppOCR
from app.document.trocr import TrOCRHandwriting
from config import settings

async def main():
    print("=" * 80)
    print("PS47 MEDICAL ENGINE — OCR EXTRACTION DEMO ON SAMPLE REPORTS")
    print("=" * 80)

    sample_dir = Path(__file__).resolve().parent / "sample_reports"
    blood_report_path = sample_dir / "sample_blood_report.png"
    rx_report_path = sample_dir / "sample_prescription.png"

    # Initialize OCR components
    ocr_client = LlamaCppOCR(settings.ocr_llm_base_url, settings.ocr_model)
    trocr_client = TrOCRHandwriting(device="cpu")
    processor = DocumentProcessor(settings.data_dir, ocr_client, trocr_client)

    reports = [
        ("Laboratory Blood Report", blood_report_path, "PATIENT_BLOOD_TEST_001"),
        ("Medical Doctor Prescription", rx_report_path, "PATIENT_PRESCRIPTION_002")
    ]

    results_md = []
    results_md.append("# 🧪 PS47 Medical Engine — Live OCR Information Extraction Demo Results\n")
    results_md.append(f"**Execution Timestamp**: {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
    results_md.append("**OCR Architecture**: PaddleOCR-VL-0.9B Vision Language Model + TrOCR Multi-Pass Consensus\n")
    results_md.append("---\n")

    for title, file_path, patient_id in reports:
        print(f"\n[Processing Report]: {title} ({file_path.name})")
        start_time = time.time()
        
        # Process document through OCR Consensus Pipeline
        spans = await processor.process_async(file_path, patient_id)
        elapsed_ms = round((time.time() - start_time) * 1000, 2)

        print(f"Extraction Completed in {elapsed_ms} ms! Total Spans Extracted: {len(spans)}")

        results_md.append(f"## 📄 {title} (`{file_path.name}`)\n")
        results_md.append(f"- **Patient ID**: `{patient_id}`")
        results_md.append(f"- **OCR Processing Time**: `{elapsed_ms} ms`")
        results_md.append(f"- **Extracted Spans Count**: `{len(spans)}`\n")

        for i, span in enumerate(spans, 1):
            print(f"\n--- Extracted Text Span [{i}] ---")
            print(f"Document ID: {span.document_id}")
            print(f"Page: {span.page} | OCR Engine: {span.ocr_engine}")
            print(f"Confidence: {span.confidence} | Status: {span.status}")
            print(f"Text Content:\n{span.text}\n")

            results_md.append(f"### Extracted Text Span {i}\n")
            results_md.append("```text")
            results_md.append(span.text.strip())
            results_md.append("```\n")
            results_md.append(f"- **Confidence Score**: `{span.confidence}`")
            results_md.append(f"- **Consensus Status**: `{span.status}`")
            results_md.append(f"- **OCR Engine Used**: `{span.ocr_engine}`")
            results_md.append(f"- **Agreement Ratio**: `{span.agreement}`\n")
            
        results_md.append("---\n")

    output_md_path = Path(__file__).resolve().parent / "OCR_EXTRACTION_DEMO_RESULTS.md"
    output_md_path.write_text("\n".join(results_md))
    print(f"\n✅ Demo extraction completed! Results saved to: {output_md_path}")

if __name__ == "__main__":
    asyncio.run(main())
