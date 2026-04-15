from sqlalchemy.orm import Session, joinedload
from fastapi import APIRouter, Depends, HTTPException
from typing import List

from app.database import get_db
from app import models, schemas

router = APIRouter()


@router.post("", response_model=schemas.SurveyOut, status_code=201)
def create_survey(payload: schemas.SurveyCreate, db: Session = Depends(get_db)):
    survey = models.Survey(title=payload.title)
    db.add(survey)
    db.commit()
    db.refresh(survey)
    return survey


@router.post("/{survey_id}/questions", response_model=schemas.QuestionOut, status_code=201)
def add_question(survey_id: int, payload: schemas.QuestionCreate, db: Session = Depends(get_db)):
    survey = db.query(models.Survey).filter(models.Survey.id == survey_id).first()
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found")
    if len(survey.questions) >= 5:
        raise HTTPException(status_code=400, detail="Survey already has 5 questions")

    question = models.SurveyQuestion(
        survey_id=survey_id,
        question_text=payload.question_text,
        order=payload.order,
    )
    db.add(question)
    db.commit()
    db.refresh(question)
    return question


@router.get("/{survey_id}", response_model=schemas.SurveyOut)
def get_survey(survey_id: int, db: Session = Depends(get_db)):
    survey = (
        db.query(models.Survey)
        .options(joinedload(models.Survey.questions))
        .filter(models.Survey.id == survey_id)
        .first()
    )
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found")
    return survey
    
    

@router.post("/{survey_id}/publish", response_model=schemas.SurveyOut)
def publish_survey(survey_id: int, db: Session = Depends(get_db)):
    survey = db.query(models.Survey).filter(models.Survey.id == survey_id).first()
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found")
    if len(survey.questions) < 5:
        raise HTTPException(status_code=400, detail="Need exactly 5 questions before publishing")

    survey.is_active = True
    db.commit()
    db.refresh(survey)
    return survey


@router.get("", response_model=List[schemas.SurveyOut])
def list_surveys(db: Session = Depends(get_db)):
    return (
        db.query(models.Survey)
        .options(joinedload(models.Survey.questions))
        .order_by(models.Survey.created_at.desc())
        .all()
    )