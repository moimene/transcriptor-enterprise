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

export interface TopicItem {
  title: string;
  description: string;
  timestamp?: string;
}

export interface QuoteItem {
  quote: string;
  speaker?: string;
  context?: string;
}

export interface DeclaredFactItem {
  fact: string;
  speaker?: string;
  context?: string;
}

export interface ContradictionItem {
  issue: string;
  detail: string;
  parties_involved?: string[];
}

export interface KeyQuestionItem {
  question: string;
  answer: string;
  implication?: string;
}

export type SummaryType = "reuniones" | "general" | "podcast" | "interrogatorios";

export interface MeetingSummary {
  summary_type?: SummaryType;
  title: string;
  summary: string;
  key_points: string[];
  action_items: ActionItem[];
  decisions: string[];
  // General & Podcast
  topics?: TopicItem[];
  conclusions?: string[];
  // Podcast
  quotes?: QuoteItem[];
  takeaways?: string[];
  // Interrogatorios
  declared_facts?: DeclaredFactItem[];
  contradictions?: ContradictionItem[];
  key_questions?: KeyQuestionItem[];
  evidence_assessment?: string;
  error?: boolean;
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
