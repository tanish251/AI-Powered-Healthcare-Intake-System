"""
Generate offline local Indic TTS audio samples for all 10 supported languages using Meta MMS-TTS in the ai-ml environment.
"""

import os
import time
import soundfile as sf
import torch
from transformers import VitsModel, AutoTokenizer

LANG_MODELS = [
    ("hi", "Hindi", "facebook/mms-tts-hin", "क्या आपकी जीभ पर सफेद परत जमी महसूस होती है?"),
    ("mr", "Marathi", "facebook/mms-tts-mar", "पोटात जळजळ आणि आंबट ढेकर येतात का?"),
    ("ta", "Tamil", "facebook/mms-tts-tam", "வயிற்றில் எரிச்சல் மற்றும் புளிப்பு ஏப்பம் வருகிறதா?"),
    ("bn", "Bengali", "facebook/mms-tts-ben", "পেটে জ্বালা এবং টক ঢেকুর উঠছে কি?"),
    ("te", "Telugu", "facebook/mms-tts-tel", "కడుపులో మంట మరియు పుల్లని త్రేన్పులు వస్తున్నాయా?"),
    ("gu", "Gujarati", "facebook/mms-tts-guj", "પેટમાં બળતરા અને ખાટા ઓડકાર આવે છે?"),
    ("kn", "Kannada", "facebook/mms-tts-kan", "ಹೊಟ್ಟೆಯಲ್ಲಿ ಉರಿ ಮತ್ತು ಹುಳಿ ತೇಗು ಬರುತ್ತಿದೆಯಾ?"),
    ("ml", "Malayalam", "facebook/mms-tts-mal", "വയറ്റിൽ എരിച്ചിലും പുളിച്ച ഏമ്പക്കവും വരുന്നുണ്ടോ?"),
    ("pa", "Punjabi", "facebook/mms-tts-pan", "ਪੇਟ ਵਿੱਚ ਜਲਨ ਅਤੇ ਖੱਟੀ ਡਕਾਰ ਆਉਂਦੀ ਹੈ?"),
    ("en", "English", "facebook/mms-tts-eng", "Does your stomach feel burning or have sour belching?"),
]


def generate_all_samples():
    output_dir = "tests/tts_samples"
    os.makedirs(output_dir, exist_ok=True)
    print("=== GENERATING LOCAL OFFLINE MMS-TTS SAMPLES FOR 10 LANGUAGES ===")

    for code, name, model_id, text in LANG_MODELS:
        wav_path = os.path.join(output_dir, f"{code}_sample.wav")
        print(f"\nProcessing {name} ({code}) using {model_id}...")
        start = time.time()
        try:
            model = VitsModel.from_pretrained(model_id)
            tokenizer = AutoTokenizer.from_pretrained(model_id)

            inputs = tokenizer(text, return_tensors="pt")
            with torch.no_grad():
                output = model(**inputs).waveform

            sf.write(wav_path, output.squeeze().numpy(), model.config.sampling_rate)
            elapsed = time.time() - start
            print(f"✅ Generated {name} audio clip in {elapsed:.2f}s -> {wav_path}")
        except Exception as e:
            print(f"❌ Failed to generate {name} audio: {e}")


if __name__ == "__main__":
    generate_all_samples()
