from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from app.database import engine, Base
from app import models
from app.routers import surveys, submissions

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Video Survey API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

media_dir = os.getenv("MEDIA_DIR", "./media")
os.makedirs(media_dir, exist_ok=True)
os.makedirs(os.path.join(media_dir, "images"), exist_ok=True)
os.makedirs(os.path.join(media_dir, "videos"), exist_ok=True)

app.mount("/media", StaticFiles(directory=media_dir), name="media")

app.include_router(surveys.router, prefix="/api/surveys", tags=["surveys"])
app.include_router(submissions.router, prefix="/api/submissions", tags=["submissions"])


@app.get("/health")
def health():
    return {"status": "ok"}