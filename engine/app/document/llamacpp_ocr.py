from __future__ import annotations
import base64
from pathlib import Path
import httpx
from typing import Dict, Any


class LlamaCppOCR:
    """OCR adapter for PaddleOCR-VL 0.9B GGUF served by llama.cpp."""
    def __init__(self, base_url: str, model: str):
        self.base_url = base_url.rstrip("/")
        self.model = model

    async def is_available(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                r = await client.get(f"{self.base_url}/models")
                return r.status_code == 200
        except Exception:
            return False

    async def health_check(self) -> Dict[str, Any]:
        available = await self.is_available()
        return {
            "status": "online" if available else "offline",
            "base_url": self.base_url,
            "model": self.model
        }

    @staticmethod
    def _data_uri(path: Path) -> str:
        mime = "image/jpeg"
        if path.suffix.lower() == ".png":
            mime = "image/png"
        elif path.suffix.lower() == ".webp":
            mime = "image/webp"
        elif path.suffix.lower() == ".pdf":
            raise ValueError("PDF pages must be rendered to images before VLM OCR")
        raw = base64.b64encode(path.read_bytes()).decode()
        return f"data:{mime};base64,{raw}"

    async def image_to_text(self, path: str) -> str:
        p = Path(path)
        if not p.exists():
            raise FileNotFoundError(f"Image file not found: {path}")

        content = [
            {"type": "text", "text": "Extract all visible text faithfully. Preserve reading order. Return only extracted text; do not summarize, interpret, or invent. Preserve uncertain handwriting verbatim when readable and mark unreadable segments as [UNCLEAR]."},
            {"type": "image_url", "image_url": {"url": self._data_uri(p)}}
        ]
        payload = {
            "model": self.model,
            "messages": [{"role": "user", "content": content}],
            "temperature": 0,
            "max_tokens": 4096,
        }
        try:
            async with httpx.AsyncClient(timeout=180.0) as client:
                r = await client.post(f"{self.base_url}/chat/completions", json=payload)
                r.raise_for_status()
                data = r.json()
            return data["choices"][0]["message"].get("content", "")
        except Exception as exc:
            raise RuntimeError(
                f"OCR_SERVICE_UNAVAILABLE: PaddleOCR-VL 0.9B server at {self.base_url} is unreachable. Details: {exc}"
            )

