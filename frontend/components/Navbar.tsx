"use client";

import React from "react";
import { ShieldCheck, Cpu, Mic } from "lucide-react";

export function Navbar() {
  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
            <Mic className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-lg tracking-tight text-zinc-900 dark:text-white">
                Transcriptor
              </span>
              <span className="px-2 py-0.5 text-xs font-semibold uppercase tracking-wider rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/50">
                Enterprise
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Vercel + Railway + OpenAI Audio Engine
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Security Pill */}
          <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-medium border border-emerald-200 dark:border-emerald-800">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>OpenAI Zero Retention Activo</span>
          </div>

          {/* Model Pill */}
          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 text-xs font-mono border border-zinc-200 dark:border-zinc-800">
            <Cpu className="w-3.5 h-3.5 text-indigo-500" />
            <span>whisper-1 + gpt-4o-mini</span>
          </div>
        </div>
      </div>
    </header>
  );
}
