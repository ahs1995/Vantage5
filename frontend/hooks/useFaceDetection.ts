"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export type FaceStatus =
  | "loading"
  | "no_face"
  | "multiple_faces"
  | "ok"
  | "error";

let modelsLoaded = false;

async function loadModels() {
  if (modelsLoaded) return;
  const faceapi = await import("@vladmandic/face-api");

  // Force CPU backend since WebGL may not be available
  const tf = await import("@tensorflow/tfjs-core");
  await import("@tensorflow/tfjs-backend-cpu");
  await tf.setBackend("cpu");
  await tf.ready();

  const MODEL_URL = "/models";
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
  ]);
  modelsLoaded = true;
}

export function useFaceDetection(videoRef: React.RefObject<HTMLVideoElement>) {
  const [status, setStatus] = useState<FaceStatus>("loading");
  const [score, setScore] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let active = true;

    async function init() {
      try {
        await loadModels();
        if (!active) return;
        startDetection();
      } catch {
        setStatus("error");
      }
    }

    init();

    return () => {
      active = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  function startDetection() {
    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(async () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;

      try {
        const faceapi = await import("@vladmandic/face-api");
        const detections = await faceapi
          .detectAllFaces(
            video,
            new faceapi.TinyFaceDetectorOptions({
              inputSize: 320,
              scoreThreshold: 0.2,
            }),
          )
          .withFaceLandmarks(true);

        if (detections.length === 0) {
          setStatus("no_face");
          setScore(0);
        } else if (detections.length > 1) {
          setStatus("multiple_faces");
          setScore(0);
        } else {
          const confidence = detections[0].detection.score;
          setScore(Math.round(confidence * 100));
          setStatus("ok");
        }
      } catch {
        setStatus("error");
      }
    }, 800);
  }

  const captureSnapshot = useCallback(async (): Promise<Blob | null> => {
    const video = videoRef.current;
    if (!video) return null;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/png");
    });
  }, [videoRef]);

  return { status, score, captureSnapshot };
}
