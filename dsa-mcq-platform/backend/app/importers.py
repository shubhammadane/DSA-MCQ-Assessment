"""Bounded, deterministic import helpers for student lists and MCQ banks."""

from __future__ import annotations

import csv
import io
import re
from typing import Any

import openpyxl
from pypdf import PdfReader


MAX_UPLOAD_BYTES = 5 * 1024 * 1024
MAX_IMPORT_ROWS = 5000
MAX_PDF_PAGES = 100


class ImportValidationError(ValueError):
    pass


def validate_upload(contents: bytes) -> None:
    if not contents:
        raise ImportValidationError("The uploaded file is empty.")
    if len(contents) > MAX_UPLOAD_BYTES:
        raise ImportValidationError("File is larger than the 5 MB import limit.")


def _limited_rows(rows: list[Any]) -> list[Any]:
    if len(rows) > MAX_IMPORT_ROWS + 1:
        raise ImportValidationError(f"Import is limited to {MAX_IMPORT_ROWS} data rows.")
    return rows


def _sheet_rows(contents: bytes) -> list[tuple[Any, ...]]:
    try:
        workbook = openpyxl.load_workbook(io.BytesIO(contents), read_only=True, data_only=True)
        worksheet = workbook.active
        rows = list(worksheet.iter_rows(values_only=True, max_row=MAX_IMPORT_ROWS + 2))
        workbook.close()
    except Exception as exc:
        raise ImportValidationError(f"Unable to read XLSX workbook: {exc}") from exc
    return _limited_rows(rows)


def _csv_rows(contents: bytes) -> list[list[str]]:
    text = contents.decode("utf-8-sig", errors="strict")
    return _limited_rows(list(csv.reader(io.StringIO(text))))


def _pdf_text(contents: bytes) -> str:
    try:
        reader = PdfReader(io.BytesIO(contents))
    except Exception as exc:
        raise ImportValidationError(f"Unable to read PDF: {exc}") from exc
    if len(reader.pages) > MAX_PDF_PAGES:
        raise ImportValidationError(f"PDF is limited to {MAX_PDF_PAGES} pages.")
    text = "\n".join((page.extract_text() or "") for page in reader.pages)
    if not text.strip():
        raise ImportValidationError(
            "No selectable text was found. Scanned PDFs must be OCR-processed before upload."
        )
    return text


def parse_student_file(contents: bytes, filename: str, content_type: str | None) -> list[dict[str, str | None]]:
    validate_upload(contents)
    lower_name = (filename or "").lower()
    records: list[dict[str, str | None]] = []

    if lower_name.endswith(".csv") or content_type == "text/csv":
        rows = _csv_rows(contents)
    elif lower_name.endswith(".xlsx"):
        rows = _sheet_rows(contents)
    elif lower_name.endswith(".xls"):
        raise ImportValidationError("Legacy .xls files are not supported. Save the workbook as .xlsx or CSV.")
    elif lower_name.endswith(".pdf") or content_type == "application/pdf":
        for line_number, line in enumerate(_pdf_text(contents).splitlines(), start=1):
            match = re.search(
                r"(?:^|\s)([A-Z0-9_-]{4,30})\s+([A-Za-z][A-Za-z\s.\'-]{1,80}?)(?:\s+(MALE|FEMALE|M|F|OTHER))?$",
                line.strip(),
                re.IGNORECASE,
            )
            if not match:
                continue
            enrollment = match.group(1).strip()
            if enrollment.lower() in {"rollno", "enrollment", "student", "number", "srno"}:
                continue
            records.append({
                "enrollment_no": enrollment,
                "name": match.group(2).strip(),
                "gender": match.group(3).strip().upper() if match.group(3) else None,
                "source_row": str(line_number),
            })
        if len(records) > MAX_IMPORT_ROWS:
            raise ImportValidationError(f"Import is limited to {MAX_IMPORT_ROWS} records.")
        return records
    else:
        raise ImportValidationError("Unsupported file. Upload CSV, XLSX, or a text-based PDF.")

    if not rows:
        return []
    headers = [str(value or "").strip().lower().replace(" ", "_") for value in rows[0]]

    def column(names: set[str]) -> int | None:
        for index, header in enumerate(headers):
            if header in names or any(name in header for name in names):
                return index
        return None

    enrollment_index = column({"roll", "roll_no", "enrollment", "enrollment_no", "student_id"})
    name_index = column({"name", "student_name"})
    gender_index = column({"gender", "sex"})
    if enrollment_index is None or name_index is None:
        raise ImportValidationError("Required columns are Enrollment/Roll No and Name.")

    for row_number, row in enumerate(rows[1:], start=2):
        enrollment = str(row[enrollment_index] or "").strip() if len(row) > enrollment_index else ""
        name = str(row[name_index] or "").strip() if len(row) > name_index else ""
        gender = str(row[gender_index] or "").strip().upper() if gender_index is not None and len(row) > gender_index else None
        if enrollment or name:
            records.append({
                "enrollment_no": enrollment,
                "name": name,
                "gender": gender or None,
                "source_row": str(row_number),
            })
    return records


QUESTION_HEADER_ALIASES = {
    "question_text": {"question", "question_text", "text"},
    "option_a": {"a", "option_a", "optiona"},
    "option_b": {"b", "option_b", "optionb"},
    "option_c": {"c", "option_c", "optionc"},
    "option_d": {"d", "option_d", "optiond"},
    "correct_answer": {"answer", "correct", "correct_answer", "key"},
    "marks": {"marks", "mark", "points"},
    "difficulty": {"difficulty", "level"},
    "topic": {"topic", "chapter"},
}


def _normalise_question(record: dict[str, Any], source_row: int) -> tuple[dict[str, Any] | None, str | None]:
    clean = {key: str(value or "").strip() for key, value in record.items()}
    required = ["question_text", "option_a", "option_b", "option_c", "option_d", "correct_answer"]
    missing = [field for field in required if not clean.get(field)]
    if missing:
        return None, f"Row {source_row}: missing {', '.join(missing)}."
    answer_match = re.search(r"[A-D]", clean["correct_answer"].upper())
    if not answer_match:
        return None, f"Row {source_row}: correct answer must be A, B, C, or D."
    options = [clean[f"option_{letter}"] for letter in "abcd"]
    if len({option.casefold() for option in options}) != 4:
        return None, f"Row {source_row}: all four options must be distinct."
    try:
        marks = int(float(clean.get("marks") or "1"))
    except ValueError:
        return None, f"Row {source_row}: marks must be a positive whole number."
    if marks < 1 or marks > 100:
        return None, f"Row {source_row}: marks must be between 1 and 100."
    return {
        "question_text": clean["question_text"],
        "option_a": clean["option_a"],
        "option_b": clean["option_b"],
        "option_c": clean["option_c"],
        "option_d": clean["option_d"],
        "correct_answer": answer_match.group(0),
        "marks": marks,
        "difficulty": clean.get("difficulty") or "Medium",
        "topic": clean.get("topic") or "General",
        "source_row": source_row,
    }, None


def _questions_from_rows(rows: list[Any]) -> tuple[list[dict[str, Any]], list[str]]:
    if not rows:
        return [], ["The file has no rows."]
    headers = [str(value or "").strip().lower().replace(" ", "_") for value in rows[0]]
    indexes: dict[str, int] = {}
    for field, aliases in QUESTION_HEADER_ALIASES.items():
        for index, header in enumerate(headers):
            if header in aliases:
                indexes[field] = index
                break
    required = {"question_text", "option_a", "option_b", "option_c", "option_d", "correct_answer"}
    if not required.issubset(indexes):
        missing = ", ".join(sorted(required - indexes.keys()))
        return [], [f"Missing required columns: {missing}."]

    questions: list[dict[str, Any]] = []
    errors: list[str] = []
    for row_number, row in enumerate(rows[1:], start=2):
        if not any(value is not None and str(value).strip() for value in row):
            continue
        raw = {
            field: row[index] if index < len(row) else None
            for field, index in indexes.items()
        }
        parsed, error = _normalise_question(raw, row_number)
        if error:
            errors.append(error)
        elif parsed:
            questions.append(parsed)
    return questions, errors


def _questions_from_pdf(text: str) -> tuple[list[dict[str, Any]], list[str]]:
    # Supported layout:
    # 1. Question text
    # A. option / B) option / C: option / D. option
    # Answer: A
    pattern = re.compile(
        r"(?:^|\n)\s*(?:Q(?:uestion)?\s*)?\d+[.)]\s*(?P<question>.*?)\n"
        r"\s*A[.):]\s*(?P<a>.*?)\n\s*B[.):]\s*(?P<b>.*?)\n"
        r"\s*C[.):]\s*(?P<c>.*?)\n\s*D[.):]\s*(?P<d>.*?)\n"
        r"\s*(?:Answer|Ans|Correct\s*Answer)\s*[:.)-]\s*(?P<answer>[A-D])(?:\s|$)",
        re.IGNORECASE | re.DOTALL,
    )
    questions: list[dict[str, Any]] = []
    errors: list[str] = []
    for index, match in enumerate(pattern.finditer(text), start=1):
        raw = {
            "question_text": re.sub(r"\s+", " ", match.group("question")),
            "option_a": re.sub(r"\s+", " ", match.group("a")),
            "option_b": re.sub(r"\s+", " ", match.group("b")),
            "option_c": re.sub(r"\s+", " ", match.group("c")),
            "option_d": re.sub(r"\s+", " ", match.group("d")),
            "correct_answer": match.group("answer"),
        }
        parsed, error = _normalise_question(raw, index)
        if error:
            errors.append(error)
        elif parsed:
            questions.append(parsed)
    if not questions:
        errors.append(
            "No MCQs matched the required PDF layout: numbered question, A-D options, then 'Answer: A'."
        )
    return questions, errors


def parse_question_file(contents: bytes, filename: str, content_type: str | None) -> tuple[list[dict[str, Any]], list[str]]:
    validate_upload(contents)
    lower_name = (filename or "").lower()
    if lower_name.endswith(".csv") or content_type == "text/csv":
        return _questions_from_rows(_csv_rows(contents))
    if lower_name.endswith(".xlsx"):
        return _questions_from_rows(_sheet_rows(contents))
    if lower_name.endswith(".xls"):
        raise ImportValidationError("Legacy .xls files are not supported. Save the workbook as .xlsx or CSV.")
    if lower_name.endswith(".pdf") or content_type == "application/pdf":
        return _questions_from_pdf(_pdf_text(contents))
    raise ImportValidationError("Unsupported file. Upload CSV, XLSX, or a text-based PDF.")
