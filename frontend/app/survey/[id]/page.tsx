"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import CameraFeed from "@/components/CameraFeed";
import { FaceStatus } from "@/hooks/useFaceDetection";
import {
  getSurvey,
  startSubmission,
  saveAnswer,
  uploadMedia,
  completeSubmission,
  Survey,
} from "@/lib/api";

type Step = "intro" | "question" | "done";

export default function SurveyPage() {
  const params = useParams();
  const surveyId = Number(params.id);

  const [survey, setSurvey] = useState<Survey | null>(null);
  const [step, setStep] = useState<Step>("intro");
  const [currentQ, setCurrentQ] = useState(0);
  const [submissionId, setSubmissionId] = useState<number | null>(null);
  const [faceStatus, setFaceStatus] = useState<FaceStatus>("loading");
  const [faceScore, setFaceScore] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    getSurvey(surveyId)
      .then((res) => setSurvey(res.data))
      .catch(() => setPageError("Survey not found or not available."));
  }, [surveyId]);

  async function handleStart() {
    setLoading(true);
    try {
      const res = await startSubmission(surveyId);
      setSubmissionId(res.data.id);
      setStep("question");
    } catch {
      setPageError("Could not start survey. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAnswer(answer: "Yes" | "No") {
    if (!submissionId || !survey) return;

    if (faceStatus !== "ok") {
      setError("Please ensure your face is clearly visible before answering.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Capture face snapshot
      let imagePath: string | null = null;
      const video = videoRef.current;

      if (video) {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(video, 0, 0);

        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/png"),
        );

        if (blob) {
          const file = new File([blob], `q${currentQ + 1}_face.png`, {
            type: "image/png",
          });
          const uploadRes = await uploadMedia(submissionId, file, "image");
          imagePath = uploadRes.data.path;
        }
      }

      // Save the answer
      const question = survey.questions[currentQ];
      await saveAnswer(submissionId, {
        question_id: question.id,
        answer,
        face_detected: true,
        face_score: faceScore,
        face_image_path: imagePath,
      });

      // Move to next question or finish
      if (currentQ < 4) {
        setCurrentQ((prev) => prev + 1);
      } else {
        await completeSubmission(submissionId);
        setStep("done");
      }
    } catch {
      setError("Failed to save answer. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (pageError) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <p className="text-red-500 text-lg">{pageError}</p>
      </main>
    );
  }

  if (!survey) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Loading survey...</p>
      </main>
    );
  }

  return (
    <main className="max-w-lg mx-auto py-10 px-4">
      {step === "intro" && (
        <div className="bg-white rounded-xl shadow p-8 text-center space-y-4">
          <h1 className="text-2xl font-bold text-gray-800">{survey.title}</h1>
          <p className="text-gray-500 text-sm">
            You will answer 5 Yes/No questions. Your camera will be active
            throughout. No personal information is collected.
          </p>
          <ul className="text-left text-sm text-gray-600 space-y-1 list-disc list-inside">
            <li>Allow camera access when prompted</li>
            <li>Ensure only your face is visible</li>
            <li>Answer each question honestly</li>
          </ul>
          <button
            onClick={handleStart}
            disabled={loading}
            className="w-full mt-4 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? "Starting..." : "Start Survey"}
          </button>
        </div>
      )}

      {step === "question" && (
        <div className="space-y-6">
          {/* Progress bar */}
          <div className="flex items-center gap-2">
            {survey.questions.map((_, i) => (
              <div
                key={i}
                className={`h-2 flex-1 rounded-full transition-all ${
                  i < currentQ
                    ? "bg-blue-500"
                    : i === currentQ
                      ? "bg-blue-300"
                      : "bg-gray-200"
                }`}
              />
            ))}
          </div>
          <p className="text-xs text-gray-500 text-right">
            Question {currentQ + 1} of 5
          </p>

          {/* Camera */}
          <CameraFeed
            videoRef={videoRef}
            onStatusChange={(s, score) => {
              setFaceStatus(s);
              setFaceScore(score);
            }}
          />

          {/* Question and answer buttons */}
          <div className="bg-white rounded-xl shadow p-6 space-y-4">
            <p className="text-lg font-semibold text-gray-800">
              {survey.questions[currentQ]?.question_text}
            </p>

            {error && (
              <p className="text-sm text-red-500 bg-red-50 rounded px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => handleAnswer("Yes")}
                disabled={loading || faceStatus !== "ok"}
                className="flex-1 bg-green-500 text-white py-3 rounded-lg hover:bg-green-600 transition disabled:opacity-40"
              >
                Yes
              </button>
              <button
                onClick={() => handleAnswer("No")}
                disabled={loading || faceStatus !== "ok"}
                className="flex-1 bg-red-400 text-white py-3 rounded-lg hover:bg-red-500 transition disabled:opacity-40"
              >
                No
              </button>
            </div>

            {faceStatus !== "ok" && (
              <p className="text-xs text-center text-gray-400">
                Buttons will unlock once your face is detected
              </p>
            )}
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="bg-white rounded-xl shadow p-8 text-center space-y-4">
          <div className="text-5xl">✅</div>
          <h2 className="text-2xl font-bold text-gray-800">Thank you!</h2>
          <p className="text-gray-500">Your responses have been recorded.</p>
          {submissionId && (
            <a
              href={`http://localhost:8000/api/submissions/${submissionId}/export`}
              className="inline-block mt-4 text-sm text-blue-600 hover:underline"
            >
              Download session export (ZIP)
            </a>
          )}
        </div>
      )}
    </main>
  );
}
