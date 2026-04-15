import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:8000/api",
});

export interface Survey {
  id: number;
  title: string;
  is_active: boolean;
  created_at: string;
  questions: Question[];
}

export interface Question {
  id: number;
  question_text: string;
  order: number;
}

export interface Submission {
  id: number;
  survey_id: number;
  started_at: string;
  completed_at: string | null;
  overall_score: number | null;
  answers: Answer[];
}

export interface Answer {
  id: number;
  question_id: number;
  answer: string;
  face_detected: boolean;
  face_score: number | null;
  face_image_path: string | null;
}

export const createSurvey = (title: string) =>
  api.post<Survey>("/surveys", { title });

export const addQuestion = (
  surveyId: number,
  question_text: string,
  order: number,
) =>
  api.post<Question>(`/surveys/${surveyId}/questions`, {
    question_text,
    order,
  });

export const publishSurvey = (surveyId: number) =>
  api.post<Survey>(`/surveys/${surveyId}/publish`);

export const getSurvey = (surveyId: number) =>
  api.get<Survey>(`/surveys/${surveyId}`);

export const listSurveys = () => api.get<Survey[]>("/surveys");

export const startSubmission = (surveyId: number) =>
  api.post<Submission>(`/submissions/surveys/${surveyId}/start`);

export const saveAnswer = (
  submissionId: number,
  payload: {
    question_id: number;
    answer: string;
    face_detected: boolean;
    face_score: number | null;
    face_image_path: string | null;
  },
) => api.post<Answer>(`/submissions/${submissionId}/answers`, payload);

export const uploadMedia = (
  submissionId: number,
  file: File,
  media_type: string,
) => {
  const form = new FormData();
  form.append("file", file);
  form.append("media_type", media_type);
  return api.post(`/submissions/${submissionId}/media`, form);
};

export const completeSubmission = (submissionId: number) =>
  api.post<Submission>(`/submissions/${submissionId}/complete`);

export default api;
