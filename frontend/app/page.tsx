"use client";

import React, { useState, useEffect, useRef } from "react";
import { Navbar } from "@/components/Navbar";
import { UploadZone } from "@/components/UploadZone";
import { ProgressTracker } from "@/components/ProgressTracker";
import { TranscriptionStudio } from "@/components/TranscriptionStudio";
import { extractAudioFromVideo } from "@/lib/audioExtractor";
import { ProcessingStep, TranscriptionResponse } from "@/lib/types";
import { ShieldCheck, Zap, Lock, RefreshCw, BookmarkCheck, Trash2 } from "lucide-react";

const STORAGE_KEY = "transcriptor_saved_session";

export default function Home() {
  const [step, setStep] = useState<ProcessingStep>("idle");
  const [progressPercent, setProgressPercent] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [result, setResult] = useState<TranscriptionResponse | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [restoredFromStorage, setRestoredFromStorage] = useState(false);

  const audioUrlRef = useRef<string | null>(null);
  audioUrlRef.current = audioUrl;

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
  const internalApiKey = process.env.NEXT_PUBLIC_INTERNAL_API_KEY || "";

  // 1. Restore saved session from localStorage on initial load
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.result?.transcription?.text) {
          setResult(parsed.result);
          setStep("completed");
          setRestoredFromStorage(true);
        }
      }
    } catch (e) {
      console.warn("No se pudo restaurar la sesión guardada:", e);
    }

    return () => {
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }
    };
  }, []);

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
    setRestoredFromStorage(false);

    // Revoke previous audio URL if any
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
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

      // 2. Uploading & Server Processing
      setStep("uploading");
      setStatusMessage("Subiendo archivo al motor de procesamiento...");
      setProgressPercent(30);

      const formData = new FormData();
      formData.append("file", fileToUpload);
      if (options.language) formData.append("language", options.language);
      if (options.prompt) formData.append("prompt", options.prompt);
      formData.append("generate_summary", String(options.generateSummary));

      // Animated progress transition during server processing
      setStep("compressing");
      setStatusMessage("Optimizando y analizando audio en el servidor...");
      setProgressPercent(50);

      const headers: HeadersInit = {};
      if (internalApiKey) {
        headers["X-API-Key"] = internalApiKey;
      }

      const response = await fetch(`${backendUrl}/api/transcribe/file`, {
        method: "POST",
        headers,
        body: formData,
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({ detail: "Error del servidor" }));
        let errMsg = "Error en la petición";
        if (typeof errJson.detail === "string") {
          errMsg = errJson.detail;
        } else if (Array.isArray(errJson.detail)) {
          errMsg = errJson.detail.map((e: any) => e.msg || JSON.stringify(e)).join(", ");
        } else if (errJson.detail) {
          errMsg = JSON.stringify(errJson.detail);
        }
        throw new Error(errMsg);
      }

      setStep("transcribing");
      setStatusMessage("Whisper procesando transcripción y marcas de tiempo...");
      setProgressPercent(80);

      if (options.generateSummary) {
        setStep("summarizing");
        setStatusMessage("GPT-4o-mini generando puntos clave y acuerdos...");
        setProgressPercent(95);
      }

      const data: TranscriptionResponse = await response.json();

      // Persist in localStorage for resilience against accidental refreshes
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            result: data,
            filename: file.name,
            savedAt: new Date().toISOString(),
          })
        );
      } catch (storageErr) {
        console.warn("No se pudo guardar la transcripción en localStorage:", storageErr);
      }

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
    setRestoredFromStorage(false);
  };

  const handleClearSavedSession = () => {
    localStorage.removeItem(STORAGE_KEY);
    handleReset();
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {restoredFromStorage && step === "completed" && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
            <div className="flex items-center space-x-2.5 text-emerald-800 dark:text-emerald-300 text-xs sm:text-sm font-medium">
              <BookmarkCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Sesión anterior recuperada automáticamente de la memoria local del navegador.</span>
            </div>
            <button
              onClick={handleClearSavedSession}
              className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900 transition-colors"
              title="Borrar memoria local y comenzar de cero"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Nueva transcripción</span>
            </button>
          </div>
        )}

        {step === "idle" && (
          <div className="space-y-10">
            {/* Hero Header */}
            <div className="text-center max-w-2xl mx-auto space-y-4">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold border border-indigo-200 dark:border-indigo-800">
                <Zap className="w-3.5 h-3.5" />
                <span>Audio Engine Corporativo v1.1</span>
              </div>
              <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
                Convierte tus reuniones y vídeos en{" "}
                <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                  texto y acuerdos
                </span>
              </h1>
              <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400">
                Extracción de audio de alta fidelidad, subtítulos sincronizados (SRT/VTT) y
                minutas ejecutivas automáticas con persistencia de datos y privacidad estricta.
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
                  Persistencia & Memoria Local
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  Base de datos estructurada en el servidor y almacenamiento local en navegador para no
                  perder nunca tu transcripción ante un refresco accidental de pantalla.
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
