"use client";

import { useState, useRef } from "react";

interface VoiceCommandProps {
  onCommand: (text: string) => void;
  disabled?: boolean;
}

export function VoiceCommand({ onCommand, disabled }: VoiceCommandProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  function startRecording() {
    const SpeechRecognition =
      (window as typeof window & { SpeechRecognition?: new () => SpeechRecognition }).SpeechRecognition ||
      (window as typeof window & { webkitSpeechRecognition?: new () => SpeechRecognition }).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setTranscript("Speech recognition not supported");
      return;
    }

    setTranscript("");
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const text = event.results[0][0].transcript;
      setTranscript(text);
      if (text.trim()) onCommand(text.trim());
    };

    recognition.onerror = () => {
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  }

  function stopRecording() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsRecording(false);
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onMouseDown={startRecording}
        onMouseUp={stopRecording}
        onMouseLeave={() => isRecording && stopRecording()}
        onTouchStart={(e) => {
          e.preventDefault();
          startRecording();
        }}
        onTouchEnd={(e) => {
          e.preventDefault();
          stopRecording();
        }}
        disabled={disabled}
        className={`rounded-lg border px-4 py-2 font-medium transition ${
          isRecording
            ? "border-red-500/50 bg-red-600 text-white animate-pulse"
            : "border-gray-600 bg-gray-700 text-white hover:bg-gray-600"
        } disabled:opacity-50`}
      >
        {isRecording ? "🎙️ Recording..." : "🎙️ Hold to Speak"}
      </button>
      {transcript && (
        <span className="max-w-xs truncate text-sm text-gray-400">&ldquo;{transcript}&rdquo;</span>
      )}
    </div>
  );
}
