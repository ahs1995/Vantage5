"use client";

import { useEffect, useRef } from "react";
import { useFaceDetection, FaceStatus } from "@/hooks/useFaceDetection";

interface CameraFeedProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  onStatusChange: (status: FaceStatus, score: number) => void;
}

const statusConfig: Record<FaceStatus, { text: string; color: string }> = {
  loading: { text: "Starting camera...", color: "text-gray-500" },
  no_face: {
    text: "No face detected. Please look at the camera.",
    color: "text-red-500",
  },
  multiple_faces: {
    text: "Multiple faces detected. Only one person allowed.",
    color: "text-yellow-600",
  },
  ok: { text: "Face detected", color: "text-green-600" },
  error: {
    text: "Face detection error. Please refresh.",
    color: "text-red-500",
  },
};

export default function CameraFeed({
  videoRef,
  onStatusChange,
}: CameraFeedProps) {
  const streamRef = useRef<MediaStream | null>(null);
  const { status, score } = useFaceDetection(videoRef);

  useEffect(() => {
    startCamera();
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    onStatusChange(status, score);
  }, [status, score]);

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      console.error("Camera permission denied or not available.");
    }
  }

  const { text, color } = statusConfig[status];

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative rounded-xl overflow-hidden border-2 border-gray-200 bg-black">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full max-w-sm h-64 object-cover"
        />
        {status === "ok" && (
          <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
            Score: {score}
          </div>
        )}
        {status === "no_face" && (
          <div className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
            No Face
          </div>
        )}
        {status === "multiple_faces" && (
          <div className="absolute top-2 right-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded-full">
            Multiple Faces
          </div>
        )}
      </div>
      <p className={`text-sm font-medium ${color}`}>{text}</p>
    </div>
  );
}
