from __future__ import annotations
from pathlib import Path
from typing import Dict, Any, Optional

class TrOCRHandwriting:
    """Lazy local handwriting recognizer using TrOCR-base-handwritten."""
    def __init__(self, model_name: str = "microsoft/trocr-base-handwritten", device: str = "cpu"):
        self.model_name = model_name
        self.device = device
        self.processor = None
        self.model = None
        self._load_error: Optional[str] = None

    def _load(self):
        if self.model is not None or self._load_error is not None:
            return
        try:
            from transformers import TrOCRProcessor, VisionEncoderDecoderModel
            self.processor = TrOCRProcessor.from_pretrained(self.model_name)
            self.model = VisionEncoderDecoderModel.from_pretrained(self.model_name)
            self.model.to(self.device)
            self.model.eval()
        except Exception as exc:
            self._load_error = str(exc)

    def is_loaded(self) -> bool:
        return self.model is not None

    def health_check(self) -> Dict[str, Any]:
        if self.model is not None:
            return {"status": "loaded", "model": self.model_name, "device": self.device}
        if self._load_error:
            return {"status": "failed", "model": self.model_name, "error": self._load_error}
        return {"status": "ready_to_load", "model": self.model_name, "device": self.device}

    def transcribe(self, image_path: str) -> str:
        self._load()
        if self._load_error or self.model is None or self.processor is None:
            return "[UNCLEAR_HANDWRITING]"
        try:
            from PIL import Image
            import torch
            image = Image.open(image_path).convert("RGB")
            pixel_values = self.processor(images=image, return_tensors="pt").pixel_values.to(self.device)
            with torch.inference_mode():
                generated_ids = self.model.generate(pixel_values, max_new_tokens=128)
            res = self.processor.batch_decode(generated_ids, skip_special_tokens=True)[0].strip()
            return res if res else "[UNCLEAR_HANDWRITING]"
        except Exception:
            return "[UNCLEAR_HANDWRITING]"

