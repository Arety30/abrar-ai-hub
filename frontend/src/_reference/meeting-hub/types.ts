export interface Document {
  id: string;
  title: string;
  content: string;
  sourceUrl?: string;
  category: string;
  wordCount: number;
  uploadedAt: string;
}

export interface Participant {
  id: string;
  name: string;
  isAI: boolean;
  activeSpeaker: boolean;
  cameraOn: boolean;
  micOn: boolean;
  isLocal: boolean;
  color: string;
  role: string;
  avatarIcon: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
  isAI: boolean;
  color: string;
}

export interface TranscriptEntry {
  id: string;
  speaker: string;
  text: string;
  timestamp: string;
  isAI: boolean;
}

export interface Flashcard {
  question: string;
  answer: string;
}

// --- Obsidian Note Workspace Types ---
export interface ObsidianFile {
  id: string;
  name: string; // e.g. "Meeting Summary.md"
  content: string;
  tags: string[];
  lastModified: string;
  size: number;
  type: "note" | "attachment";
}

export interface ObsidianPlugin {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  category: "utility" | "ai" | "visualization";
}

export interface GraphNode {
  id: string;
  label: string;
  type: "note" | "meeting" | "transcript" | "ai-chat";
  x: number;
  y: number;
  vx?: number;
  vy?: number;
}

export interface GraphLink {
  source: string;
  target: string;
}
