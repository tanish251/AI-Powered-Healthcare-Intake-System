"""
Benchmark Script for CHAT & OCR models via OmniRoute Gateway (http://localhost:20128/v1).
"""

import os
import sys
import time
import json
import base64
import requests

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from engine.schema import ConversationState, get_default_slots
from engine.prompt_builder import build_system_prompt
from engine.nidana_patterns import get_initial_candidate_patterns
from engine.ocr_digitizer import OCR_EXTRACTION_PROMPT

OMNI_BASE_URL = os.getenv("OMNIROUTE_BASE_URL", "http://localhost:20128/v1")
OMNI_API_KEY = os.getenv("OMNIROUTE_API_KEY", "sk-508afa7ec6928b66-205f3c-1b146867")


def call_chat_completion(model_name: str, messages: list, system_prompt: str = None) -> tuple:
    """Calls OpenAI-compatible /v1/chat/completions endpoint on OmniRoute."""
    url = f"{OMNI_BASE_URL}/chat/completions"
    headers = {
        "Authorization": f"Bearer {OMNI_API_KEY}",
        "Content-Type": "application/json"
    }

    full_messages = []
    if system_prompt:
        full_messages.append({"role": "system", "content": system_prompt})
    full_messages.extend(messages)

    payload = {
        "model": model_name,
        "messages": full_messages,
        "temperature": 0.2,
        "max_tokens": 300,
        "stream": False,
    }

    start = time.time()
    try:
        res = requests.post(url, headers=headers, json=payload, timeout=30)
        elapsed = time.time() - start
        if res.status_code == 200:
            data = res.json()
            content = data["choices"][0]["message"]["content"]
            return content, elapsed, None
        else:
            return None, elapsed, f"HTTP {res.status_code}: {res.text}"
    except Exception as e:
        return None, time.time() - start, str(e)


def benchmark_chat():
    print("=========================================================")
    print("=== 1. CHAT PATH BENCHMARK (ON-STAGE LATENCY SENSITIVE) ===")
    print("=========================================================\n")

    candidates = [
        "antigravity/claude-sonnet-4-6",
        "antigravity/gemini-3.6-flash-medium",
        "antigravity/gemini-3.6-flash-high",
    ]

    complaint = "पेट में जलन और खट्टी डकार आती है"
    state = ConversationState(
        session_id="benchmark-session",
        patient_language="hi",
        slots=get_default_slots(),
        chief_complaint_raw=complaint,
        candidate_patterns=get_initial_candidate_patterns(),
    )
    sys_prompt = build_system_prompt(state, "jihwa")

    user_turns = [
        "पेट में बहुत जलन होती है, खासकर खाना खाने के बाद।",
        "जी हां, खट्टी डकारें भी आती हैं।",
        "सुबह उठने पर मुंह कड़वा सा लगता है।",
        "लगभग 2 हफ्तों से यह परेशानी चल रही है।",
        "नहीं, कोई पेट दर्द या दस्त नहीं है।"
    ]

    for model in candidates:
        print(f"--- Benchmarking Model: {model} ---")
        latencies = []
        json_clean = True
        single_q_clean = True
        lang_clean = True

        messages_history = []

        for turn_idx, turn_text in enumerate(user_turns):
            messages_history.append({"role": "user", "content": turn_text})
            resp_text, elapsed, err = call_chat_completion(model, messages_history, sys_prompt)

            if err:
                print(f"  Turn {turn_idx+1}: FAILED with error -> {err}")
                json_clean = False
                continue

            latencies.append(elapsed)

            # Check JSON parseability
            try:
                # Find JSON block
                s = resp_text.strip()
                if "```json" in s:
                    s = s.split("```json")[1].split("```")[0].strip()
                elif "```" in s:
                    s = s.split("```")[1].split("```")[0].strip()

                parsed = json.loads(s)
                q = parsed.get("response_to_patient", "")
                
                # Check single question
                if q.count("?") > 1:
                    single_q_clean = False
                
                messages_history.append({"role": "assistant", "content": resp_text})
                print(f"  Turn {turn_idx+1}: Latency={elapsed:.2f}s | Q: \"{q}\"")

            except Exception as parse_err:
                json_clean = False
                print(f"  Turn {turn_idx+1}: Latency={elapsed:.2f}s | JSON Parse Error: {parse_err}")

        avg_lat = sum(latencies) / len(latencies) if latencies else 0.0
        print(f"\nModel {model} Results:")
        print(f"  - Avg Latency: {avg_lat:.2f}s")
        print(f"  - Clean JSON Parsed: {json_clean}")
        print(f"  - Native Single Question: {single_q_clean}")
        print("-" * 55)


def benchmark_ocr():
    print("\n=========================================================")
    print("=== 2. OCR PATH BENCHMARK (ACCURACY > SPEED) ===")
    print("=========================================================\n")

    image_path = "tests/test_casesheet_synthetic.jpg"
    if not os.path.exists(image_path):
        print(f"Error: {image_path} not found. Generate it first.")
        return

    with open(image_path, "rb") as f:
        img_b64 = base64.b64encode(f.read()).decode("utf-8")

    ocr_candidates = [
        "antigravity/claude-sonnet-4-6",
        "antigravity/claude-opus-4-6-thinking",
    ]

    for model in ocr_candidates:
        print(f"--- Testing OCR Candidate: {model} ---")
        payload = {
            "model": model,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": OCR_EXTRACTION_PROMPT},
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/jpeg;base64,{img_b64}"}
                        }
                    ]
                }
            ],
            "max_tokens": 500,
            "temperature": 0.1,
            "stream": False,
        }
        headers = {
            "Authorization": f"Bearer {OMNI_API_KEY}",
            "Content-Type": "application/json"
        }

        start = time.time()
        try:
            res = requests.post(f"{OMNI_BASE_URL}/chat/completions", headers=headers, json=payload, timeout=45)
            elapsed = time.time() - start

            if res.status_code == 200:
                raw_out = res.json()["choices"][0]["message"]["content"]
                print(f"Latency: {elapsed:.2f}s")
                print(f"Raw Model Output:\n{raw_out}\n")
            else:
                print(f"Failed HTTP {res.status_code}: {res.text}")
        except Exception as e:
            print(f"OCR Benchmark Error for {model}: {e}")


if __name__ == "__main__":
    benchmark_chat()
    benchmark_ocr()
