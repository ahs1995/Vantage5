import json, zipfile, shutil, uuid
from fastapi.responses import FileResponse
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.sql import func
from datetime import datetime, timezone
import os, uuid

from app.database import get_db
from app import models, schemas

router = APIRouter()

MEDIA_DIR = os.getenv("MEDIA_DIR", "./media")


def parse_user_agent(ua_string: str):
    try:
        from user_agents import parse
        ua = parse(ua_string)
        return {
            "browser": ua.browser.family,
            "os": ua.os.family,
            "device": "Mobile" if ua.is_mobile else "Tablet" if ua.is_tablet else "Desktop",
        }
    except Exception:
        return {"browser": "Unknown", "os": "Unknown", "device": "Unknown"}


@router.post("/surveys/{survey_id}/start", response_model=schemas.SubmissionOut, status_code=201)
def start_submission(survey_id: int, request: Request, db: Session = Depends(get_db)):
    survey = db.query(models.Survey).filter(
        models.Survey.id == survey_id,
        models.Survey.is_active == True
    ).first()
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found or not active")

    ip = request.client.host
    ua_string = request.headers.get("user-agent", "")
    ua_info = parse_user_agent(ua_string)

    submission = models.SurveySubmission(
        survey_id=survey_id,
        ip_address=ip,
        browser=ua_info["browser"],
        os=ua_info["os"],
        device=ua_info["device"],
        location="Unknown",
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)
    return submission


@router.post("/{submission_id}/answers", response_model=schemas.AnswerOut, status_code=201)
def save_answer(submission_id: int, payload: schemas.AnswerCreate, db: Session = Depends(get_db)):
    submission = db.query(models.SurveySubmission).filter(
        models.SurveySubmission.id == submission_id
    ).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    answer = models.SurveyAnswer(
        submission_id=submission_id,
        question_id=payload.question_id,
        answer=payload.answer,
        face_detected=payload.face_detected,
        face_score=payload.face_score,
        face_image_path=payload.face_image_path,
    )
    db.add(answer)
    db.commit()
    db.refresh(answer)
    return answer


@router.post("/{submission_id}/media")
async def upload_media(
    submission_id: int,
    file: UploadFile = File(...),
    media_type: str = "image",
    db: Session = Depends(get_db),
):
    submission = db.query(models.SurveySubmission).filter(
        models.SurveySubmission.id == submission_id
    ).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    ext = file.filename.split(".")[-1] if file.filename and "." in file.filename else "png"
    folder = "videos" if media_type == "video" else "images"
    filename = f"{uuid.uuid4()}.{ext}"
    save_dir = os.path.join(MEDIA_DIR, folder)
    os.makedirs(save_dir, exist_ok=True)
    save_path = os.path.join(save_dir, filename)

    with open(save_path, "wb") as f:
        content = await file.read()
        f.write(content)

    relative_path = f"{folder}/{filename}"
    media = models.MediaFile(
        submission_id=submission_id,
        type=media_type,
        path=relative_path,
    )
    db.add(media)
    db.commit()

    return {"path": relative_path}


@router.post("/{submission_id}/complete", response_model=schemas.SubmissionOut)
def complete_submission(submission_id: int, db: Session = Depends(get_db)):
    submission = (
        db.query(models.SurveySubmission)
        .options(joinedload(models.SurveySubmission.answers))
        .filter(models.SurveySubmission.id == submission_id)
        .first()
    )
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    scores = [a.face_score for a in submission.answers if a.face_score is not None]
    overall = round(sum(scores) / len(scores), 2) if scores else 0.0

    submission.completed_at = datetime.now(timezone.utc)
    submission.overall_score = overall
    db.commit()
    db.refresh(submission)
    return submission


@router.get("/{submission_id}/export")
def export_submission(submission_id: int, db: Session = Depends(get_db)):
    submission = (
        db.query(models.SurveySubmission)
        .options(
            joinedload(models.SurveySubmission.answers).joinedload(models.SurveyAnswer.question)
        )
        .filter(models.SurveySubmission.id == submission_id)
        .first()
    )
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    # Build responses list
    responses = []
    for answer in submission.answers:
        responses.append({
            "question": answer.question.question_text,
            "answer": answer.answer,
            "face_detected": answer.face_detected,
            "score": answer.face_score,
            "face_image": answer.face_image_path,
        })

    metadata = {
        "submission_id": str(submission.id),
        "survey_id": str(submission.survey_id),
        "started_at": submission.started_at.isoformat() if submission.started_at else None,
        "completed_at": submission.completed_at.isoformat() if submission.completed_at else None,
        "ip_address": submission.ip_address,
        "device": submission.device,
        "browser": submission.browser,
        "os": submission.os,
        "location": submission.location,
        "responses": responses,
        "overall_score": submission.overall_score,
    }

    # Create temp folder for ZIP contents
    tmp_dir = f"/tmp/export_{submission_id}_{uuid.uuid4().hex}"
    images_dir = os.path.join(tmp_dir, "images")
    os.makedirs(images_dir, exist_ok=True)

    # Write metadata.json
    with open(os.path.join(tmp_dir, "metadata.json"), "w") as f:
        json.dump(metadata, f, indent=2)

    # Copy face images
    for i, answer in enumerate(submission.answers, start=1):
        if answer.face_image_path:
            src = os.path.join(MEDIA_DIR, answer.face_image_path)
            if os.path.exists(src):
                ext = answer.face_image_path.split(".")[-1]
                shutil.copy(src, os.path.join(images_dir, f"q{i}_face.{ext}"))

    # Create ZIP
    zip_path = f"/tmp/submission_{submission_id}.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, _, files in os.walk(tmp_dir):
            for file in files:
                full_path = os.path.join(root, file)
                arcname = os.path.relpath(full_path, tmp_dir)
                zf.write(full_path, arcname)

    shutil.rmtree(tmp_dir)

    return FileResponse(
        zip_path,
        media_type="application/zip",
        filename=f"submission_{submission_id}.zip",
    )