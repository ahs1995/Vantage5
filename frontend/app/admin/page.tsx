"use client";

import { useState, useEffect } from "react";
import {
  createSurvey,
  addQuestion,
  publishSurvey,
  listSurveys,
  Survey,
} from "@/lib/api";

const EMPTY_QUESTIONS = ["", "", "", "", ""];

export default function AdminPage() {
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState<string[]>([...EMPTY_QUESTIONS]);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    fetchSurveys();
  }, []);

  async function fetchSurveys() {
    try {
      const res = await listSurveys();
      setSurveys(res.data);
    } catch {
      // silently fail
    }
  }

  function updateQuestion(index: number, value: string) {
    const updated = [...questions];
    updated[index] = value;
    setQuestions(updated);
  }

  async function handleSubmit() {
    if (!title.trim()) {
      setMessage({ type: "error", text: "Survey title is required." });
      return;
    }
    if (questions.some((q) => !q.trim())) {
      setMessage({ type: "error", text: "All 5 questions are required." });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const surveyRes = await createSurvey(title.trim());
      const surveyId = surveyRes.data.id;

      for (let i = 0; i < 5; i++) {
        await addQuestion(surveyId, questions[i].trim(), i + 1);
      }

      await publishSurvey(surveyId);

      setMessage({
        type: "success",
        text: `Survey created! Share this link: /survey/${surveyId}`,
      });
      setTitle("");
      setQuestions([...EMPTY_QUESTIONS]);
      fetchSurveys();
    } catch (err: any) {
      const detail = err?.response?.data?.detail || "Something went wrong.";
      setMessage({ type: "error", text: detail });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="max-w-2xl mx-auto py-10 px-4">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">
        Admin — Create Survey
      </h1>

      <div className="bg-white rounded-xl shadow p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Survey Title
          </label>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. Customer Feedback Survey"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            5 Yes/No Questions
          </label>
          {questions.map((q, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-sm text-gray-500 w-4">{i + 1}.</span>
              <input
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={`Question ${i + 1}`}
                value={q}
                onChange={(e) => updateQuestion(i, e.target.value)}
              />
            </div>
          ))}
        </div>

        {message && (
          <div
            className={`rounded-lg px-4 py-3 text-sm ${
              message.type === "success"
                ? "bg-green-50 text-green-800 border border-green-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            {message.text}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create & Publish Survey"}
        </button>
      </div>

      {surveys.length > 0 && (
        <div className="mt-10">
          <h2 className="text-lg font-semibold text-gray-700 mb-3">
            Existing Surveys
          </h2>
          <div className="space-y-2">
            {surveys.map((s) => (
              <div
                key={s.id}
                className="bg-white rounded-lg shadow px-4 py-3 flex items-center justify-between"
              >
                <div>
                  <p className="font-medium text-gray-800">{s.title}</p>
                  <p className="text-xs text-gray-500">
                    ID: {s.id} · {s.is_active ? "Published" : "Draft"}
                  </p>
                </div>
                {s.is_active && (
                  <a
                    href={`/survey/${s.id}`}
                    target="_blank"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Open Link →
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
