import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app import models
from app.api import (
    _check_login_limit,
    _clear_login_failures,
    _record_login_failure,
    _spreadsheet_safe_value,
)


def test_database_login_throttle_persists_and_clears():
    engine = create_engine("sqlite:///:memory:")
    models.LoginFailure.__table__.create(engine)
    with Session(engine) as db:
        for _ in range(8):
            _record_login_failure(db, "student:127.0.0.1:sample")
        with pytest.raises(HTTPException) as error:
            _check_login_limit(db, "student:127.0.0.1:sample")
        assert error.value.status_code == 429

        _check_login_limit(db, "student:127.0.0.1:other")
        _clear_login_failures(db, "student:127.0.0.1:sample")
        _check_login_limit(db, "student:127.0.0.1:sample")


@pytest.mark.parametrize("value", ["=1+1", "  @SUM(A1:A2)", "+cmd", "-1+2"])
def test_spreadsheet_values_are_neutralized(value):
    assert _spreadsheet_safe_value(value).startswith("'")


def test_spreadsheet_plain_text_is_unchanged():
    assert _spreadsheet_safe_value("Student Name") == "Student Name"
