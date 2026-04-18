# Video Survey Platform

A privacy-first video survey platform where users complete a 5-question Yes/No survey while face detection runs live via their camera. Built as a full-stack take-home assignment.

---

## Live Demo

Frontend: https://vantage5-survey.netlify.app

Admin Panel: https://vantage5-survey.netlify.app/admin

Backend API Docs: https://vantage5.onrender.com/docs

## Tech Stack

- Frontend: Next.js 14 (App Router), TypeScript, Tailwind CSS, @vladmandic/face-api
- Backend: FastAPI, SQLAlchemy, Python 3.11
- Database: PostgreSQL (Neon)
- Infrastructure: Docker, Docker Compose

---

## Features

- Admin panel to create, configure, and publish surveys
- Live camera feed with real-time face detection
- Face visibility scoring (0-100) per question
- Face snapshot captured and stored for each answer
- Anonymous metadata collection: IP address, browser, OS, device type
- ZIP export per submission containing metadata.json and all face images
- No personal identifiers collected (no name, email, or phone)

---

## Project Structure

```
video-survey/
├── frontend/
│   ├── app/
│   │   ├── admin/
│   │   │   └── page.tsx          # Admin panel: create and publish surveys
│   │   ├── survey/
│   │   │   └── [id]/
│   │   │       └── page.tsx      # Survey flow: intro, questions, completion
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   └── CameraFeed.tsx        # Camera component with face detection UI
│   ├── hooks/
│   │   └── useFaceDetection.ts   # Face detection logic using face-api.js
│   ├── lib/
│   │   └── api.ts                # Axios API client
│   └── public/
│       └── models/               # face-api.js model files (not committed)
│
├── backend/
│   └── app/
│       ├── main.py               # FastAPI app entry point
│       ├── database.py           # SQLAlchemy engine and session
│       ├── models.py             # ORM models
│       ├── schemas.py            # Pydantic request/response schemas
│       └── routers/
│           ├── surveys.py        # Survey CRUD and publish endpoints
│           └── submissions.py    # Submission flow and ZIP export
│
└── docker-compose.yml
```

---

## Database Schema

Five normalized tables:

- surveys: id, title, is_active, created_at
- survey_questions: id, survey_id, question_text, order
- survey_submissions: id, survey_id, ip_address, device, browser, os, location, started_at, completed_at, overall_score
- survey_answers: id, submission_id, question_id, answer, face_detected, face_score, face_image_path
- media_files: id, submission_id, type, path, created_at

Only file paths are stored in the database. The actual images live on the server filesystem.

---

## API Endpoints

Survey endpoints:

- POST /api/surveys — create a new survey
- POST /api/surveys/{id}/questions — add a question to a survey
- GET /api/surveys/{id} — get a survey with its questions
- POST /api/surveys/{id}/publish — publish a survey (requires 5 questions)
- GET /api/surveys — list all surveys

Submission endpoints:

- POST /api/submissions/surveys/{id}/start — start a submission, captures metadata
- POST /api/submissions/{id}/answers — save an answer with face score
- POST /api/submissions/{id}/media — upload a face snapshot
- POST /api/submissions/{id}/complete — complete submission, calculates overall score
- GET /api/submissions/{id}/export — download ZIP with metadata and images

Full interactive API docs available at http://localhost:8000/docs when the backend is running.

---

## Local Setup (Without Docker)

Requirements: Python 3.11+, Node.js 20+, PostgreSQL

**Backend**

```
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
source venv/bin/activate     # Mac/Linux
pip install -r requirements.txt
```

Create a .env file inside the backend folder:

```
DATABASE_URL=postgresql://your_connection_string_here
```

Start the backend:

```
uvicorn app.main:app --reload
```

Backend runs at http://localhost:8000

**Frontend**

```
cd frontend
npm install
```

Copy face detection model files:

```
copy node_modules\@vladmandic\face-api\model\tiny_face_detector_model-weights_manifest.json public\models\
copy node_modules\@vladmandic\face-api\model\tiny_face_detector_model.bin public\models\
copy node_modules\@vladmandic\face-api\model\face_landmark_68_tiny_model-weights_manifest.json public\models\
copy node_modules\@vladmandic\face-api\model\face_landmark_68_tiny_model.bin public\models\
```

Start the frontend:

```
npm run dev
```

Frontend runs at http://localhost:3000

---

## Docker Setup

Requirements: Docker and Docker Compose

```
docker compose up --build
```

| Service  | URL                        |
| -------- | -------------------------- |
| Frontend | http://localhost:3000      |
| Backend  | http://localhost:8000      |
| API Docs | http://localhost:8000/docs |

---

## Usage

1. Open http://localhost:3000/admin
2. Enter a survey title and 5 Yes/No questions
3. Click Create and Publish Survey
4. Copy the share link shown in the success message (e.g. /survey/1)
5. Open the survey link in a new tab or share it with a respondent
6. Grant camera access and complete the survey
7. After completion, click the export link to download the ZIP

---

## Architecture Decisions

**Why FastAPI over Django?**
FastAPI is async-first, has minimal boilerplate, and auto-generates OpenAPI docs at /docs with no extra setup. For a file-upload-heavy API this is a better fit than Django REST Framework.

**Why @vladmandic/face-api over MediaPipe?**
face-api.js runs entirely in the browser with no external API calls, which fits the privacy-first requirement. The vladmandic fork is actively maintained and works well with Next.js. MediaPipe would give better accuracy but requires more complex setup and has larger bundle size.

**Why store file paths in the database instead of files directly?**
Keeps the database lean and makes it straightforward to swap the storage layer to S3 or any object store later without any schema changes.

**Why TinyFaceDetector instead of SSD MobileNet?**
TinyFaceDetector is significantly faster and lighter, which matters for real-time detection running every 800ms in the browser. The trade-off is slightly lower accuracy on unusual angles or lighting, which is acceptable for this use case.

**Why CPU backend for TensorFlow?**
WebGL is not reliably available across all devices and browsers. Falling back to CPU ensures the face detection works everywhere, at the cost of slightly slower inference.

---

## Trade-offs and Known Limitations

- Face detection runs every 800ms. On low-end devices this may feel slightly laggy.
- IP geolocation is stubbed as Unknown. In production this can be extended using a free API like ip-api.com with a single HTTP call per submission.
- No video recording in this MVP. Only face snapshots per question are saved. Full video recording was descoped to reduce complexity.
- The admin panel has no authentication. Do not expose this to the public internet without adding auth.
- Face detection model files are not committed to the repository. They must be copied from node_modules after npm install as described in the setup section.
- The export ZIP is generated and stored in /tmp on the server. For production this should be streamed directly or stored in object storage.
- Docker uses --reload in FastAPI (development mode). This should be removed for production builds.
