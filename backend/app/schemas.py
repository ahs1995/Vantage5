from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class QuestionCreate(BaseModel):
    question_text: str
    order: int


class QuestionOut(BaseModel):
    id: int
    question_text: str
    order: int

    model_config = {"from_attributes": True}


class SurveyCreate(BaseModel):
    title: str


class SurveyOut(BaseModel):
    id: int
    title: str
    is_active: bool
    created_at: datetime
    questions: List[QuestionOut] = []

    model_config = {"from_attributes": True}


class AnswerCreate(BaseModel):
    question_id: int
    answer: str
    face_detected: bool
    face_score: Optional[float] = None
    face_image_path: Optional[str] = None


class AnswerOut(BaseModel):
    id: int
    question_id: int
    answer: str
    face_detected: bool
    face_score: Optional[float]
    face_image_path: Optional[str]

    model_config = {"from_attributes": True}


class SubmissionOut(BaseModel):
    id: int
    survey_id: int
    ip_address: Optional[str]
    device: Optional[str]
    browser: Optional[str]
    os: Optional[str]
    location: Optional[str]
    started_at: datetime
    completed_at: Optional[datetime]
    overall_score: Optional[float]
    answers: List[AnswerOut] = []

    model_config = {"from_attributes": True}