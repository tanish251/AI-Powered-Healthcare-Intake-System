from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="PS47_", extra="ignore")
    medical_llm_base_url: str = "http://127.0.0.1:38127/v1"
    medical_model: str = "Lingshu-I-8B-Q4_K_M.gguf"
    medical_fallback_base_url: str = "http://127.0.0.1:38129/v1"
    medical_fallback_model: str = "MedVLM-R1-2B-Q4_K_M.gguf"
    ocr_llm_base_url: str = "http://127.0.0.1:38128/v1"
    ocr_enabled: bool = True
    ocr_model: str = "PaddleOCR-VL-0.9B-GGUF.gguf"
    trocr_model: str = "microsoft/trocr-base-handwritten"
    indictrans_model: str = "AI4Bharat/IndicTrans2-indic-en-1B"
    qdrant_url: str = "http://127.0.0.1:6333"
    searxng_url: str = "http://127.0.0.1:8080"
    patient_collection: str = "ps47_patient_evidence"
    medical_collection: str = "ps47_medical_knowledge"
    embedding_model: str = "BAAI/bge-small-en-v1.5"
    reranker_model: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"
    data_dir: Path = Path("./data")
    top_k: int = 8
    web_top_k: int = 5
    min_web_score: float = 0.0

settings = Settings()
settings.data_dir.mkdir(parents=True, exist_ok=True)

