"use client";

import React from "react";
import { CheckCircle2, Loader2, Upload, Disc3, Sparkles, FileText } from "lucide-react";
import { ProcessingStep } from "@/lib/types";

interface ProgressTrackerProps {
  step: ProcessingStep;
  progressPercent: number;
  statusMessage: string;
}

const STEPS = [
  { id: "uploading", label: "Carga Segura", icon: Upload },
  { id: "compressing", label: "Compresión FFmpeg (32k mono)", icon: Disc3 },
  { id: "transcribing", label: "Whisper-1 con Timestamps", icon: FileText },
  { id: "summarizing", label: "Minuta & Acuerdos IA", icon: Sparkles },
];

export function ProgressTracker({ step, progressPercent, statusMessage }: ProgressTrackerProps) {
  const getStepStatus = (stepId: string) => {
    const order = ["idle", "extracting_audio", "uploading", "compressing", "transcribing", "summarizing", "completed"];
    const currentIndex = order.indexOf(step);
    const stepIndex = order.indexOf(stepId);

    if (step === "completed" || currentIndex > stepIndex) return "completed";
    if (currentIndex === stepIndex) return "active";
    return "pending";
  };

  return (
    <div className="w-full max-w-3xl mx-auto p-6 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xl shadow-zinc-200/50 dark:shadow-none my-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center space-x-2">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
            <span>Procesando archivo audiovisual</span>
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{statusMessage}</p>
        </div>
        <span className="text-sm font-bold font-mono text-indigo-600 dark:text-indigo-400">
          {Math.round(progressPercent)}%
        </span>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden mb-6">
        <div
          className="h-full bg-gradient-to-r from-indigo-600 to-violet-500 transition-all duration-300 ease-out rounded-full"
          style={{ width: `${Math.min(100, Math.max(5, progressPercent))}%` }}
        />
      </div>

      {/* Step Indicators */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {STEPS.map((s) => {
          const status = getStepStatus(s.id);
          const Icon = s.icon;

          return (
            <div
              key={s.id}
              className={`p-3 rounded-xl border flex flex-col items-center text-center transition-all ${
                status === "active"
                  ? "bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-300 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200 ring-2 ring-indigo-500/20"
                  : status === "completed"
                  ? "bg-emerald-50/40 dark:bg-emerald-950/10 border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300"
                  : "bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-600"
              }`}
            >
              <div className="mb-1.5">
                {status === "completed" ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                ) : status === "active" ? (
                  <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                ) : (
                  <Icon className="w-5 h-5 opacity-60" />
                )}
              </div>
              <span className="text-xs font-medium leading-tight">{s.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
