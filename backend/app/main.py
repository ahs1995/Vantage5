from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app import models
from app.routers import surveys

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Video Survey API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(surveys.router, prefix="/api/surveys", tags=["surveys"])

@app.get("/health")
def health():
    return {"status": "ok"}