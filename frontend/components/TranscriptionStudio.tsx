"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Search,
  Download,
  Copy,
  Check,
  FileText,
  Clock,
  Sparkles,
  CheckSquare,
  DollarSign,
  Share2,
  Edit3,
  AlertTriangle,
  Quote,
  HelpCircle,
  Scale,
  Lightbulb,
  Bookmark,
  Layers
} from "lucide-react";
import { TranscriptionResponse, Segment } from "@/lib/types";

interface TranscriptionStudioProps {
  data: TranscriptionResponse;
  audioFileUrl?: string;
  onReset: () => void;
}

export function TranscriptionStudio({ data, audioFileUrl, onReset }: TranscriptionStudioProps) {
  const [activeTab, setActiveTab] = useState<"transcript" | "subtitles" | "summary" | "export">("transcript");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);

  // Editable segments
  const [segments, setSegments] = useState<Segment[]>(data.transcription.segments);
  const [isEditing, setIsEditing] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const duration = data.media_info.duration_seconds || data.transcription.duration || 1;

  // Sync audio time update
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const seekTo = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, Math.min(seconds, duration));
      setCurrentTime(audioRef.current.currentTime);
      if (!isPlaying) {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const changeSpeed = (rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  };

  const skipSeconds = (secs: number) => {
    if (audioRef.current) {
      seekTo(audioRef.current.currentTime + secs);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Re-generate export texts if segments were edited
  const getFullText = () => segments.map((s) => s.text).join(" ");

  const getSrtText = () => {
    return segments
      .map((s, idx) => {
        const start = formatTimestampSrt(s.start);
        const end = formatTimestampSrt(s.end);
        return `${idx + 1}\n${start} --> ${end}\n${s.text}\n`;
      })
      .join("\n");
  };

  const getVttText = () => {
    return (
      "WEBVTT\n\n" +
      segments
        .map((s) => {
          const start = formatTimestampVtt(s.start);
          const end = formatTimestampVtt(s.end);
          return `${start} --> ${end}\n${s.text}\n`;
        })
        .join("\n")
    );
  };

  const getMarkdownSummary = () => {
    if (!data.summary) return getFullText();
    const s = data.summary;
    const type = s.summary_type || "reuniones";

    if (type === "general") {
      let md = `# ${s.title}\n\n## Resumen General\n${s.summary}\n\n`;
      if (s.key_points?.length) {
        md += `## Puntos Principales\n` + s.key_points.map((p) => `- ${p}`).join("\n") + "\n\n";
      }
      if (s.topics?.length) {
        md += `## Bloques Temáticos\n` + s.topics.map((t) => `### ${t.title}\n${t.description}`).join("\n\n") + "\n\n";
      }
      if (s.conclusions?.length) {
        md += `## Conclusiones\n` + s.conclusions.map((c) => `- ${c}`).join("\n") + "\n\n";
      }
      return md;
    }

    if (type === "podcast") {
      let md = `# ${s.title}\n\n## Sinopsis Editorial\n${s.summary}\n\n`;
      if (s.key_points?.length) {
        md += `## Ideas Clave\n` + s.key_points.map((p) => `- ${p}`).join("\n") + "\n\n";
      }
      if (s.topics?.length) {
        md += `## Temas Tratados\n` + s.topics.map((t) => `### ${t.title} ${t.timestamp ? `(${t.timestamp})` : ""}\n${t.description}`).join("\n\n") + "\n\n";
      }
      if (s.quotes?.length) {
        md += `## Citas Memorables\n` + s.quotes.map((q) => `> "${q.quote}"\n> — **${q.speaker || "Interviniente"}** ${q.context ? `_(${q.context})_` : ""}`).join("\n\n") + "\n\n";
      }
      if (s.takeaways?.length) {
        md += `## Aprendizajes Clave\n` + s.takeaways.map((t) => `- ${t}`).join("\n") + "\n\n";
      }
      return md;
    }

    if (type === "interrogatorios") {
      let md = `# ${s.title}\n\n## Resumen de la Declaración\n${s.summary}\n\n`;
      if (s.key_points?.length) {
        md += `## Hechos Relevantes\n` + s.key_points.map((p) => `- ${p}`).join("\n") + "\n\n";
      }
      if (s.declared_facts?.length) {
        md += `## Hechos Declarados\n` + s.declared_facts.map((f) => `- **${f.speaker || "Declarante"}**: ${f.fact} ${f.context ? `_(${f.context})_` : ""}`).join("\n") + "\n\n";
      }
      if (s.contradictions?.length) {
        md += `## Contradicciones e Inconsistencias Detectadas\n` + s.contradictions.map((c) => `### Discrepancia: ${c.issue}\n- **Detalle**: ${c.detail}\n${c.parties_involved?.length ? `- **Partes**: ${c.parties_involved.join(", ")}` : ""}`).join("\n\n") + "\n\n";
      }
      if (s.key_questions?.length) {
        md += `## Preguntas Clave\n` + s.key_questions.map((q) => `**P: ${q.question}**\n- **Respuesta**: ${q.answer}\n${q.implication ? `- **Implicación**: ${q.implication}` : ""}`).join("\n\n") + "\n\n";
      }
      if (s.evidence_assessment) {
        md += `## Valoración Probatoria\n${s.evidence_assessment}\n\n`;
      }
      return md;
    }

    // Default: reuniones
    let md = `# ${s.title}\n\n## Resumen Ejecutivo\n${s.summary}\n\n`;
    if (s.key_points?.length) {
      md += `## Puntos Clave\n` + s.key_points.map((p) => `- ${p}`).join("\n") + "\n\n";
    }
    if (s.decisions?.length) {
      md += `## Decisiones Tomadas\n` + s.decisions.map((d) => `- ${d}`).join("\n") + "\n\n";
    }
    if (s.action_items?.length) {
      md +=
        `## Tareas y Acuerdos\n| Tarea | Responsable | Plazo |\n|---|---|---|\n` +
        s.action_items.map((a) => `| ${a.task} | ${a.owner} | ${a.deadline} |`).join("\n") +
        "\n\n";
    }
    return md;
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = (text: string, formatName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedFormat(formatName);
    setTimeout(() => setCopiedFormat(null), 2000);
  };

  // Filter segments by search query
  const filteredSegments = segments.filter((s) =>
    s.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Hidden Audio Player for Sync */}
      {audioFileUrl && (
        <audio
          ref={audioRef}
          src={audioFileUrl}
          onTimeUpdate={handleTimeUpdate}
          onEnded={() => setIsPlaying(false)}
        />
      )}

      {/* Top Media & Audio Sync Player Bar */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Controls */}
          <div className="flex items-center space-x-3 w-full md:w-auto justify-center">
            <button
              onClick={() => skipSeconds(-5)}
              className="p-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
              title="Retroceder 5 segundos"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={togglePlay}
              disabled={!audioFileUrl}
              className="p-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl shadow-md shadow-indigo-600/20 transition-transform active:scale-95"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>
            <button
              onClick={() => skipSeconds(5)}
              className="p-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
              title="Avanzar 5 segundos"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            {/* Playback speed selector */}
            <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 rounded-lg p-0.5 text-xs font-medium">
              {[1, 1.25, 1.5, 2].map((rate) => (
                <button
                  key={rate}
                  onClick={() => changeSpeed(rate)}
                  className={`px-2 py-1 rounded-md transition-colors ${
                    playbackRate === rate
                      ? "bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-xs font-bold"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                  }`}
                >
                  {rate}x
                </button>
              ))}
            </div>
          </div>

          {/* Scrubber / Progress Slider */}
          <div className="flex items-center space-x-3 w-full max-w-xl">
            <span className="text-xs font-mono text-zinc-500 w-12 text-right">
              {formatTime(currentTime)}
            </span>
            <input
              type="range"
              min="0"
              max={duration}
              step="0.1"
              value={currentTime}
              onChange={(e) => seekTo(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            <span className="text-xs font-mono text-zinc-500 w-12">
              {formatTime(duration)}
            </span>
          </div>

          {/* Reset / New File Button */}
          <div className="flex items-center space-x-2">
            <button
              onClick={onReset}
              className="px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700"
            >
              Nueva Transcripción
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-zinc-900 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">Duración Audio</div>
            <div className="text-sm font-semibold text-zinc-900 dark:text-white">
              {data.media_info.duration_minutes} min ({Math.round(data.media_info.duration_seconds)}s)
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
            <DollarSign className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">Coste API Estimado</div>
            <div className="text-sm font-semibold text-zinc-900 dark:text-white">
              ${data.media_info.estimated_api_cost_usd} USD
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">Tiempo de Proceso</div>
            <div className="text-sm font-semibold text-zinc-900 dark:text-white">
              {data.elapsed_seconds}s
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">Segmentos de Voz</div>
            <div className="text-sm font-semibold text-zinc-900 dark:text-white">
              {segments.length} bloques
            </div>
          </div>
        </div>
      </div>

      {/* Main Studio Container */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
        {/* Navigation Tabs */}
        <div className="border-b border-zinc-200 dark:border-zinc-800 px-6 pt-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex space-x-2">
            <button
              onClick={() => setActiveTab("transcript")}
              className={`pb-3 px-3 text-sm font-medium border-b-2 flex items-center space-x-2 transition-colors ${
                activeTab === "transcript"
                  ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                  : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Transcripción Dinámica</span>
            </button>
            <button
              onClick={() => setActiveTab("subtitles")}
              className={`pb-3 px-3 text-sm font-medium border-b-2 flex items-center space-x-2 transition-colors ${
                activeTab === "subtitles"
                  ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                  : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>Editor de Subtítulos</span>
            </button>
            {data.summary && (
              <button
                onClick={() => setActiveTab("summary")}
                className={`pb-3 px-3 text-sm font-medium border-b-2 flex items-center space-x-2 transition-colors ${
                  activeTab === "summary"
                    ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                    : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                }`}
              >
                <Sparkles className="w-4 h-4 text-violet-500" />
                <span>
                  {data.summary.summary_type === "general"
                    ? "Resumen General"
                    : data.summary.summary_type === "podcast"
                    ? "Podcast & Citas"
                    : data.summary.summary_type === "interrogatorios"
                    ? "Acta & Prueba Legal"
                    : "Minuta & Acuerdos IA"}
                </span>
              </button>
            )}
            <button
              onClick={() => setActiveTab("export")}
              className={`pb-3 px-3 text-sm font-medium border-b-2 flex items-center space-x-2 transition-colors ${
                activeTab === "export"
                  ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                  : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              <Download className="w-4 h-4" />
              <span>Exportar Suite</span>
            </button>
          </div>

          {/* Quick Actions / Search */}
          <div className="pb-3 flex items-center space-x-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Buscar en audio..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-40 sm:w-56"
              />
            </div>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className={`p-1.5 rounded-lg border text-xs flex items-center space-x-1 ${
                isEditing
                  ? "bg-indigo-50 text-indigo-600 border-indigo-300"
                  : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100"
              }`}
              title="Modo Edición"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isEditing ? "Guardar" : "Editar"}</span>
            </button>
          </div>
        </div>

        {/* Tab 1: Dynamic Interactive Transcript */}
        {activeTab === "transcript" && (
          <div className="p-6 space-y-4 max-h-[600px] overflow-y-auto">
            {filteredSegments.map((seg, idx) => {
              const isCurrent = currentTime >= seg.start && currentTime <= seg.end;

              return (
                <div
                  key={seg.id || idx}
                  className={`p-3 rounded-xl transition-all flex items-start gap-4 ${
                    isCurrent
                      ? "bg-indigo-50/70 dark:bg-indigo-950/30 border-l-4 border-indigo-600 shadow-xs"
                      : "hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                  }`}
                >
                  <button
                    onClick={() => seekTo(seg.start)}
                    className="shrink-0 text-xs font-mono px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-indigo-100 hover:text-indigo-600 transition-colors"
                  >
                    {formatTime(seg.start)}
                  </button>

                  <div className="flex-1">
                    {isEditing ? (
                      <textarea
                        value={seg.text}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSegments((prev) =>
                            prev.map((s) => (s.id === seg.id ? { ...s, text: val } : s))
                          );
                        }}
                        rows={2}
                        className="w-full text-sm p-1.5 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
                      />
                    ) : (
                      <p
                        onClick={() => seekTo(seg.start)}
                        className="text-sm leading-relaxed text-zinc-800 dark:text-zinc-200 cursor-pointer"
                      >
                        {seg.text}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tab 2: Subtitle Editor (SRT / VTT blocks) */}
        {activeTab === "subtitles" && (
          <div className="p-6 max-h-[600px] overflow-y-auto space-y-3 font-mono text-xs">
            {segments.map((seg, idx) => (
              <div
                key={seg.id || idx}
                className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-800"
              >
                <div className="flex items-center justify-between text-zinc-500 mb-1">
                  <span className="font-bold text-indigo-600">#{idx + 1}</span>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => seekTo(seg.start)}
                      className="hover:underline hover:text-indigo-500"
                    >
                      {formatTimestampSrt(seg.start)}
                    </button>
                    <span>{"-->"}</span>
                    <button
                      onClick={() => seekTo(seg.end)}
                      className="hover:underline hover:text-indigo-500"
                    >
                      {formatTimestampSrt(seg.end)}
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  value={seg.text}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSegments((prev) =>
                      prev.map((s) => (s.id === seg.id ? { ...s, text: val } : s))
                    );
                  }}
                  className="w-full p-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-md text-zinc-900 dark:text-zinc-100"
                />
              </div>
            ))}
          </div>
        )}

        {/* Tab 3: Executive Summary & Template Analysis */}
        {activeTab === "summary" && data.summary && (
          <div className="p-6 space-y-6 max-h-[600px] overflow-y-auto">
            {/* Header with Template Tag */}
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  {data.summary.summary_type === "general"
                    ? "Resumen General & Temático"
                    : data.summary.summary_type === "podcast"
                    ? "Podcast & Entrevista Editorial"
                    : data.summary.summary_type === "interrogatorios"
                    ? "Interrogatorio Legal & Procesal"
                    : "Minuta Ejecutiva de Reunión"}
                </span>
              </div>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
                {data.summary.title}
              </h2>
              <div className="p-4 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-200 dark:border-zinc-800 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                {data.summary.summary}
              </div>
            </div>

            {/* Specialized: Bloques Temáticos (general & podcast) */}
            {data.summary.topics && data.summary.topics.length > 0 && (
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3 flex items-center space-x-2">
                  <Layers className="w-4 h-4 text-indigo-500" />
                  <span>
                    {data.summary.summary_type === "podcast" ? "Temas Tratados" : "Bloques Temáticos"}
                  </span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {data.summary.topics.map((top, i) => (
                    <div
                      key={i}
                      className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-zinc-900 dark:text-white">
                          {top.title}
                        </span>
                        {top.timestamp && top.timestamp !== "No especificada" && (
                          <span className="shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                            {top.timestamp}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                        {top.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Specialized: Citas Memorables (podcast) */}
            {data.summary.quotes && data.summary.quotes.length > 0 && (
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3 flex items-center space-x-2">
                  <Quote className="w-4 h-4 text-violet-500" />
                  <span>Citas Memorables & Momentos Destacados</span>
                </h3>
                <div className="grid grid-cols-1 gap-3">
                  {data.summary.quotes.map((q, i) => (
                    <div
                      key={i}
                      className="p-4 rounded-xl border border-violet-200/60 dark:border-violet-900/40 bg-violet-50/30 dark:bg-violet-950/20 space-y-2"
                    >
                      <p className="text-sm italic font-serif text-zinc-900 dark:text-zinc-100">
                        &ldquo;{q.quote}&rdquo;
                      </p>
                      <div className="flex items-center space-x-2 text-xs text-zinc-500 dark:text-zinc-400">
                        <span className="font-semibold text-violet-700 dark:text-violet-300">
                          {q.speaker || "Interviniente"}
                        </span>
                        {q.context && (
                          <>
                            <span>•</span>
                            <span>{q.context}</span>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Specialized: Takeaways (podcast) */}
            {data.summary.takeaways && data.summary.takeaways.length > 0 && (
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3 flex items-center space-x-2">
                  <Lightbulb className="w-4 h-4 text-amber-500" />
                  <span>Aprendizajes Clave</span>
                </h3>
                <ul className="space-y-2">
                  {data.summary.takeaways.map((item, i) => (
                    <li
                      key={i}
                      className="text-sm text-zinc-800 dark:text-zinc-200 flex items-start space-x-2.5 p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-200 dark:border-zinc-800"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Specialized: Hechos Declarados (interrogatorios) */}
            {data.summary.declared_facts && data.summary.declared_facts.length > 0 && (
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3 flex items-center space-x-2">
                  <Bookmark className="w-4 h-4 text-indigo-500" />
                  <span>Hechos Declarados</span>
                </h3>
                <div className="space-y-2">
                  {data.summary.declared_facts.map((fact, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-start space-x-3"
                    >
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 shrink-0 mt-0.5">
                        {fact.speaker || "Declarante"}
                      </span>
                      <div className="flex-1 text-xs">
                        <p className="font-medium text-zinc-900 dark:text-zinc-100">{fact.fact}</p>
                        {fact.context && (
                          <p className="text-zinc-500 dark:text-zinc-400 mt-0.5">{fact.context}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Specialized: Contradicciones e Inconsistencias (interrogatorios) */}
            {data.summary.contradictions && data.summary.contradictions.length > 0 && (
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 mb-3 flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-rose-500" />
                  <span>Contradicciones e Inconsistencias Advertidas</span>
                </h3>
                <div className="space-y-2.5">
                  {data.summary.contradictions.map((contra, i) => (
                    <div
                      key={i}
                      className="p-4 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/20 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-rose-900 dark:text-rose-200">
                          {contra.issue}
                        </span>
                        {contra.parties_involved && contra.parties_involved.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {contra.parties_involved.map((party, pIdx) => (
                              <span
                                key={pIdx}
                                className="px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300 text-[10px] font-medium"
                              >
                                {party}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-rose-800 dark:text-rose-300 leading-relaxed">
                        {contra.detail}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Specialized: Preguntas Clave (interrogatorios) */}
            {data.summary.key_questions && data.summary.key_questions.length > 0 && (
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3 flex items-center space-x-2">
                  <HelpCircle className="w-4 h-4 text-indigo-500" />
                  <span>Preguntas Clave del Interrogatorio</span>
                </h3>
                <div className="space-y-2.5">
                  {data.summary.key_questions.map((q, i) => (
                    <div
                      key={i}
                      className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-1.5 text-xs"
                    >
                      <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-start space-x-2">
                        <span className="text-indigo-600 font-bold shrink-0">P:</span>
                        <span>{q.question}</span>
                      </div>
                      <div className="text-zinc-700 dark:text-zinc-300 flex items-start space-x-2 pl-4">
                        <span className="text-emerald-600 font-bold shrink-0">R:</span>
                        <span>{q.answer}</span>
                      </div>
                      {q.implication && (
                        <div className="pl-4 pt-1 text-[11px] text-zinc-500 dark:text-zinc-400 italic">
                          Implicación: {q.implication}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Specialized: Valoración Probatoria (interrogatorios) */}
            {data.summary.evidence_assessment && (
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3 flex items-center space-x-2">
                  <Scale className="w-4 h-4 text-violet-500" />
                  <span>Valoración de Consistencia y Fuerza Probatoria</span>
                </h3>
                <div className="p-4 rounded-xl border border-violet-200 dark:border-violet-900/50 bg-gradient-to-r from-violet-50/50 to-indigo-50/30 dark:from-violet-950/20 dark:to-indigo-950/10 text-xs sm:text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
                  {data.summary.evidence_assessment}
                </div>
              </div>
            )}

            {/* Key Points (All types if populated) */}
            {data.summary.key_points && data.summary.key_points.length > 0 && (
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3 flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-violet-500" />
                  <span>
                    {data.summary.summary_type === "podcast"
                      ? "Ideas Centrales & Tesis"
                      : data.summary.summary_type === "interrogatorios"
                      ? "Hechos Nucleares"
                      : "Puntos Clave Discutidos"}
                  </span>
                </h3>
                <ul className="space-y-2">
                  {data.summary.key_points.map((pt, i) => (
                    <li
                      key={i}
                      className="text-sm text-zinc-800 dark:text-zinc-200 flex items-start space-x-2"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-500 mt-2 shrink-0" />
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Specialized: Conclusiones (general) */}
            {data.summary.conclusions && data.summary.conclusions.length > 0 && (
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3 flex items-center space-x-2">
                  <Check className="w-4 h-4 text-emerald-500" />
                  <span>Conclusiones Principales</span>
                </h3>
                <ul className="space-y-2">
                  {data.summary.conclusions.map((conc, i) => (
                    <li
                      key={i}
                      className="text-sm text-zinc-800 dark:text-zinc-200 flex items-start space-x-2"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 shrink-0" />
                      <span>{conc}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Decisions (reuniones or if populated) */}
            {data.summary.decisions && data.summary.decisions.length > 0 && (
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3 flex items-center space-x-2">
                  <Check className="w-4 h-4 text-emerald-500" />
                  <span>Decisiones Tomadas</span>
                </h3>
                <ul className="space-y-2">
                  {data.summary.decisions.map((dec, i) => (
                    <li
                      key={i}
                      className="text-sm text-zinc-800 dark:text-zinc-200 flex items-start space-x-2"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 shrink-0" />
                      <span>{dec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Action Items Table (reuniones or if populated) */}
            {data.summary.action_items && data.summary.action_items.length > 0 && (
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3 flex items-center space-x-2">
                  <CheckSquare className="w-4 h-4 text-indigo-500" />
                  <span>Tareas y Acuerdos de Acción</span>
                </h3>
                <div className="overflow-x-auto border border-zinc-200 dark:border-zinc-800 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 uppercase font-semibold">
                      <tr>
                        <th className="p-3">Tarea / Compromiso</th>
                        <th className="p-3">Responsable</th>
                        <th className="p-3">Plazo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                      {data.summary.action_items.map((item, i) => (
                        <tr key={i} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                          <td className="p-3 font-medium text-zinc-900 dark:text-zinc-100">
                            {item.task}
                          </td>
                          <td className="p-3 text-zinc-600 dark:text-zinc-400">
                            <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono text-xs">
                              {item.owner || "Sin asignar"}
                            </span>
                          </td>
                          <td className="p-3 text-zinc-600 dark:text-zinc-400">
                            {item.deadline || "No especificado"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Export Suite */}
        {activeTab === "export" && (
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* TXT */}
            <div className="p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/30 flex flex-col justify-between">
              <div>
                <h4 className="font-semibold text-zinc-900 dark:text-white flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-indigo-500" />
                  <span>Texto Plano (.TXT)</span>
                </h4>
                <p className="text-xs text-zinc-500 mt-1">
                  Párrafos limpios listos para copiar a documentos, correos o informes.
                </p>
              </div>
              <div className="flex items-center space-x-2 mt-4">
                <button
                  onClick={() => downloadFile(getFullText(), "transcripcion.txt", "text/plain")}
                  className="flex-1 py-2 px-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-medium hover:bg-zinc-100 flex items-center justify-center space-x-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar .txt</span>
                </button>
                <button
                  onClick={() => copyToClipboard(getFullText(), "txt")}
                  className="py-2 px-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-medium hover:bg-zinc-100"
                  title="Copiar texto"
                >
                  {copiedFormat === "txt" ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* SRT */}
            <div className="p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/30 flex flex-col justify-between">
              <div>
                <h4 className="font-semibold text-zinc-900 dark:text-white flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-emerald-500" />
                  <span>Subtítulos Premiere (.SRT)</span>
                </h4>
                <p className="text-xs text-zinc-500 mt-1">
                  Estándar SubRip para Adobe Premiere, DaVinci Resolve y Final Cut Pro.
                </p>
              </div>
              <div className="flex items-center space-x-2 mt-4">
                <button
                  onClick={() => downloadFile(getSrtText(), "subtitulos.srt", "text/plain")}
                  className="flex-1 py-2 px-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-medium hover:bg-zinc-100 flex items-center justify-center space-x-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar .srt</span>
                </button>
                <button
                  onClick={() => copyToClipboard(getSrtText(), "srt")}
                  className="py-2 px-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-medium hover:bg-zinc-100"
                  title="Copiar SRT"
                >
                  {copiedFormat === "srt" ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* VTT */}
            <div className="p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/30 flex flex-col justify-between">
              <div>
                <h4 className="font-semibold text-zinc-900 dark:text-white flex items-center space-x-2">
                  <Share2 className="w-4 h-4 text-violet-500" />
                  <span>Subtítulos Web (.VTT)</span>
                </h4>
                <p className="text-xs text-zinc-500 mt-1">
                  Estándar WebVTT para reproductores web HTML5 (video.js, YouTube, Vimeo).
                </p>
              </div>
              <div className="flex items-center space-x-2 mt-4">
                <button
                  onClick={() => downloadFile(getVttText(), "subtitulos.vtt", "text/vtt")}
                  className="flex-1 py-2 px-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-medium hover:bg-zinc-100 flex items-center justify-center space-x-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar .vtt</span>
                </button>
                <button
                  onClick={() => copyToClipboard(getVttText(), "vtt")}
                  className="py-2 px-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-medium hover:bg-zinc-100"
                  title="Copiar VTT"
                >
                  {copiedFormat === "vtt" ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Markdown Summary */}
            {data.summary && (
              <div className="p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/30 flex flex-col justify-between">
                <div>
                  <h4 className="font-semibold text-zinc-900 dark:text-white flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span>
                      {data.summary.summary_type === "general"
                        ? "Resumen Ejecutivo (.MD)"
                        : data.summary.summary_type === "podcast"
                        ? "Informe Editorial Podcast (.MD)"
                        : data.summary.summary_type === "interrogatorios"
                        ? "Acta Procesal & Prueba (.MD)"
                        : "Minuta Ejecutiva (.MD)"}
                    </span>
                  </h4>
                  <p className="text-xs text-zinc-500 mt-1">
                    {data.summary.summary_type === "general"
                      ? "Informe con síntesis global, bloques temáticos y conclusiones en Markdown."
                      : data.summary.summary_type === "podcast"
                      ? "Sinopsis completa, ideas clave, citas memorables y lecciones en Markdown."
                      : data.summary.summary_type === "interrogatorios"
                      ? "Acta circunstanciada, hechos declarados, contradicciones y prueba en Markdown."
                      : "Informe completo con resumen, acuerdos y tabla de tareas en Markdown."}
                  </p>
                </div>
                <div className="flex items-center space-x-2 mt-4">
                  <button
                    onClick={() => {
                      const fname =
                        data.summary?.summary_type === "general"
                          ? "resumen_ejecutivo.md"
                          : data.summary?.summary_type === "podcast"
                          ? "informe_podcast.md"
                          : data.summary?.summary_type === "interrogatorios"
                          ? "acta_interrogatorio.md"
                          : "minuta_reunion.md";
                      downloadFile(getMarkdownSummary(), fname, "text/markdown");
                    }}
                    className="flex-1 py-2 px-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-medium hover:bg-zinc-100 flex items-center justify-center space-x-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Descargar .md</span>
                  </button>
                  <button
                    onClick={() => copyToClipboard(getMarkdownSummary(), "md")}
                    className="py-2 px-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-medium hover:bg-zinc-100"
                    title="Copiar Informe"
                  >
                    {copiedFormat === "md" ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function formatTimestampSrt(seconds: number) {
  if (seconds < 0) seconds = 0;
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.round((seconds - Math.floor(seconds)) * 1000);
  return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")},${millis.toString().padStart(3, "0")}`;
}

function formatTimestampVtt(seconds: number) {
  if (seconds < 0) seconds = 0;
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.round((seconds - Math.floor(seconds)) * 1000);
  return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${millis.toString().padStart(3, "0")}`;
}
