from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.api import router

# Create database tables automatically
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="DSA MCQ Assessment Platform API",
    description="Backend service for DSA MCQ 50-Question Online Examination System",
    version="1.0.0"
)

from app.config import settings

# Configure CORS for local dev and production Vercel frontend
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
if settings.FRONTEND_URL:
    for u in settings.FRONTEND_URL.split(","):
        trimmed = u.strip()
        if trimmed and trimmed not in origins:
            origins.append(trimmed)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if settings.FRONTEND_URL else ["*"],
    allow_origin_regex=r"https:\/\/.*\.vercel\.app" if settings.FRONTEND_URL else None,
    allow_credentials=True if settings.FRONTEND_URL else False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

@app.get("/")
def read_root():
    return {"status": "online", "message": "DSA MCQ Assessment System API is running"}
