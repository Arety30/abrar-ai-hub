export interface ChatResponse {
  text: string;
  model: string;
  action: {
    type: string;
    details: string;
  } | null;
}

export interface Note {
  id: number;
  title: string;
  body: string;
  tags: string[];
  links: string[];
  updated: string;
}

export interface DocumentSource {
  id: number;
  title: string;
  source: string;
  category: string;
  text: string;
}

export interface RAGResponse {
  answer: string;
  sources: {
    doc_id: number;
    title: string;
  }[];
}

export interface StudyGuideResponse {
  kind: 'guide';
  markdown: string;
}

export interface StudyItemsResponse {
  kind: 'flashcards' | 'quiz';
  items: any[];
}

export interface GraphNode {
  id: string;
  label: string;
  type: 'note' | 'meeting';
  tags?: string[];
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface GraphResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface HealthResponse {
  ok: boolean;
  providers: Record<string, string[]>;
}

// Fetch helper with standard timeout and error handling
async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    let errMsg = `Request failed: ${res.statusText}`;
    try {
      const data = await res.json();
      if (data.detail) errMsg = data.detail;
      else if (data.error) errMsg = data.error;
    } catch {
      // Ignore
    }
    throw new Error(errMsg);
  }
  return res.json() as Promise<T>;
}

export const api = {
  // Health & Providers
  getHealth: () => request<HealthResponse>('/health'),

  // Chat
  sendChatMessage: (message: string, conversationId = 1) =>
    request<ChatResponse>('/v1/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversation_id: conversationId, message }),
    }),

  // Voice
  transcribe: (file: Blob, language = 'en') => {
    const formData = new FormData();
    formData.append('file', file, 'audio.wav');
    return request<{ text: string }>(`/v1/voice/transcribe?language=${language}`, {
      method: 'POST',
      body: formData,
    });
  },

  speak: async (text: string, voice?: string): Promise<Blob> => {
    const res = await fetch('/v1/voice/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice }),
    });
    if (!res.ok) throw new Error('TTS conversion failed');
    return res.blob();
  },

  converse: (file: Blob, conversationId = 1, language = 'en') => {
    const formData = new FormData();
    formData.append('file', file, 'audio.wav');
    return request<{ text: string; response: string; model: string }>(
      `/v1/voice/converse?conversation_id=${conversationId}&language=${language}`,
      {
        method: 'POST',
        body: formData,
      }
    );
  },

  // Documents / RAG
  addDocument: (title: string, text: string, category = 'note', source = 'manual') =>
    request<{ document_id: number; chunks: number }>('/v1/docs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, text, category, source }),
    }),

  getDocuments: () => request<DocumentSource[]>('/v1/docs'),

  deleteDocument: (docId: number) =>
    request<{ ok: boolean }>(`/v1/docs/${docId}`, { method: 'DELETE' }),

  askRAG: (question: string, docIds?: number[]) =>
    request<RAGResponse>('/v1/docs/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, doc_ids: docIds }),
    }),

  generateStudy: (kind: 'guide' | 'flashcards' | 'quiz', docIds: number[]) =>
    request<StudyGuideResponse | StudyItemsResponse>('/v1/study/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, doc_ids: docIds }),
    }),

  // Notes & Graph
  createNote: (title: string, body: string, tags?: string[]) =>
    request<Note>('/v1/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body, tags }),
    }),

  getNotes: () => request<Note[]>('/v1/notes'),

  updateNote: (noteId: number, body: string) =>
    request<{ id: number; links: string[] }>(`/v1/notes/${noteId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    }),

  deleteNote: (noteId: number) =>
    request<{ ok: boolean }>(`/v1/notes/${noteId}`, { method: 'DELETE' }),

  getNoteGraph: () => request<GraphResponse>('/v1/notes/graph'),

  getBacklinks: (title: string) =>
    request<{ backlinks: { id: number; title: string }[] }>(`/v1/notes/backlinks?title=${encodeURIComponent(title)}`),
};
