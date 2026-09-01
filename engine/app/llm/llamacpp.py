from __future__ import annotations
import httpx
from typing import Any, Dict, List, Optional

class LlamaCppClient:
    def __init__(self, base_url: str, model: str, fallback_url: Optional[str] = None, fallback_model: Optional[str] = None):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.fallback_url = fallback_url.rstrip("/") if fallback_url else None
        self.fallback_model = fallback_model

    async def is_available(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                r = await client.get(f"{self.base_url}/models")
                return r.status_code == 200
        except Exception:
            return False

    async def health_check(self) -> Dict[str, Any]:
        available = await self.is_available()
        if available:
            return {"status": "online", "base_url": self.base_url, "model": self.model}
        if self.fallback_url:
            try:
                async with httpx.AsyncClient(timeout=3.0) as client:
                    r = await client.get(f"{self.fallback_url}/models")
                    if r.status_code == 200:
                        return {"status": "fallback_online", "base_url": self.fallback_url, "model": self.fallback_model}
            except Exception:
                pass
        return {"status": "offline", "base_url": self.base_url, "model": self.model, "error": "LLAMA_SERVER_UNAVAILABLE"}

    async def chat(self, messages: List[Dict[str, str]], *, temperature: float = 0.1, max_tokens: int = 900, stream: bool = False) -> Dict[str, Any]:
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": stream,
        }
        
        target_url = self.base_url
        target_model = self.model

        try:
            async with httpx.AsyncClient(timeout=180.0) as client:
                r = await client.post(f"{target_url}/chat/completions", json=payload)
                r.raise_for_status()
                return r.json()
        except Exception as primary_exc:
            if self.fallback_url:
                try:
                    payload["model"] = self.fallback_model or self.model
                    async with httpx.AsyncClient(timeout=180.0) as client:
                        r = await client.post(f"{self.fallback_url}/chat/completions", json=payload)
                        r.raise_for_status()
                        res = r.json()
                        res["fallback_used"] = True
                        return res
                except Exception:
                    pass
            raise RuntimeError(
                f"MODEL_UNAVAILABLE: Primary llama-server at {self.base_url} ({self.model}) is offline or unreachable. "
                f"Details: {primary_exc}"
            )


