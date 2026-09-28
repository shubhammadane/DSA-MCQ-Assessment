import json
import os
from typing import List, Dict

SEED_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "dsa_questions.json")

def load_questions() -> List[Dict]:
    if not os.path.exists(SEED_FILE):
        raise FileNotFoundError(f"Questions seed file not found at {SEED_FILE}")
    with open(SEED_FILE, "r", encoding="utf-8") as f:
        questions = json.load(f)
    return questions

FIXED_QUESTIONS = load_questions()
QUESTIONS_BY_ID = {q["id"]: q for q in FIXED_QUESTIONS}
