export interface Segment {
  id: number;
  start: number;
  end: number;
  text: string;
  tokens?: number[];
}

export interface Word {
  word: string;
  start: number;
  end: number;
}

export interface TranscriptionData {
  text: string;
  language: string;
  duration: number;
  segments: Segment[];
  words?: Word[];
  srt: string;
  vtt: string;
  txt: string;
}

export interface ActionItem {
  task: string;
  owner: string;
  deadline: string;
}

export interface MeetingSummary {
  title: string;
  summary: string;
  key_points: string[];
  action_items: ActionItem[];
  decisions: string[];
}

export interface MediaInfo {
  duration_seconds: number;
  duration_minutes: number;
  has_video: boolean;
  format: string;
  estimated_api_cost_usd: number;
}

export interface TranscriptionResponse {
  status: "completed" | "failed" | "processing";
  elapsed_seconds: number;
  media_info: MediaInfo;
  transcription: TranscriptionData;
  summary?: MeetingSummary;
  error?: string;
}

export type ProcessingStep =
  | "idle"
  | "extracting_audio"
  | "uploading"
  | "compressing"
  | "transcribing"
  | "summarizing"
  | "completed"
  | "error";
