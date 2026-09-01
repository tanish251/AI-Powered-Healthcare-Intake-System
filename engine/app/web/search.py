from __future__ import annotations
import httpx
from dataclasses import dataclass
from urllib.parse import urlparse
from bs4 import BeautifulSoup

@dataclass
class WebEvidence:
    evidence_id: str
    title: str
    url: str
    snippet: str
    score: float = 0.0
    source_type: str = "web"
    extracted_text: str = ""

class SearXNGClient:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")

    async def is_available(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                r = await client.get(f"{self.base_url}/")
                return r.status_code < 500
        except Exception:
            return False

    async def health_check(self) -> dict:
        available = await self.is_available()
        return {
            "status": "online" if available else "offline",
            "base_url": self.base_url
        }

    async def search(self, query: str, limit: int = 5) -> list[WebEvidence]:
        params = {"q": query, "format": "json", "language": "en"}
        try:
            async with httpx.AsyncClient(timeout=12, follow_redirects=True) as client:
                r = await client.get(f"{self.base_url}/search", params=params)
                r.raise_for_status()
                data = r.json()
            return [
                WebEvidence(
                    evidence_id=f"WEB-{i+1}",
                    title=item.get("title", ""),
                    url=item.get("url", ""),
                    snippet=item.get("content", ""),
                    score=float(item.get("score", 0.0) or 0.0),
                )
                for i, item in enumerate(data.get("results", [])[:limit])
            ]
        except Exception:
            return []

    async def fetch_text(self, item: WebEvidence) -> WebEvidence:
        try:
            async with httpx.AsyncClient(timeout=12, follow_redirects=True, headers={"User-Agent": "PS47-Engine/0.1"}) as client:
                r = await client.get(item.url)
                r.raise_for_status()
            soup = BeautifulSoup(r.text, "html.parser")
            for tag in soup(["script", "style", "noscript", "nav", "footer"]):
                tag.decompose()
            text = "\n".join(x.strip() for x in soup.stripped_strings)
            item.extracted_text = text[:12000]
        except Exception:
            item.extracted_text = item.snippet
        return item

