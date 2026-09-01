#!/usr/bin/env python3
"""
PS47 Medical Engine — Cross-Platform Universal Model Downloader
Works identically on Windows (PowerShell/CMD), Linux (Bash), and macOS.
"""

import sys
from pathlib import Path
from huggingface_hub import hf_hub_download

def main():
    root_dir = Path(__file__).resolve().parent.parent
    models_dir = root_dir / "data" / "models"
    
    lingshu_dir = models_dir / "lingshu-i-8b"
    paddle_dir = models_dir / "paddleocr-vl-0.9b"
    
    lingshu_dir.mkdir(parents=True, exist_ok=True)
    paddle_dir.mkdir(parents=True, exist_ok=True)

    print("=" * 80)
    print("🚀 PS47 MEDICAL ENGINE — UNIVERSAL CROSS-PLATFORM MODEL DOWNLOADER")
    print("=" * 80)

    # 1. Download Lingshu-I-8B Medical LLM GGUF
    print("\n[1/3] Downloading Lingshu-I-8B Medical LLM (Q4_K_M.gguf)...")
    hf_hub_download(
        repo_id="Lingshu-AI/Lingshu-I-8B-GGUF",
        filename="Lingshu-I-8B-Q4_K_M.gguf",
        local_dir=str(lingshu_dir)
    )
    print("  └─> Saved to:", lingshu_dir / "Lingshu-I-8B-Q4_K_M.gguf")

    # 2. Download PaddleOCR-VL Vision VLM GGUF & MMProj
    print("\n[2/3] Downloading PaddleOCR-VL-0.9B Vision Model & Projection...")
    hf_hub_download(
        repo_id="PaddlePaddle/PaddleOCR-VL-0.9B-GGUF",
        filename="PaddleOCR-VL-0.9B-GGUF.gguf",
        local_dir=str(paddle_dir)
    )
    hf_hub_download(
        repo_id="PaddlePaddle/PaddleOCR-VL-0.9B-GGUF",
        filename="PaddleOCR-VL-0.9B-GGUF-mmproj.gguf",
        local_dir=str(paddle_dir)
    )
    print("  └─> Saved to:", paddle_dir)

    # 3. Pre-cache HuggingFace Vision, NMT & Embedding models
    print("\n[3/3] Pre-caching HuggingFace Vision, NMT & Embedding models...")
    try:
        from transformers import TrOCRProcessor, VisionEncoderDecoderModel
        TrOCRProcessor.from_pretrained('microsoft/trocr-base-handwritten')
        VisionEncoderDecoderModel.from_pretrained('microsoft/trocr-base-handwritten')

        from sentence_transformers import SentenceTransformer, CrossEncoder
        SentenceTransformer('BAAI/bge-small-en-v1.5')
        CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2')
        print("  └─> All HuggingFace encoders cached successfully!")
    except Exception as e:
        print(f"  └─> Warning caching encoders: {e}")

    print("\n" + "=" * 80)
    print("✨ ALL MODEL ARTIFACTS DOWNLOADED & PREPARED SUCCESSFULLY!")
    print("=" * 80)

if __name__ == "__main__":
    main()
