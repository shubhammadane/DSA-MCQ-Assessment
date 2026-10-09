from datetime import datetime, timedelta
from typing import Optional, Any
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from passlib.hash import pbkdf2_sha256
from sqlalchemy.orm import Session
from app.config import settings
from app.database import get_db

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
optional_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)
student_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/student/login")


class CurrentUser:
    """Represents the currently authenticated administrative or staff user."""
    def __init__(
        self,
        id: Optional[int],
        username: str,
        full_name: str,
        role: str,
        department_id: Optional[int] = None,
        department_name: Optional[str] = None
    ):
        self.id = id
        self.username = username
        self.full_name = full_name
        self.role = role  # "super_admin", "hod", "faculty"
        self.department_id = department_id
        self.department_name = department_name

    @property
    def is_super_admin(self) -> bool:
        return self.role in ("super_admin", "admin")

    @property
    def is_hod(self) -> bool:
        return self.role == "hod"

    @property
    def is_faculty(self) -> bool:
        return self.role == "faculty"

    def __str__(self) -> str:
        return self.username

    def __repr__(self) -> str:
        return f"<CurrentUser username={self.username} role={self.role} dept={self.department_id}>"

    def __eq__(self, other: Any) -> bool:
        if isinstance(other, str):
            return self.username == other
        if isinstance(other, CurrentUser):
            return self.username == other.username and self.role == other.role
        return False


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


def get_current_admin(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> CurrentUser:
    from app import models
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate admin credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: Optional[str] = payload.get("sub")
        role: Optional[str] = payload.get("role")
        if not username:
            raise credentials_exception

        # 1. Environment Super Admin
        if username == settings.ADMIN_USERNAME:
            return CurrentUser(
                id=0,
                username=username,
                full_name="Super Administrator",
                role="super_admin",
                department_id=None,
                department_name=None
            )

        # 2. Database AdminUser (HOD / Faculty / Secondary Super Admin)
        user = db.query(models.AdminUser).filter(
            models.AdminUser.username == username,
            models.AdminUser.is_active == True
        ).first()

        if user:
            dept_name = user.department.name if user.department else None
            return CurrentUser(
                id=user.id,
                username=user.username,
                full_name=user.full_name,
                role=user.role,
                department_id=user.department_id,
                department_name=dept_name
            )

        if role in ("super_admin", "admin"):
            return CurrentUser(
                id=0,
                username=username,
                full_name="Super Administrator",
                role="super_admin",
                department_id=None,
                department_name=None
            )

        raise credentials_exception
    except JWTError:
        raise credentials_exception


def require_super_admin(
    current_user: CurrentUser = Depends(get_current_admin)
) -> CurrentUser:
    if not current_user.is_super_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Super Administrator privileges required."
        )
    return current_user


def require_hod_or_super_admin(
    current_user: CurrentUser = Depends(get_current_admin)
) -> CurrentUser:
    if not (current_user.is_super_admin or current_user.is_hod):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: HOD or Super Administrator privileges required."
        )
    return current_user


def get_optional_admin(
    token: Optional[str] = Depends(optional_oauth2_scheme),
    db: Session = Depends(get_db)
) -> Optional[CurrentUser]:
    if not token:
        return None
    try:
        return get_current_admin(token=token, db=db)
    except Exception:
        return None


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
