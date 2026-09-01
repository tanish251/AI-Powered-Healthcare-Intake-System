from __future__ import annotations
from dataclasses import dataclass, field
import re
import sys
from pathlib import Path
from typing import Dict, Any, List, Optional

@dataclass
class NormalizedText:
    original: str
    normalized_english: str
    source_language: Optional[str] = None
    uncertain_terms: List[str] = field(default_factory=list)

COMMON_GLOSSARY = {
    "pet dard": "abdominal pain",
    "pet mein dard": "abdominal pain",
    "chakkar": "dizziness",
    "bukhar": "fever",
    "sar dard": "headache",
    "kamzori": "weakness",
    "sardi": "cold",
    "khansi": "cough",
    "saans fulna": "shortness of breath",
}

INDIC_SCRIPTS = {
    r"[\u0900-\u097F]": ("hin_Deva", "Hindi/Devanagari"),
    r"[\u0980-\u09FF]": ("ben_Beng", "Bengali"),
    r"[\u0A00-\u0A7F]": ("pan_Guru", "Punjabi"),
    r"[\u0A80-\u0AFF]": ("guj_Gujr", "Gujarati"),
    r"[\u0B00-\u0B7F]": ("ori_Orya", "Odia"),
    r"[\u0B80-\u0BFF]": ("tam_Taml", "Tamil"),
    r"[\u0C00-\u0C7F]": ("tel_Telu", "Telugu"),
    r"[\u0C80-\u0CFF]": ("kan_Knda", "Kannada"),
    r"[\u0D00-\u0D7F]": ("mal_Mlym", "Malayalam"),
}

class IndicTrans2Translator:
    """Lazy loader and runner for IndicTrans2 models."""
    def __init__(self, model_name: str = "AI4Bharat/IndicTrans2-indic-en-1B"):
        self.model_name = model_name
        self.tokenizer = None
        self.model = None
        self._load_error: Optional[str] = None

    def _load(self):
        if self.model is not None or self._load_error is not None:
            return
        try:
            from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
            self.tokenizer = AutoTokenizer.from_pretrained(self.model_name, trust_remote_code=True)
            self.model = AutoModelForSeq2SeqLM.from_pretrained(self.model_name, trust_remote_code=True)
            self.model.eval()
        except Exception as exc:
            self._load_error = str(exc)

    def is_loaded(self) -> bool:
        return self.model is not None

    def health_check(self) -> Dict[str, Any]:
        if self.model is not None:
            return {"status": "loaded", "model": self.model_name}
        if self._load_error:
            return {"status": "not_loaded", "model": self.model_name, "reason": self._load_error}
        return {"status": "ready_to_load", "model": self.model_name}

    def translate(self, text: str, src_lang: str) -> str:
        self._load()
        if self.model is None or self.tokenizer is None:
            return text
        try:
            inputs = self.tokenizer(text, return_tensors="pt", padding=True)
            generated_tokens = self.model.generate(**inputs, max_length=256)
            translated = self.tokenizer.batch_decode(generated_tokens, skip_special_tokens=True)[0]
            return translated.strip() if translated else text
        except Exception:
            return text

class LanguageNormalizer:
    """Language normalization pipeline with IndicTrans2 integration."""
    def __init__(self, translator: Optional[IndicTrans2Translator] = None):
        self.translator = translator or IndicTrans2Translator()

    @staticmethod
    def detect_indic_script(text: str) -> Optional[tuple[str, str]]:
        for pattern, lang_info in INDIC_SCRIPTS.items():
            if re.search(pattern, text):
                return lang_info
        return None

    def health_check(self) -> Dict[str, Any]:
        return self.translator.health_check()

    def normalize(self, text: str, source_language: Optional[str] = None) -> NormalizedText:
        if not text or not text.strip():
            return NormalizedText(original=text, normalized_english=text, source_language="eng_Latn")

        detected = source_language
        script_match = self.detect_indic_script(text)
        if script_match and not detected:
            detected = script_match[0]

        out = text
        uncertain: list[str] = []

        # Step 1: Run IndicTrans2 if non-English script detected
        if detected and detected != "eng_Latn":
            try:
                translated = self.translator.translate(out, detected)
                if translated and translated != out:
                    out = translated
                else:
                    uncertain.append("UNCLEAR_TRANSLATION_CONFIDENCE")
            except Exception:
                uncertain.append("TRANSLATION_FAILED")

        # Step 2: Hinglish/transliterated terms dictionary fallback
        lowered = out.lower()
        for src, dst in COMMON_GLOSSARY.items():
            if src in lowered:
                out = re.sub(re.escape(src), dst, out, flags=re.IGNORECASE)

        return NormalizedText(
            original=text,
            normalized_english=out.strip(),
            source_language=detected or "eng_Latn",
            uncertain_terms=uncertain,
        )

