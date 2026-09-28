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

# Enable CORS for React Vite frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

@app.get("/")
def read_root():
    return {"status": "online", "message": "DSA MCQ Assessment System API is running"}
