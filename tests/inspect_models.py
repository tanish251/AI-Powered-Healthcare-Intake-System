"""
Model Inventory Inspector for OmniRoute Local Gateway (http://localhost:20128).
Queries GET /v1/models and lists available models, capabilities, and provider prefixes.
"""

import os
import requests

OMNI_BASE_URL = os.getenv("OMNIROUTE_BASE_URL", "http://localhost:20128/v1")
OMNI_API_KEY = os.getenv("OMNIROUTE_API_KEY", "sk-508afa7ec6928b66-205f3c-1b146867")


def inspect_models():
    print(f"=== OMNIROUTE MODEL INVENTORY INSPECTOR ===")
    print(f"Base URL: {OMNI_BASE_URL}")

    headers = {"Authorization": f"Bearer {OMNI_API_KEY}"}

    try:
        url = f"{OMNI_BASE_URL}/models"
        res = requests.get(url, headers=headers, timeout=10)

        if res.status_code != 200:
            print(f"Error fetching models: HTTP {res.status_code} - {res.text}")
            return

        data = res.json()
        models = data.get("data", [])
        print(f"Total models returned by live gateway: {len(models)}\n")

        # Group models by provider / prefix
        grouped = {}
        for m in models:
            m_id = m.get("id", "")
            prefix = m_id.split("/")[0] if "/" in m_id else "other"
            if prefix not in grouped:
                grouped[prefix] = []
            grouped[prefix].append(m)

        print(f"Providers / Prefixes found: {list(grouped.keys())}\n")

        # Filter relevant candidate models for Chat & OCR
        target_prefixes = ["antigravity", "gemini", "claude", "nvidia", "opencode", "no-think"]
        print("=== TARGET CANDIDATE MODELS FOR SIH26047 ===")
        for m in models:
            m_id = m.get("id", "")
            if any(p in m_id.lower() for p in target_prefixes):
                caps = m.get("capabilities", {})
                modalities = m.get("input_modalities", [])
                vision = caps.get("vision", False) or "image" in modalities
                print(f"ID: {m_id:<45} | Vision: {str(vision):<5} | Context: {m.get('context_length', 'N/A')}")

    except Exception as e:
        print(f"Failed to query OmniRoute endpoint: {e}")


if __name__ == "__main__":
    inspect_models()
