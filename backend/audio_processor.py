import json
import logging
import os
import re
import subprocess
from typing import Any, Dict, List, Tuple
from config import settings

logger = logging.getLogger(__name__)


class AudioProcessorError(Exception):
    pass


class AudioProcessor:
    def __init__(self):
        self.target_bitrate = settings.TARGET_BITRATE
        self.target_sample_rate = settings.TARGET_SAMPLE_RATE
        self.max_chunk_size_bytes = int(settings.MAX_CHUNK_SIZE_MB * 1024 * 1024)

    def probe_media(self, file_path: str) -> Dict[str, Any]:
        """Runs ffprobe on the input file and returns duration, format, and stream info."""
        if not os.path.exists(file_path):
            raise AudioProcessorError(f"Archivo no encontrado: {file_path}")

        cmd = [
            "ffprobe",
            "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            "-show_streams",
            file_path
        ]

        try:
            res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True)
            data = json.loads(res.stdout)
            format_info = data.get("format", {})
            duration = float(format_info.get("duration", 0.0))
            size = int(format_info.get("size", os.path.getsize(file_path)))
            has_audio = any(s.get("codec_type") == "audio" for s in data.get("streams", []))
            has_video = any(s.get("codec_type") == "video" for s in data.get("streams", []))

            return {
                "duration": duration,
                "size_bytes": size,
                "has_audio": has_audio,
                "has_video": has_video,
                "format_name": format_info.get("format_name", "unknown")
            }
        except subprocess.CalledProcessError as e:
            raise AudioProcessorError(f"ffprobe falló al analizar el archivo: {e.stderr}")
        except Exception as e:
            raise AudioProcessorError(f"Error procesando información de medios: {str(e)}")

    def extract_and_compress(self, input_path: str, output_path: str) -> Dict[str, Any]:
        """
        Extracts audio from video/audio and compresses to Mono 16kHz MP3 at target bitrate (32k).
        1 hour of voice speech = ~14.4 MB (well under OpenAI's 25MB ceiling).
        """
        if not os.path.exists(input_path):
            raise AudioProcessorError(f"Input file not found: {input_path}")

        cmd = [
            "ffmpeg",
            "-y",                       # Overwrite output
            "-i", input_path,           # Input file
            "-vn",                      # Strip video streams
            "-ac", "1",                 # Force mono
            "-ar", str(self.target_sample_rate), # 16kHz
            "-c:a", "libmp3lame",       # MP3 codec universally supported by OpenAI
            "-b:a", self.target_bitrate,# 32 kbps
            output_path
        ]

        try:
            subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
            if not os.path.exists(output_path):
                raise AudioProcessorError("FFmpeg terminó pero el archivo de salida no fue creado.")

            output_size = os.path.getsize(output_path)
            probe = self.probe_media(output_path)

            return {
                "output_path": output_path,
                "size_bytes": output_size,
                "size_mb": round(output_size / (1024 * 1024), 2),
                "duration": probe["duration"]
            }
        except subprocess.CalledProcessError as e:
            raise AudioProcessorError(f"FFmpeg falló al comprimir el audio: {e.stderr.decode('utf-8', errors='ignore')}")

    def find_silence_cut_points(
        self,
        audio_path: str,
        total_duration: float,
        target_chunk_duration: float
    ) -> List[Tuple[float, float]]:
        """
        Uses ffmpeg silencedetect to find quiet moments for splitting without cutting words.
        Returns a list of (start_seconds, end_seconds) intervals covering the full duration.
        """
        cmd = [
            "ffmpeg",
            "-i", audio_path,
            "-af", f"silencedetect=noise={settings.SILENCE_THRESHOLD_DB}dB:d={settings.MIN_SILENCE_DURATION_S}",
            "-f", "null",
            "-"
        ]

        silences: List[Dict[str, float]] = []
        try:
            res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            stderr = res.stderr

            silence_starts = [float(m) for m in re.findall(r"silence_start: ([\d\.]+)", stderr)]
            silence_ends = [float(m) for m in re.findall(r"silence_end: ([\d\.]+)", stderr)]

            for s, e in zip(silence_starts, silence_ends):
                silences.append({"start": s, "end": e, "mid": (s + e) / 2.0})
        except Exception as e:
            logger.warning(f"Silence detection warning, falling back to clean intervals: {e}")

        # Plan the cut points
        intervals: List[Tuple[float, float]] = []
        current_start = 0.0

        while current_start < total_duration:
            ideal_end = current_start + target_chunk_duration
            if ideal_end >= total_duration:
                intervals.append((current_start, total_duration))
                break

            # Search for silence window around ideal_end (+/- 45 seconds)
            best_cut = None
            window_min = max(current_start + 60.0, ideal_end - 45.0)
            window_max = min(total_duration, ideal_end + 45.0)

            candidate_silences = [
                s["mid"] for s in silences if window_min <= s["mid"] <= window_max
            ]

            if candidate_silences:
                # Pick the silence closest to ideal_end
                best_cut = min(candidate_silences, key=lambda x: abs(x - ideal_end))
            else:
                best_cut = ideal_end

            intervals.append((current_start, best_cut))
            current_start = best_cut

        return intervals

    def slice_chunk(self, audio_path: str, start: float, duration: float, output_path: str) -> str:
        """Slices an audio segment quickly without re-encoding."""
        cmd = [
            "ffmpeg",
            "-y",
            "-ss", f"{start:.3f}",
            "-t", f"{duration:.3f}",
            "-i", audio_path,
            "-c", "copy",
            output_path
        ]
        try:
            subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
            return output_path
        except subprocess.CalledProcessError as e:
            raise AudioProcessorError(f"Error cortando fragmento de audio: {e.stderr.decode('utf-8', errors='ignore')}")

    def prepare_audio_for_transcription(self, input_path: str, work_dir: str) -> List[Dict[str, Any]]:
        """
        Orchestrates full audio preparation:
        1. Compresses to 32kbps mono mp3.
        2. If <= 24MB, returns 1 chunk (start_offset=0.0).
        3. If > 24MB, applies VAD silence cut points and splits into sub-24MB chunks.
        """
        os.makedirs(work_dir, exist_ok=True)
        compressed_audio_path = os.path.join(work_dir, "optimized_audio.mp3")

        comp_info = self.extract_and_compress(input_path, compressed_audio_path)
        total_duration = comp_info["duration"]
        size_bytes = comp_info["size_bytes"]

        # If file is under limit, return as single chunk
        if size_bytes <= self.max_chunk_size_bytes:
            return [{
                "chunk_index": 0,
                "chunk_path": compressed_audio_path,
                "start_offset": 0.0,
                "end_offset": total_duration,
                "duration": total_duration,
                "size_mb": comp_info["size_mb"]
            }]

        # Otherwise, calculate target duration per chunk
        # E.g. at 32kbps, 20MB is ~5200 seconds (~1.44 hours)
        bytes_per_second = (32 * 1000) / 8  # 4000 bytes/sec
        safe_target_bytes = 20 * 1024 * 1024 # 20 MB target
        target_chunk_duration = safe_target_bytes / bytes_per_second

        cut_intervals = self.find_silence_cut_points(
            compressed_audio_path,
            total_duration,
            target_chunk_duration
        )

        chunks: List[Dict[str, Any]] = []
        for idx, (start_sec, end_sec) in enumerate(cut_intervals):
            dur = end_sec - start_sec
            chunk_file = os.path.join(work_dir, f"chunk_{idx:03d}.mp3")
            self.slice_chunk(compressed_audio_path, start_sec, dur, chunk_file)
            chunk_size = os.path.getsize(chunk_file)

            chunks.append({
                "chunk_index": idx,
                "chunk_path": chunk_file,
                "start_offset": start_sec,
                "end_offset": end_sec,
                "duration": dur,
                "size_mb": round(chunk_size / (1024 * 1024), 2)
            })

        return chunks
