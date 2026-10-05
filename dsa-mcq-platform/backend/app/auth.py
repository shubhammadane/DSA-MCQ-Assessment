from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from passlib.hash import pbkdf2_sha256
from sqlalchemy.orm import Session
from app.config import settings
from app.database import get_db

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
student_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/student/login")


def hash_password(password: str) -> str:
    return pbkdf2_sha256.hash(password)


def verify_password(plain_password: str, hashed_password: Optional[str]) -> bool:
    if not hashed_password:
        return False
    try:
        return pbkdf2_sha256.verify(plain_password, hashed_password)
    except Exception:
        return False


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def verify_token(token: str) -> str:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate admin credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        role: Optional[str] = payload.get("role")
        if username is None or (username != settings.ADMIN_USERNAME and role != "admin"):
            raise credentials_exception
        return username
    except JWTError:
        raise credentials_exception


def get_current_admin(token: str = Depends(oauth2_scheme)) -> str:
    return verify_token(token)


def get_current_student(
    token: str = Depends(student_oauth2_scheme),
    db: Session = Depends(get_db)
):
    from app import models
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate student credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        role: str = payload.get("role")
        sub: str = payload.get("sub")
        if role != "student" or not sub:
            raise credentials_exception
        student_id = int(sub)
    except (JWTError, ValueError):
        raise credentials_exception

    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student or not student.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Student account is inactive or not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return student
