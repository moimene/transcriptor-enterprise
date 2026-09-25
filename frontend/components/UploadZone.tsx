"use client";

import React, { useState, useRef } from "react";
import {
  UploadCloud,
  FileAudio,
  FileVideo,
  Zap,
  Sparkles,
  AlertCircle,
  Settings2,
  Briefcase,
  FileText,
  Mic,
  Scale
} from "lucide-react";
import { extractAudioFromVideo } from "@/lib/audioExtractor";
import { SummaryType } from "@/lib/types";

interface UploadZoneProps {
  onStartProcessing: (
    file: File,
    options: {
      language: string;
      prompt: string;
      generateSummary: boolean;
      useClientExtraction: boolean;
      summaryType: SummaryType;
    }
  ) => void;
  isProcessing: boolean;
}

export function UploadZone({ onStartProcessing, isProcessing }: UploadZoneProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [language, setLanguage] = useState("es");
  const [prompt, setPrompt] = useState("");
  const [generateSummary, setGenerateSummary] = useState(true);
  const [summaryType, setSummaryType] = useState<SummaryType>("reuniones");
  const [useClientExtraction, setUseClientExtraction] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const validateAndSetFile = (file: File) => {
    setErrorMsg(null);
    const validExtensions = [".mp4", ".mp3", ".wav", ".m4a", ".mov", ".webm", ".ogg", ".aac", ".flac"];
    const ext = "." + (file.name.split(".").pop()?.toLowerCase() || "");

    if (!validExtensions.includes(ext)) {
      setErrorMsg(`Formato ${ext} no soportado. Formatos válidos: MP4, MP3, WAV, M4A, MOV, WebM.`);
      return;
    }

    // 1 GB limit
    if (file.size > 1024 * 1024 * 1024) {
      setErrorMsg("El archivo supera el límite de 1 GB permitido.");
      return;
    }

    setSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    onStartProcessing(selectedFile, {
      language,
      prompt,
      generateSummary,
      useClientExtraction,
      summaryType
    });
  };

  const isVideo = selectedFile && !selectedFile.type.startsWith("audio/");
  const fileSizeMb = selectedFile ? (selectedFile.size / (1024 * 1024)).toFixed(1) : "0";

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Drag & Drop Container */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-200 ${
            dragActive
              ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/20 scale-[1.01]"
              : selectedFile
              ? "border-emerald-400 bg-emerald-50/20 dark:bg-emerald-950/10"
              : "border-zinc-300 dark:border-zinc-800 hover:border-indigo-400 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900/50"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,video/*,.mp4,.mp3,.wav,.m4a,.mov,.webm,.ogg"
            onChange={handleChange}
            className="hidden"
            disabled={isProcessing}
          />

          <div className="flex flex-col items-center justify-center space-y-3">
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors ${
                selectedFile
                  ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400"
                  : "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400"
              }`}
            >
              {selectedFile ? (
                isVideo ? (
                  <FileVideo className="w-8 h-8" />
                ) : (
                  <FileAudio className="w-8 h-8" />
                )
              ) : (
                <UploadCloud className="w-8 h-8" />
              )}
            </div>

            {selectedFile ? (
              <div>
                <p className="font-semibold text-zinc-900 dark:text-zinc-100 text-base">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  Tamaño: {fileSizeMb} MB • {isVideo ? "Vídeo detectado" : "Audio detectado"}
                </p>
              </div>
            ) : (
              <div>
                <p className="font-semibold text-zinc-900 dark:text-zinc-100 text-base">
                  Arrastra tu archivo aquí o haz clic para explorar
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  MP4, MP3, WAV, M4A, MOV, WebM • Hasta 1 GB por archivo
                </p>
              </div>
            )}
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Client-Side Extraction Badge / Toggle */}
        {selectedFile && isVideo && (
          <div className="p-4 bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/20 dark:to-violet-950/20 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 flex items-start justify-between gap-4">
            <div className="flex items-start space-x-3">
              <div className="p-2 rounded-xl bg-indigo-600 text-white shrink-0 mt-0.5">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                  Extracción Inteligente en Navegador
                </span>
                <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-0.5">
                  Extrae la pista de audio localmente antes de subir. Reduce la subida de{" "}
                  <strong>{fileSizeMb} MB</strong> a <strong>~20-30 MB</strong>, ahorrando el 90%
                  del tiempo de transferencia.
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
              <input
                type="checkbox"
                checked={useClientExtraction}
                onChange={(e) => setUseClientExtraction(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-zinc-200 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600" />
            </label>
          </div>
        )}

        {/* Configuration Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Language Selector */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
              Idioma del Audio
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
            >
              <option value="es">Español (Recomendado)</option>
              <option value="en">Inglés</option>
              <option value="fr">Francés</option>
              <option value="de">Alemán</option>
              <option value="it">Italiano</option>
              <option value="pt">Portugués</option>
              <option value="ca">Catalán</option>
            </select>
          </div>

          {/* AI Summary Toggle */}
          <div className="flex flex-col justify-end">
            <label className="flex items-center space-x-3 p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 cursor-pointer">
              <input
                type="checkbox"
                checked={generateSummary}
                onChange={(e) => setGenerateSummary(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
              />
              <div className="flex items-center space-x-1.5">
                <Sparkles className="w-4 h-4 text-violet-500" />
                <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200">
                  Generar Análisis con GPT-4o-mini
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* AI Summary Template Selector */}
        {generateSummary && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Plantilla de Análisis IA
              </label>
              <span className="text-[11px] text-zinc-500">
                Selecciona el enfoque según la naturaleza de la grabación
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {/* Option 1: reuniones */}
              <button
                type="button"
                onClick={() => setSummaryType("reuniones")}
                className={`p-3 text-left rounded-xl border transition-all flex flex-col justify-between ${
                  summaryType === "reuniones"
                    ? "border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-200 ring-1 ring-indigo-600 shadow-xs"
                    : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700"
                }`}
              >
                <div className="flex items-center space-x-2 mb-1.5">
                  <div
                    className={`p-1.5 rounded-lg ${
                      summaryType === "reuniones"
                        ? "bg-indigo-600 text-white"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    <Briefcase className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-bold">Minuta & Acuerdos</span>
                </div>
                <p className="text-[11px] leading-tight text-zinc-500 dark:text-zinc-400">
                  Reuniones ejecutivas, tareas y compromisos con plazos.
                </p>
              </button>

              {/* Option 2: general */}
              <button
                type="button"
                onClick={() => setSummaryType("general")}
                className={`p-3 text-left rounded-xl border transition-all flex flex-col justify-between ${
                  summaryType === "general"
                    ? "border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-200 ring-1 ring-indigo-600 shadow-xs"
                    : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700"
                }`}
              >
                <div className="flex items-center space-x-2 mb-1.5">
                  <div
                    className={`p-1.5 rounded-lg ${
                      summaryType === "general"
                        ? "bg-indigo-600 text-white"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-bold">Resumen General</span>
                </div>
                <p className="text-[11px] leading-tight text-zinc-500 dark:text-zinc-400">
                  Síntesis integral, bloques temáticos y conclusiones clave.
                </p>
              </button>

              {/* Option 3: podcast */}
              <button
                type="button"
                onClick={() => setSummaryType("podcast")}
                className={`p-3 text-left rounded-xl border transition-all flex flex-col justify-between ${
                  summaryType === "podcast"
                    ? "border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-200 ring-1 ring-indigo-600 shadow-xs"
                    : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700"
                }`}
              >
                <div className="flex items-center space-x-2 mb-1.5">
                  <div
                    className={`p-1.5 rounded-lg ${
                      summaryType === "podcast"
                        ? "bg-indigo-600 text-white"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    <Mic className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-bold">Podcast / Charla</span>
                </div>
                <p className="text-[11px] leading-tight text-zinc-500 dark:text-zinc-400">
                  Momentos memorables, citas textuales y lecciones aprendidas.
                </p>
              </button>

              {/* Option 4: interrogatorios */}
              <button
                type="button"
                onClick={() => setSummaryType("interrogatorios")}
                className={`p-3 text-left rounded-xl border transition-all flex flex-col justify-between ${
                  summaryType === "interrogatorios"
                    ? "border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-200 ring-1 ring-indigo-600 shadow-xs"
                    : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700"
                }`}
              >
                <div className="flex items-center space-x-2 mb-1.5">
                  <div
                    className={`p-1.5 rounded-lg ${
                      summaryType === "interrogatorios"
                        ? "bg-indigo-600 text-white"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    <Scale className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-bold">Interrogatorio</span>
                </div>
                <p className="text-[11px] leading-tight text-zinc-500 dark:text-zinc-400">
                  Hechos declarados, contradicciones y valoración probatoria.
                </p>
              </button>
            </div>
          </div>
        )}

        {/* Advanced Options Accordion */}
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 bg-zinc-50/50 dark:bg-zinc-900/30">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full flex items-center justify-between text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
          >
            <span className="flex items-center space-x-1.5">
              <Settings2 className="w-4 h-4" />
              <span>Glosario Corporativo y Vocabulario Técnico (Opcional)</span>
            </span>
            <span>{showAdvanced ? "Ocultar" : "Mostrar"}</span>
          </button>

          {showAdvanced && (
            <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Introduce nombres propios, acrónimos o términos específicos de tu empresa para guiar al
                modelo Whisper y evitar errores ortográficos.
              </p>
              <input
                type="text"
                placeholder="Ej: Antigravity, Q3 EBITDA, Next.js, FastAPI, Vercel, Railway, Moises"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
              />
            </div>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!selectedFile || isProcessing}
          className="w-full py-3.5 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium text-sm shadow-lg shadow-indigo-600/25 transition-all active:scale-[0.99] flex items-center justify-center space-x-2"
        >
          <Sparkles className="w-4 h-4" />
          <span>Iniciar Transcripción Segura</span>
        </button>
      </form>
    </div>
  );
}
