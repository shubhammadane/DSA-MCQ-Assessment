from io import BytesIO

import openpyxl

from app.importers import MAX_UPLOAD_BYTES, ImportValidationError, parse_question_file, parse_student_file, read_limited_upload


def _text_pdf(lines: list[str]) -> bytes:
    commands = ["BT", "/F1 12 Tf", "72 740 Td"]
    for index, line in enumerate(lines):
        escaped = line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        if index:
            commands.append("0 -18 Td")
        commands.append(f"({escaped}) Tj")
    commands.append("ET")
    stream = "\n".join(commands).encode()
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
        b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    data = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for number, obj in enumerate(objects, start=1):
        offsets.append(len(data))
        data.extend(f"{number} 0 obj\n".encode() + obj + b"\nendobj\n")
    xref = len(data)
    data.extend(f"xref\n0 {len(objects) + 1}\n".encode())
    data.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        data.extend(f"{offset:010d} 00000 n \n".encode())
    data.extend(f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode())
    return bytes(data)


def test_student_csv_requires_headers_and_parses_rows():
    contents = b"enrollment_no,name,gender\nA100,Student One,Female\n"
    records = parse_student_file(contents, "students.csv", "text/csv")
    assert records == [{
        "enrollment_no": "A100",
        "name": "Student One",
        "gender": "FEMALE",
        "source_row": "2",
    }]


def test_question_xlsx_parses_structured_mcq():
    workbook = openpyxl.Workbook()
    sheet = workbook.active
    sheet.append(["question_text", "option_a", "option_b", "option_c", "option_d", "correct_answer", "marks"])
    sheet.append(["Question?", "One", "Two", "Three", "Four", "C", 2])
    output = BytesIO()
    workbook.save(output)
    questions, errors = parse_question_file(output.getvalue(), "questions.xlsx", None)
    assert not errors
    assert questions[0]["correct_answer"] == "C"
    assert questions[0]["marks"] == 2


def test_question_pdf_parses_required_layout():
    pdf = _text_pdf([
        "1. What is a stack?",
        "A. FIFO",
        "B. LIFO",
        "C. Tree",
        "D. Graph",
        "Answer: B",
    ])
    questions, errors = parse_question_file(pdf, "questions.pdf", "application/pdf")
    assert not errors
    assert len(questions) == 1
    assert questions[0]["question_text"] == "What is a stack?"
    assert questions[0]["correct_answer"] == "B"


def test_legacy_xls_is_rejected_with_actionable_message():
    try:
        parse_student_file(b"not-an-xls", "students.xls", "application/vnd.ms-excel")
    except ImportValidationError as exc:
        assert "Save the workbook as .xlsx" in str(exc)
    else:
        raise AssertionError("Legacy XLS should be rejected")


def test_upload_reader_stops_at_limit_plus_one_byte():
    class FakeUpload:
        requested_size = None

        async def read(self, size):
            self.requested_size = size
            return b"x" * size

    upload = FakeUpload()
    try:
        import asyncio
        asyncio.run(read_limited_upload(upload))
    except ImportValidationError as exc:
        assert "5 MB" in str(exc)
    else:
        raise AssertionError("Oversized upload should be rejected")
    assert upload.requested_size == MAX_UPLOAD_BYTES + 1
