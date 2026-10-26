import json
import os
from typing import List, Dict

CANDIDATE_PATHS = [
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "dsa_questions.json"),
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "dsa_questions.json"),
    os.path.join(os.getcwd(), "dsa_questions.json"),
]

def load_questions() -> List[Dict]:
    target_file = None
    for p in CANDIDATE_PATHS:
        if os.path.exists(p):
            target_file = p
            break
    if not target_file:
        raise FileNotFoundError(f"Questions seed file not found in candidates: {CANDIDATE_PATHS}")
    with open(target_file, "r", encoding="utf-8") as f:
        questions = json.load(f)
    return questions

FIXED_QUESTIONS = load_questions()
QUESTIONS_BY_ID = {q["id"]: q for q in FIXED_QUESTIONS}
