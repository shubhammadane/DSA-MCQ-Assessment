"""Bounded, deterministic import helpers for student lists and MCQ banks."""

from __future__ import annotations

import csv
import io
import re
import subprocess
import tempfile
from pathlib import Path
from typing import Any

import openpyxl
from pypdf import PdfReader


MAX_UPLOAD_BYTES = 5 * 1024 * 1024
MAX_IMPORT_ROWS = 5000
MAX_PDF_PAGES = 100
MAX_OCR_PAGES = 15


async def read_limited_upload(upload: Any) -> bytes:
    """Read at most the configured upload limit plus one byte into memory."""
    contents = await upload.read(MAX_UPLOAD_BYTES + 1)
    validate_upload(contents)
    return contents


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
        text = _ocr_pdf_text(contents, len(reader.pages))
    return text


def _ocr_pdf_text(contents: bytes, page_count: int) -> str:
    if page_count > MAX_OCR_PAGES:
        raise ImportValidationError(
            f"This PDF has no selectable text and has {page_count} pages. Scanned PDF OCR is limited to {MAX_OCR_PAGES} pages; split it into smaller files first."
        )
    try:
        with tempfile.TemporaryDirectory(prefix="dsa-mcq-ocr-") as temporary_directory:
            temporary_path = Path(temporary_directory)
            pdf_path = temporary_path / "upload.pdf"
            pdf_path.write_bytes(contents)
            output_prefix = temporary_path / "page"
            subprocess.run(
                ["pdftoppm", "-png", "-r", "140", str(pdf_path), str(output_prefix)],
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.PIPE,
                timeout=90,
            )
            image_paths = sorted(
                temporary_path.glob("page-*.png"),
                key=lambda path: int(re.search(r"-(\d+)\.png$", path.name).group(1)),
            )
            if not image_paths:
                raise ImportValidationError("The scanned PDF could not be converted into page images.")
            extracted_pages = []
            for image_path in image_paths:
                result = subprocess.run(
                    ["tesseract", str(image_path), "stdout", "--psm", "6"],
                    check=True,
                    capture_output=True,
                    text=True,
                    timeout=15,
                )
                extracted_pages.append(result.stdout)
    except FileNotFoundError as exc:
        raise ImportValidationError(
            "This scanned PDF needs Poppler (pdftoppm) and Tesseract OCR installed on the backend."
        ) from exc
    except subprocess.TimeoutExpired as exc:
        raise ImportValidationError("OCR took too long. Split the PDF into fewer pages and upload again.") from exc
    except subprocess.CalledProcessError as exc:
        raise ImportValidationError("OCR could not read this scanned PDF. Check that its pages are clear and upright.") from exc

    text = "\n".join(extracted_pages)
    if not text.strip():
        raise ImportValidationError("OCR found no readable text in this scanned PDF.")
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
    # PDFs are laid out in many ways. Normalize common typography while keeping
    # line boundaries, then identify question blocks, labeled choices, and keys.
    text = text.replace("\r", "\n").replace("\u00a0", " ")
    text = text.replace("\u2013", "-").replace("\u2014", "-").replace("\u2212", "-")
    lines = [re.sub(r"[\t ]+", " ", line).strip() for line in text.splitlines()]
    answer_key_start = next(
        (
            index for index, line in enumerate(lines)
            if re.match(
                r"^\s*(?:answer\s+key|answers?|correct\s+answers?|solutions?)\s*[:\-]?\s*$",
                line,
                re.IGNORECASE,
            )
        ),
        len(lines),
    )
    question_lines = lines[:answer_key_start]
    key_lines = lines[answer_key_start + 1:] if answer_key_start < len(lines) else []

    question_start = re.compile(
        r"^\s*(?:(?:Q(?:uestion)?\s*\.?\s*)(\d{1,3})\s*[.):\-]?|(?:Question\s+No\.?\s*)(\d{1,3})\s*[.):\-]?|(\d{1,3})\s*[.)])\s*(.*)$",
        re.IGNORECASE,
    )
    option_start = re.compile(
        r"^\s*(?:\(([A-D])\)|\[([A-D])\]|(?:Option|Choice)\s*([A-D])\s*[.):\-]?|([A-D])\s*[.):\-]|\(([1-4])\)|([1-4])\s*[.):\-])\s*(.*?)\s*$",
        re.IGNORECASE,
    )
    unsupported_option_start = re.compile(
        r"^\s*(?:\([E-Z]\)|\[[E-Z]\]|(?:Option|Choice)\s*[E-Z]\s*[.):\-]?|[E-Z]\s*[.):\-])\s+",
        re.IGNORECASE,
    )
    answer_line = re.compile(
        r"^\s*(?:correct\s+answer|answer|ans|key)\s*(?:(?:is|=|:)\s*|-\s*)?(?:option\s*)?(.*?)\s*$",
        re.IGNORECASE,
    )

    starts: list[tuple[int, int, str]] = []
    for index, line in enumerate(question_lines):
        match = question_start.match(line)
        if match:
            number = next(value for value in match.groups()[:3] if value is not None)
            if match.group(3) is not None and starts:
                previous_start = starts[-1][0]
                prior_choices = set()
                for previous_line in question_lines[previous_start + 1:index]:
                    choice_match = re.match(
                        r"^\s*(?:\(([A-D])\)|\[([A-D])\]|(?:Option|Choice)\s*([A-D])\s*[.):\-]?|([A-D])\s*[.):\-]|\(([1-4])\)|([1-4])\s*[.):\-])",
                        previous_line,
                        re.IGNORECASE,
                    )
                    if choice_match:
                        label = next(value.upper() for value in choice_match.groups() if value is not None)
                        prior_choices.add("ABCD"[int(label) - 1] if label.isdigit() else label)
                # 1)-4) are also a common way to label choices. Treat a bare
                # numeric marker as the next question only after the previous
                # block already contains four labeled choices.
                if len(prior_choices) < 4:
                    continue
            starts.append((index, int(number), match.group(4)))

    key_answers: dict[int, str] = {}
    key_answer_text: dict[int, list[str]] = {}
    if key_lines:
        # Also handle compact answer-key entries such as "1. B", "Q1: B", or
        # table extraction where a row's cells appear on separate lines.
        row_starts: list[tuple[int, int]] = []
        for index, line in enumerate(key_lines):
            inline_row = re.match(r"^\s*(?:Q(?:uestion)?\s*)?(\d{1,3})\s+(.+)$", line, re.IGNORECASE)
            if inline_row:
                inline_answer_match = re.search(
                    r"(?:\(([A-D])\)|\[([A-D])\]|(?<![A-Za-z])([A-D])\s*[.):\-](?=\s|$))",
                    inline_row.group(2),
                    re.IGNORECASE,
                )
                if inline_answer_match:
                    key_answers[int(inline_row.group(1))] = next(
                        value.upper() for value in inline_answer_match.groups() if value is not None
                    )
            direct_match = re.match(
                r"^\s*(?:Q(?:uestion)?\s*)?(\d{1,3})(?:\s*[.)\-:]\s*|\s+)(?:answer\s*[:=]?\s*)?(?:option\s*)?\(?([A-D])\)?(?:\s+.*)?\s*$",
                line,
                re.IGNORECASE,
            )
            if direct_match:
                key_answers[int(direct_match.group(1))] = direct_match.group(2).upper()
                continue
            direct_text_match = re.match(
                r"^\s*(?:Q(?:uestion)?\s*)?(\d{1,3})\s*[.)\-:]\s*(?:correct\s+answer\s*[:=]?\s*)?(.+?)\s*$",
                line,
                re.IGNORECASE,
            )
            if direct_text_match:
                raw_answer = direct_text_match.group(2).strip()
                letter_match = re.fullmatch(r"(?:option\s*)?\(?([A-D])\)?", raw_answer, re.IGNORECASE)
                if letter_match:
                    key_answers[int(direct_text_match.group(1))] = letter_match.group(1).upper()
                else:
                    key_answer_text.setdefault(int(direct_text_match.group(1)), []).append(raw_answer)
                continue
            match = re.fullmatch(r"\s*(?:Q\s*)?(\d{1,3})[.)]?\s*", line, re.IGNORECASE)
            next_line_is_another_number = index + 1 < len(key_lines) and bool(
                re.fullmatch(r"\s*(?:Q\s*)?\d{1,3}[.)]?\s*", key_lines[index + 1], re.IGNORECASE)
            )
            if match and not next_line_is_another_number:
                row_starts.append((index, int(match.group(1))))
        for row_index, (line_index, question_number) in enumerate(row_starts):
            end = row_starts[row_index + 1][0] if row_index + 1 < len(row_starts) else len(key_lines)
            key_answer_text[question_number] = key_lines[line_index + 1:end]
            for line in key_lines[line_index + 1:end]:
                answer_match = re.match(
                    r"^\s*(?:\(([A-D])\)|\[([A-D])\]|(?:option\s*)?([A-D])[.):\-]|\b([A-D])\b\s*$)",
                    line,
                    re.IGNORECASE,
                )
                if answer_match:
                    key_answers[question_number] = next(
                        value.upper() for value in answer_match.groups() if value is not None
                    )
                    break

    questions: list[dict[str, Any]] = []
    errors: list[str] = []
    for index, (start, question_number, first_line) in enumerate(starts, start=1):
        end = starts[index][0] if index < len(starts) else len(question_lines)
        block = [first_line, *question_lines[start + 1:end]]
        stem: list[str] = []
        options: dict[str, str] = {}
        current_option: str | None = None
        inline_answer: str | None = None
        unsupported_option: str | None = None
        for line in block:
            answer_match = answer_line.match(line)
            if answer_match:
                inline_answer = answer_match.group(1).strip()
                current_option = None
                continue
            option_match = option_start.match(line)
            if option_match:
                option_label = next(value for value in option_match.groups()[:6] if value is not None)
                current_option = str("ABCD"[int(option_label) - 1]) if option_label.isdigit() else option_label.upper()
                options[current_option] = option_match.group(7).strip()
                continue
            extra_option_match = unsupported_option_start.match(line)
            if extra_option_match:
                unsupported_option = extra_option_match.group(0).strip().upper()
                current_option = None
                continue
            if not line or re.fullmatch(r"\[?\s*\d+\s*(?:marks?|points?)\s*\]?", line, re.IGNORECASE):
                continue
            if current_option:
                options[current_option] = f"{options[current_option]} {line.strip()}".strip()
            else:
                stem.append(line.strip())

        answer = inline_answer or key_answers.get(question_number)
        if answer and answer not in "ABCD":
            normalized_answer = re.sub(r"[^a-z0-9]+", "", answer.casefold())
            matching_option = next((
                letter for letter, option in options.items()
                if normalized_answer == re.sub(r"[^a-z0-9]+", "", option.casefold())
            ), None)
            explicit_letter = re.match(r"^\s*(?:option\s*)?\(?([A-D])\)?\b", answer, re.IGNORECASE)
            answer = matching_option or (explicit_letter.group(1).upper() if explicit_letter else None)
        if not answer:
            for candidate in key_answer_text.get(question_number, []):
                candidate = re.sub(r"^\s*(?:\(([A-D])\)|\[([A-D])\])\s*", "", candidate, flags=re.IGNORECASE)
                normalized_candidate = re.sub(r"[^a-z0-9]+", "", candidate.casefold())
                if not normalized_candidate:
                    continue
                matched_letter = next((
                    letter for letter, option in options.items()
                    if normalized_candidate == re.sub(r"[^a-z0-9]+", "", option.casefold())
                ), None)
                if matched_letter:
                    answer = matched_letter
                    break
        if unsupported_option:
            errors.append(
                f"Question {question_number}: this assessment supports four choices (A-D); found an additional choice labeled {unsupported_option}."
            )
            continue
        if not answer:
            errors.append(f"Question {question_number}: no correct answer found. Add an 'Answer: A' line or an answer-key table.")
            continue
        missing_options = [letter for letter in "ABCD" if not options.get(letter)]
        if missing_options:
            errors.append(f"Question {question_number}: missing option(s) {', '.join(missing_options)}.")
            continue
        raw = {
            "question_text": re.sub(r"\s+", " ", " ".join(stem)),
            "option_a": re.sub(r"\s+", " ", options.get("A", "")),
            "option_b": re.sub(r"\s+", " ", options.get("B", "")),
            "option_c": re.sub(r"\s+", " ", options.get("C", "")),
            "option_d": re.sub(r"\s+", " ", options.get("D", "")),
            "correct_answer": answer,
        }
        parsed, error = _normalise_question(raw, index)
        if error:
            errors.append(error)
        elif parsed:
            questions.append(parsed)
    if not questions:
        errors.append(
            "No MCQs matched. Use numbered questions with four A-D options and either an inline 'Answer: A' line or a separate answer-key table."
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
        text = _pdf_text(contents)
        questions, errors = _questions_from_pdf(text)
        if errors:
            # Some PDFs contain a text layer for headers but image-only question
            # pages. OCR the pages as a fallback and keep whichever extraction
            # produced the more complete preview.
            try:
                reader = PdfReader(io.BytesIO(contents))
                has_selectable_text = any((page.extract_text() or "").strip() for page in reader.pages)
                if has_selectable_text:
                    ocr_questions, ocr_errors = _questions_from_pdf(_ocr_pdf_text(contents, len(reader.pages)))
                    if len(ocr_questions) > len(questions) or (
                        len(ocr_questions) == len(questions) and len(ocr_errors) < len(errors)
                    ):
                        return ocr_questions, ocr_errors
            except ImportValidationError:
                pass
        return questions, errors
    raise ImportValidationError("Unsupported file. Upload CSV, XLSX, or a text-based PDF.")
