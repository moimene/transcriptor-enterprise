import logging
import math
import os
from typing import Any, Dict, List, Optional
from openai import OpenAI
from config import settings

logger = logging.getLogger(__name__)


def format_timestamp_srt(seconds: float) -> str:
    """Converts seconds (e.g. 65.432) to SRT format: HH:MM:SS,mmm"""
    if seconds < 0:
        seconds = 0
    hrs = int(seconds // 3600)
    mins = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int(round((seconds - int(seconds)) * 1000))
    if millis >= 1000:
        millis = 999
    return f"{hrs:02d}:{mins:02d}:{secs:02d},{millis:03d}"


def format_timestamp_vtt(seconds: float) -> str:
    """Converts seconds (e.g. 65.432) to WebVTT format: HH:MM:SS.mmm"""
    if seconds < 0:
        seconds = 0
    hrs = int(seconds // 3600)
    mins = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int(round((seconds - int(seconds)) * 1000))
    if millis >= 1000:
        millis = 999
    return f"{hrs:02d}:{mins:02d}:{secs:02d}.{millis:03d}"


class TranscriptionService:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.OPENAI_API_KEY
        if self.api_key:
            self.client = OpenAI(api_key=self.api_key)
        else:
            self.client = None

    def transcribe_chunk(
        self,
        chunk_file_path: str,
        language: Optional[str] = None,
        prompt: Optional[str] = None,
        temperature: float = 0.0
    ) -> Dict[str, Any]:
        """Calls OpenAI Whisper API on a single chunk with verbose_json for granular timestamps."""
        if not self.client:
            raise ValueError("OPENAI_API_KEY no está configurada.")

        with open(chunk_file_path, "rb") as audio_file:
            kwargs = {
                "model": settings.WHISPER_MODEL,
                "file": audio_file,
                "response_format": "verbose_json",
                "temperature": temperature
            }
            if language:
                kwargs["language"] = language
            if prompt:
                kwargs["prompt"] = prompt

            response = self.client.audio.transcriptions.create(**kwargs)
            return response.to_dict()

    def transcribe_and_merge(
        self,
        chunks: List[Dict[str, Any]],
        language: Optional[str] = None,
        prompt: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Transcribes all chunks and merges segments/words applying accurate millisecond time offsets.
        """
        merged_segments: List[Dict[str, Any]] = []
        merged_words: List[Dict[str, Any]] = []
        full_text_parts: List[str] = []
        detected_language = language or "es"
        total_duration = 0.0

        for chunk in chunks:
            chunk_path = chunk["chunk_path"]
            offset = chunk["start_offset"]
            logger.info(f"Transcribiendo chunk {chunk.get('chunk_index', 0)} (offset={offset:.2f}s)...")

            resp = self.transcribe_chunk(chunk_path, language=language, prompt=prompt)

            if "language" in resp and not language:
                detected_language = resp["language"]

            chunk_duration = float(resp.get("duration", chunk.get("duration", 0.0)))
            total_duration = max(total_duration, offset + chunk_duration)

            if "text" in resp and resp["text"]:
                full_text_parts.append(resp["text"].strip())

            # Adjust segment timestamps
            raw_segments = resp.get("segments", [])
            for seg in raw_segments:
                seg_dict = {
                    "id": len(merged_segments),
                    "start": round(float(seg.get("start", 0.0)) + offset, 3),
                    "end": round(float(seg.get("end", 0.0)) + offset, 3),
                    "text": seg.get("text", "").strip(),
                    "tokens": seg.get("tokens", [])
                }
                merged_segments.append(seg_dict)

            # Adjust word timestamps if available
            raw_words = resp.get("words", [])
            for w in raw_words:
                merged_words.append({
                    "word": w.get("word", ""),
                    "start": round(float(w.get("start", 0.0)) + offset, 3),
                    "end": round(float(w.get("end", 0.0)) + offset, 3)
                })

        full_text = " ".join(full_text_parts)

        # Build output formats
        srt_content = self.generate_srt(merged_segments)
        vtt_content = self.generate_vtt(merged_segments)
        txt_content = self.generate_clean_txt(merged_segments, full_text)

        return {
            "text": full_text,
            "language": detected_language,
            "duration": round(total_duration, 2),
            "segments": merged_segments,
            "words": merged_words,
            "srt": srt_content,
            "vtt": vtt_content,
            "txt": txt_content
        }

    def generate_srt(self, segments: List[Dict[str, Any]]) -> str:
        """Generates standard SubRip (.srt) format."""
        srt_lines: List[str] = []
        for idx, seg in enumerate(segments, start=1):
            start_str = format_timestamp_srt(seg["start"])
            end_str = format_timestamp_srt(seg["end"])
            text = seg["text"].strip()
            if not text:
                continue
            srt_lines.append(f"{idx}\n{start_str} --> {end_str}\n{text}\n")
        return "\n".join(srt_lines).strip() + "\n"

    def generate_vtt(self, segments: List[Dict[str, Any]]) -> str:
        """Generates standard WebVTT (.vtt) format."""
        vtt_lines: List[str] = ["WEBVTT\n"]
        for seg in segments:
            start_str = format_timestamp_vtt(seg["start"])
            end_str = format_timestamp_vtt(seg["end"])
            text = seg["text"].strip()
            if not text:
                continue
            vtt_lines.append(f"{start_str} --> {end_str}\n{text}\n")
        return "\n".join(vtt_lines).strip() + "\n"

    def generate_clean_txt(self, segments: List[Dict[str, Any]], fallback_text: str) -> str:
        """Creates paragraph-structured readable text using pauses between segments."""
        if not segments:
            return fallback_text

        paragraphs: List[str] = []
        current_para: List[str] = []
        last_end = 0.0

        for seg in segments:
            text = seg["text"].strip()
            if not text:
                continue

            # If silence gap between segments > 2.5 seconds, start new paragraph
            if current_para and (seg["start"] - last_end > 2.5):
                paragraphs.append(" ".join(current_para))
                current_para = []

            current_para.append(text)
            last_end = seg["end"]

        if current_para:
            paragraphs.append(" ".join(current_para))

        return "\n\n".join(paragraphs)
