"use client";

import React, { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { UploadZone } from "@/components/UploadZone";
import { ProgressTracker } from "@/components/ProgressTracker";
import { TranscriptionStudio } from "@/components/TranscriptionStudio";
import { extractAudioFromVideo } from "@/lib/audioExtractor";
import { ProcessingStep, TranscriptionResponse } from "@/lib/types";
import { ShieldCheck, Zap, Lock, RefreshCw } from "lucide-react";

export default function Home() {
  const [step, setStep] = useState<ProcessingStep>("idle");
  const [progressPercent, setProgressPercent] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [result, setResult] = useState<TranscriptionResponse | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

  const handleStartProcessing = async (
    file: File,
    options: {
      language: string;
      prompt: string;
      generateSummary: boolean;
      useClientExtraction: boolean;
    }
  ) => {
    setErrorDetails(null);
    setResult(null);

    // Create an object URL for playback
    const localAudioUrl = URL.createObjectURL(file);
    setAudioUrl(localAudioUrl);

    let fileToUpload = file;

    try {
      // 1. Client-Side Audio Extraction (if video and enabled)
      if (options.useClientExtraction && !file.type.startsWith("audio/")) {
        setStep("extracting_audio");
        setStatusMessage("Extrayendo pista de audio en el navegador (Web Audio API)...");
        setProgressPercent(15);

        try {
          fileToUpload = await extractAudioFromVideo(file, (pct) => {
            setProgressPercent(pct);
          });
          setStatusMessage("Audio extraído con éxito. Preparando subida segura...");
        } catch (extractErr) {
          console.warn("Fallo extracción cliente, recurriendo a archivo original:", extractErr);
          fileToUpload = file;
        }
      }

      // 2. Uploading & Processing
      setStep("uploading");
      setStatusMessage("Subiendo archivo al motor de procesamiento...");
      setProgressPercent(35);

      const formData = new FormData();
      formData.append("file", fileToUpload);
      if (options.language) formData.append("language", options.language);
      if (options.prompt) formData.append("prompt", options.prompt);
      formData.append("generate_summary", String(options.generateSummary));

      // Visual simulation stages during server processing
      setStep("compressing");
      setStatusMessage("FFmpeg optimizando audio a 16kHz mono (32kbps)...");
      setProgressPercent(50);

      const response = await fetch(`${backendUrl}/api/transcribe/file`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({ detail: "Error del servidor" }));
        throw new Error(errJson.detail || `Error en la petición: ${response.statusText}`);
      }

      setStep("transcribing");
      setStatusMessage("OpenAI Whisper-1 generando transcripción con marcas de tiempo...");
      setProgressPercent(80);

      if (options.generateSummary) {
        setStep("summarizing");
        setStatusMessage("GPT-4o-mini extrayendo puntos clave, acuerdos y tareas...");
        setProgressPercent(95);
      }

      const data: TranscriptionResponse = await response.json();

      setResult(data);
      setStep("completed");
      setProgressPercent(100);
      setStatusMessage("¡Transcripción y análisis completados!");
    } catch (err: unknown) {
      console.error("Error en pipeline:", err);
      setStep("error");
      const message = err instanceof Error ? err.message : "Error inesperado durante la transcripción.";
      setErrorDetails(message);
    }
  };

  const handleReset = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setResult(null);
    setStep("idle");
    setProgressPercent(0);
    setStatusMessage("");
    setErrorDetails(null);
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {step === "idle" && (
          <div className="space-y-10">
            {/* Hero Header */}
            <div className="text-center max-w-2xl mx-auto space-y-4">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold border border-indigo-200 dark:border-indigo-800">
                <Zap className="w-3.5 h-3.5" />
                <span>Audio Engine Corporativo v1.0</span>
              </div>
              <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
                Convierte tus reuniones y vídeos en{" "}
                <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                  texto y acuerdos
                </span>
              </h1>
              <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400">
                Extracción de audio ultrarrápida, subtítulos sincronizados (SRT/VTT) para Premiere y
                minutas ejecutivas automáticas con la máxima privacidad de datos.
              </p>
            </div>

            {/* Upload Zone */}
            <UploadZone onStartProcessing={handleStartProcessing} isProcessing={false} />

            {/* Trust & Architecture Highlights */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8 border-t border-zinc-200 dark:border-zinc-800/80">
              <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/80 space-y-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h3 className="font-semibold text-sm text-zinc-900 dark:text-white">
                  Privacidad & Zero Data Retention
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  Conexión directa con la API comercial de OpenAI sin reutilización para entrenamiento y
                  borrado automático de archivos tras el procesamiento.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/80 space-y-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Zap className="w-4 h-4" />
                </div>
                <h3 className="font-semibold text-sm text-zinc-900 dark:text-white">
                  Compresión de Voz a 32kbps
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  FFmpeg extrae la pista de voz en mono a 16kHz. 1 hora de audio se comprime a ~14 MB,
                  evitando cortes y desincronización de subtítulos.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/80 space-y-2">
                <div className="w-8 h-8 rounded-lg bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                  <Lock className="w-4 h-4" />
                </div>
                <h3 className="font-semibold text-sm text-zinc-900 dark:text-white">
                  Stack Escalable Vercel + Railway
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  Frontend interactivo en Vercel y motor de FFmpeg en contenedores Docker de Railway con
                  soporte para archivos de hasta 1 GB.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Processing State */}
        {step !== "idle" && step !== "completed" && step !== "error" && (
          <div className="space-y-6">
            <ProgressTracker
              step={step}
              progressPercent={progressPercent}
              statusMessage={statusMessage}
            />
          </div>
        )}

        {/* Error State */}
        {step === "error" && (
          <div className="max-w-lg mx-auto p-6 bg-white dark:bg-zinc-900 rounded-2xl border border-rose-200 dark:border-rose-900 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <RefreshCw className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base text-zinc-900 dark:text-white">
                Error en el procesamiento
              </h3>
              <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">{errorDetails}</p>
            </div>
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-semibold rounded-xl hover:opacity-90"
            >
              Intentar de nuevo
            </button>
          </div>
        )}

        {/* Completed State: Transcription Studio */}
        {step === "completed" && result && (
          <TranscriptionStudio
            data={result}
            audioFileUrl={audioUrl || undefined}
            onReset={handleReset}
          />
        )}
      </main>

      <footer className="border-t border-zinc-200 dark:border-zinc-800 py-6 text-center text-xs text-zinc-500 dark:text-zinc-500">
        Transcriptor Enterprise • Integración Vercel + Railway + OpenAI API
      </footer>
    </div>
  );
}
