/**
 * Client-Side Audio Extraction Utility
 * Extracts the audio track from video files directly in the browser using the Web Audio API,
 * drastically reducing upload size by up to 95% (e.g., 500MB MP4 -> 20MB WAV/audio).
 */

export async function extractAudioFromVideo(
  videoFile: File,
  onProgress?: (percent: number) => void
): Promise<File> {
  // If the file is already an audio file, return it directly
  if (videoFile.type.startsWith("audio/")) {
    return videoFile;
  }

  // If the file is over 350MB, browser memory limits might fail during full decodeAudioData.
  // In that case, fall back to server-side extraction.
  if (videoFile.size > 350 * 1024 * 1024) {
    throw new Error("El archivo supera los 350MB para extracción en navegador; use subida directa.");
  }

  onProgress?.(10);
  const arrayBuffer = await videoFile.arrayBuffer();
  onProgress?.(30);

  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioContext = new AudioContextClass({ sampleRate: 16000 }); // 16kHz optimal for Whisper

  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    onProgress?.(70);

    const wavBlob = audioBufferToWav(audioBuffer);
    onProgress?.(95);

    const baseName = videoFile.name.replace(/\.[^/.]+$/, "");
    return new File([wavBlob], `${baseName}_audio.wav`, { type: "audio/wav" });
  } finally {
    await audioContext.close();
  }
}

/**
 * Encodes an AudioBuffer into standard 16-bit PCM WAV (mono)
 */
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = 1; // Downmix to mono
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  // Downmix stereo to mono
  const channelData = buffer.getChannelData(0);
  if (buffer.numberOfChannels > 1) {
    const channel2 = buffer.getChannelData(1);
    for (let i = 0; i < channelData.length; i++) {
      channelData[i] = (channelData[i] + channel2[i]) / 2;
    }
  }

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = channelData.length * bytesPerSample;
  const bufferSize = 44 + dataSize;

  const arrayBuffer = new ArrayBuffer(bufferSize);
  const view = new DataView(arrayBuffer);

  // RIFF identifier
  writeString(view, 0, "RIFF");
  // file length minus RIFF identifier & length
  view.setUint32(4, 36 + dataSize, true);
  // RIFF type
  writeString(view, 8, "WAVE");
  // format chunk identifier
  writeString(view, 12, "fmt ");
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (raw)
  view.setUint16(20, format, true);
  // channel count
  view.setUint16(22, numChannels, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sample rate * block align)
  view.setUint32(28, byteRate, true);
  // block align (channel count * bytes per sample)
  view.setUint16(32, blockAlign, true);
  // bits per sample
  view.setUint16(34, bitDepth, true);
  // data chunk identifier
  writeString(view, 36, "data");
  // data chunk length
  view.setUint32(40, dataSize, true);

  // Write PCM audio samples
  let offset = 44;
  for (let i = 0; i < channelData.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, channelData[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([view], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
