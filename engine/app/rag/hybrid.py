from __future__ import annotations
from dataclasses import dataclass, asdict
from typing import Any, List, Optional, Dict
import hashlib
import re

try:
    from qdrant_client import models
except Exception:
    models = None

@dataclass
class Evidence:
    evidence_id: str
    text: str
    source_type: str
    source: str
    page: Optional[int] = None
    region: Optional[List[float]] = None
    score: float = 0.0
    status: str = "VERIFIED"  # "VERIFIED", "UNCERTAIN", "UNREADABLE"
    candidates: Optional[List[str]] = None
    agreement: float = 1.0
    metadata: Optional[Dict[str, Any]] = None

class HybridRAG:
    def __init__(self, client, embedding_model: str, patient_collection: str, medical_collection: str, reranker_model: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"):
        self.client = client
        self.patient_collection = patient_collection
        self.medical_collection = medical_collection
        self.embedding_model_name = embedding_model
        self.reranker_model_name = reranker_model
        self.embedder = None
        self.reranker = None
        # BM25 in-memory caches per collection: {collection: {"corpus": [text], "evidence": [Evidence], "bm25": BM25Okapi}}
        self._bm25_store: Dict[str, Dict[str, Any]] = {}

    def _load_embedder(self):
        if self.embedder is None:
            try:
                from sentence_transformers import SentenceTransformer
                self.embedder = SentenceTransformer(self.embedding_model_name)
            except Exception:
                import hashlib
                class HashEmbedder:
                    def encode(self, texts, normalize_embeddings=True):
                        res = []
                        for t in texts:
                            h = hashlib.sha256(t.encode()).digest()
                            vec = [float(b) / 255.0 for b in h[:64]]
                            res.append(vec)
                        return res
                self.embedder = HashEmbedder()
        return self.embedder

    def _load_reranker(self):
        if self.reranker is None:
            try:
                from sentence_transformers import CrossEncoder
                self.reranker = CrossEncoder(self.reranker_model_name)
            except Exception:
                self.reranker = None
        return self.reranker

    def _embed(self, texts: List[str]):
        vecs = self._load_embedder().encode(texts, normalize_embeddings=True)
        if hasattr(vecs, "tolist"):
            return vecs.tolist()
        return vecs

    def health_check(self) -> Dict[str, Any]:
        if self.client is None:
            return {"status": "offline", "error": "Qdrant client not initialized"}
        try:
            collections = [c.name for c in self.client.get_collections().collections]
            return {"status": "online", "collections": collections}
        except Exception as e:
            return {"status": "degraded", "error": str(e)}

    def ensure_collection(self, collection: str):
        if self.client is None or models is None:
            return
        try:
            self.client.get_collection(collection)
        except Exception:
            dim = len(self._embed(["dimension probe"])[0])
            self.client.create_collection(
                collection_name=collection,
                vectors_config=models.VectorParams(size=dim, distance=models.Distance.COSINE),
            )

    @staticmethod
    def _tokenize(text: str) -> List[str]:
        return [w for w in re.split(r"\W+", text.lower()) if len(w) > 1]

    def index(self, collection: str, evidence: List[Evidence]):
        if not evidence or self.client is None or models is None:
            return
        self.ensure_collection(collection)
        vectors = self._embed([e.text for e in evidence])
        points = []
        for i, e in enumerate(evidence):
            pid = int(hashlib.sha256(e.evidence_id.encode()).hexdigest()[:15], 16)
            points.append(models.PointStruct(id=pid, vector=vectors[i], payload=asdict(e)))
        self.client.upsert(collection_name=collection, points=points)

        # Update BM25 index
        try:
            from rank_bm25 import BM25Okapi
            if collection not in self._bm25_store:
                self._bm25_store[collection] = {"corpus": [], "evidence": [], "bm25": None}

            store = self._bm25_store[collection]
            for e in evidence:
                store["corpus"].append(self._tokenize(e.text))
                store["evidence"].append(e)

            if store["corpus"]:
                store["bm25"] = BM25Okapi(store["corpus"])
        except Exception:
            pass

    def evaluate_evidence_sufficiency(self, evidence_list: List[Evidence], query: str) -> Dict[str, Any]:
        if not evidence_list:
            return {"is_sufficient": False, "score": 0.0, "status": "INSUFFICIENT_LOCAL_EVIDENCE"}
        
        scores = [e.score for e in evidence_list]
        top_score = max(scores) if scores else 0.0
        top3_mean = sum(sorted(scores, reverse=True)[:3]) / min(3, len(scores)) if scores else 0.0

        q_words = set(self._tokenize(query))
        ev_words = set()
        for e in evidence_list[:3]:
            ev_words.update(self._tokenize(e.text))
        coverage = len(q_words.intersection(ev_words)) / max(1, len(q_words)) if q_words else 0.0

        suff_score = round(0.50 * top_score + 0.30 * top3_mean + 0.20 * coverage, 3)
        is_sufficient = suff_score >= 0.25

        return {
            "is_sufficient": is_sufficient,
            "score": suff_score,
            "status": "SUFFICIENT_LOCAL_EVIDENCE" if is_sufficient else "INSUFFICIENT_LOCAL_EVIDENCE"
        }

    def search(self, query: str, collection: str, top_k: int = 8, patient_id: Optional[str] = None) -> List[Evidence]:
        if self.client is None or models is None:
            return []

        dense_hits: Dict[str, float] = {}
        bm25_hits: Dict[str, float] = {}
        candidates: Dict[str, Evidence] = {}

        # 1. Dense retrieval with strict patient_id filtering
        try:
            self.ensure_collection(collection)
            qv = self._embed([query])[0]

            query_filter = None
            if patient_id:
                query_filter = models.Filter(
                    must=[
                        models.FieldCondition(
                            key="metadata.patient_id",
                            match=models.MatchValue(value=patient_id)
                        )
                    ]
                )

            hits = self.client.query_points(
                collection_name=collection,
                query=qv,
                query_filter=query_filter,
                limit=top_k * 2,
                with_payload=True
            ).points

            for h in hits:
                p = h.payload
                ev = Evidence(
                    evidence_id=p.get("evidence_id", ""),
                    text=p.get("text", ""),
                    source_type=p.get("source_type", ""),
                    source=p.get("source", ""),
                    page=p.get("page"),
                    region=p.get("region"),
                    score=float(h.score if hasattr(h, 'score') else 0.5),
                    status=p.get("status", "VERIFIED"),
                    candidates=p.get("candidates", []),
                    agreement=float(p.get("agreement", 1.0)),
                    metadata=p.get("metadata", {})
                )
                candidates[ev.evidence_id] = ev
                dense_hits[ev.evidence_id] = float(h.score if hasattr(h, 'score') else 0.5)
        except Exception:
            pass

        # 2. BM25 Sparse Retrieval
        store = self._bm25_store.get(collection)
        if store and store.get("bm25") and store.get("evidence"):
            try:
                tokens = self._tokenize(query)
                bm25_scores = store["bm25"].get_scores(tokens)
                top_indices = sorted(range(len(bm25_scores)), key=lambda i: bm25_scores[i], reverse=True)[:top_k * 2]
                for idx in top_indices:
                    if bm25_scores[idx] > 0:
                        ev = store["evidence"][idx]
                        if patient_id and ev.metadata and ev.metadata.get("patient_id") != patient_id:
                            continue
                        if ev.evidence_id not in candidates:
                            candidates[ev.evidence_id] = ev
                        bm25_hits[ev.evidence_id] = float(bm25_scores[idx])
            except Exception:
                pass

        if not candidates:
            return []

        cand_list = list(candidates.values())

        # 3. CrossEncoder Reranking
        reranker_hits: Dict[str, float] = {}
        reranker = self._load_reranker()
        if reranker and len(cand_list) > 1:
            try:
                pairs = [[query, ev.text] for ev in cand_list]
                scores = reranker.predict(pairs)
                for i, score in enumerate(scores):
                    reranker_hits[cand_list[i].evidence_id] = float(score)
            except Exception:
                pass

        # Normalize component scores
        max_dense = max(dense_hits.values()) if dense_hits else 1.0
        max_bm25 = max(bm25_hits.values()) if bm25_hits else 1.0
        max_rerank = max(reranker_hits.values()) if reranker_hits else 1.0

        # Calculate hybrid score: 0.20 * Dense + 0.20 * BM25 + 0.60 * Reranker + Recency Boost
        for ev in cand_list:
            d_norm = (dense_hits.get(ev.evidence_id, 0.0) / max_dense) if max_dense > 0 else 0.0
            b_norm = (bm25_hits.get(ev.evidence_id, 0.0) / max_bm25) if max_bm25 > 0 else 0.0
            r_norm = (reranker_hits.get(ev.evidence_id, 0.0) / max_rerank) if max_rerank > 0 else 0.0

            # Recency multiplier if document_date / timestamp exists in metadata
            recency_boost = 0.0
            if ev.metadata and "created_at" in ev.metadata:
                recency_boost = 0.05

            ev.score = round(0.20 * d_norm + 0.20 * b_norm + 0.60 * r_norm + recency_boost, 4)

        cand_list.sort(key=lambda x: x.score, reverse=True)
        return cand_list[:top_k]

