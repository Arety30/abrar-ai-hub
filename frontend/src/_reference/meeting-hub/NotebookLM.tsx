import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Plus, 
  BookOpen, 
  FileText, 
  Globe, 
  Trash2, 
  Sparkles, 
  Send, 
  HelpCircle, 
  CheckCircle, 
  ArrowRight,
  Upload
} from "lucide-react";
import { Document } from "../types";

interface NotebookLMProps {
  documents: Document[];
  setDocuments: React.Dispatch<React.SetStateAction<Document[]>>;
  selectedDocId: string | null;
  setSelectedDocId: (id: string | null) => void;
}

// Built-in academic presets so the user can test the NotebookLM integration instantly!
export const PRESET_DOCUMENTS: Document[] = [
  {
    id: "preset-1",
    title: "Introduction to Transformer Architectures",
    content: `The Transformer is a deep learning model architecture introduced in the landmark 2017 paper "Attention Is All You Need." Unlike its predecessors like Recurrent Neural Networks (RNNs) and Long Short-Term Memory (LSTM) networks, the Transformer relies entirely on self-attention mechanisms to compute representations of its input and output without using sequence-aligned RNNs or convolution.

The central component of the Transformer is the Multi-Head Self-Attention layer. Instead of performing a single attention function, multi-head attention allows the model to jointly attend to information from different representation subspaces at different positions. This allows the model to process sequences in parallel, dramatically speeding up training times and enabling models like GPT, BERT, and Gemini to scale to trillions of parameters.

Key features of Transformers include:
1. Positional Encodings: Since Transformers process all tokens in parallel, they lack native awareness of sequence order. Positional encodings are added to the input embeddings to convey the relative or absolute position of tokens.
2. Feed-Forward Networks: Applied to each position identically and independently.
3. Residual Connections & Layer Normalization: Placed around each sub-layer to aid gradient flow during backpropagation.`,
    category: "AI & Machine Learning",
    wordCount: 198,
    uploadedAt: "Preset Resource"
  },
  {
    id: "preset-2",
    title: "Understanding Retrieval-Augmented Generation (RAG)",
    content: `Retrieval-Augmented Generation (RAG) is a highly popular technique designed to optimize the output of Large Language Models (LLMs) by querying authoritative external knowledge bases before generating a response. 

Normally, LLMs are frozen in time; their knowledge is limited strictly to their training dataset cutoff. RAG solves this limitation and significantly reduces hallucinations by implementing a multi-step pipeline:
1. Ingestion: Documents (PDFs, Wikis, internal guides) are chunked into smaller, readable passages and passed to an embedding model.
2. Vector Indexing: The embedding model converts text passages into multi-dimensional numerical vectors, which are saved in a vector database.
3. Retrieval: When a user submits a query, the system converts the query into a vector, calculates cosine similarity, and fetches the top corresponding document chunks.
4. Augmentation: The retrieved chunks are formatted alongside the original query into the LLM's system prompt context.
5. Generation: The LLM reads this verified background information and generates a precise, factually grounded answer referencing the provided sources.`,
    category: "System Design",
    wordCount: 184,
    uploadedAt: "Preset Resource"
  }
];

export default function NotebookLM({
  documents,
  setDocuments,
  selectedDocId,
  setSelectedDocId,
}: NotebookLMProps) {
  const [activeTab, setActiveTab] = useState<"sources" | "reader">("sources");
  const [isUploading, setIsUploading] = useState(false);
  
  // Document Form fields
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newCategory, setNewCategory] = useState("Study Note");

  // AI Q&A States
  const [qaQuery, setQaQuery] = useState("");
  const [qaAnswer, setQaAnswer] = useState("");
  const [isQaLoading, setIsQaLoading] = useState(false);

  const selectedDoc = documents.find(d => d.id === selectedDocId) || null;

  // Handles adding custom document source
  function handleAddDocument(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    const doc: Document = {
      id: "doc-" + Math.random().toString(36).substring(2),
      title: newTitle.trim(),
      content: newContent.trim(),
      sourceUrl: newUrl.trim() || undefined,
      category: newCategory,
      wordCount: newContent.trim().split(/\s+/).length,
      uploadedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setDocuments(prev => [...prev, doc]);
    setSelectedDocId(doc.id);
    setNewTitle("");
    setNewContent("");
    setNewUrl("");
    setIsUploading(false);
    setActiveTab("reader");
  }

  // Handle URL "Mock Scraping" for rapid learning experience
  async function handleUrlScrape(e: React.FormEvent) {
    e.preventDefault();
    if (!newUrl.trim()) return;

    setIsQaLoading(true);
    // Simulate smart page extraction using self-hosted OpenAI Whisper / Llama 3.2 synthesis:
    try {
      const response = await fetch("/api/local/speech-to-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: `Write a 200-word highly authoritative academic study outline summarizing the theoretical framework of the webpage: ${newUrl}` }),
      });
      const data = await response.json();
      
      const doc: Document = {
        id: "scrape-" + Math.random().toString(36).substring(2),
        title: `Scraped: ${newUrl.replace("https://", "").replace("http://", "").split("/")[0]}`,
        content: data.text || `Theoretical web overview of ${newUrl}. Full integration logs captured dynamically.`,
        sourceUrl: newUrl,
        category: "Web Resource",
        wordCount: (data.text || "").split(/\s+/).length,
        uploadedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setDocuments(prev => [...prev, doc]);
      setSelectedDocId(doc.id);
      setNewUrl("");
      setIsUploading(false);
      setActiveTab("reader");
    } catch (err) {
      console.error(err);
    } finally {
      setIsQaLoading(false);
    }
  }

  // Ask AI about this document
  async function askQuestion(e: React.FormEvent) {
    e.preventDefault();
    if (!qaQuery.trim() || !selectedDoc) return;

    setIsQaLoading(true);
    setQaAnswer("");

    try {
      const response = await fetch("/api/local/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ id: "1", senderId: "user", senderName: "User", text: qaQuery, isAI: false, color: "text-white", timestamp: "" }],
          documents: [selectedDoc],
          activeSpeaker: "Lumina",
          transcript: []
        }),
      });
      const data = await response.json();
      setQaAnswer(data.text);
    } catch (err: any) {
      setQaAnswer("Could not fetch answer: " + err.message);
    } finally {
      setIsQaLoading(false);
    }
  }

  function deleteDocument(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setDocuments(prev => prev.filter(d => d.id !== id));
    if (selectedDocId === id) {
      setSelectedDocId(null);
    }
  }

  return (
    <div id="notebook-panel-container" className="flex flex-col h-full bg-neutral-900/85 backdrop-blur-xl border border-emerald-900/40 rounded-2xl overflow-hidden shadow-2xl">
      
      {/* Tab Selectors */}
      <div className="flex bg-black/40 border-b border-emerald-900/30 p-1">
        <button
          id="btn-tab-sources"
          onClick={() => setActiveTab("sources")}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-mono font-medium transition-all duration-200 flex items-center justify-center gap-1.5 ${
            activeTab === "sources" 
              ? "bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 shadow-inner" 
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Study Sources ({documents.length})</span>
        </button>

        <button
          id="btn-tab-reader"
          onClick={() => {
            if (selectedDocId) {
              setActiveTab("reader");
            }
          }}
          disabled={!selectedDocId}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-mono font-medium transition-all duration-200 flex items-center justify-center gap-1.5 ${
            !selectedDocId 
              ? "text-slate-700 cursor-not-allowed opacity-40" 
              : activeTab === "reader" 
                ? "bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 shadow-inner" 
                : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Source Reader</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col">
        <AnimatePresence mode="wait">
          
          {/* TAB 1: Sources Index */}
          {activeTab === "sources" && (
            <motion.div
              key="sources-tab"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="space-y-4 flex-1 flex flex-col"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-100 font-sans tracking-tight">Study Material Repository</h3>
                  <p className="text-[11px] text-slate-400 font-sans">Click on any loaded document to inspect the content and ask questions.</p>
                </div>
                <button
                  id="btn-add-source-toggle"
                  onClick={() => setIsUploading(!isUploading)}
                  className="p-1.5 rounded-full bg-emerald-800 text-white hover:bg-emerald-700 transition-all flex items-center justify-center shadow-md active:scale-95 border border-emerald-600/30"
                  title="Add custom source"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Source addition modal panel */}
              {isUploading && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="bg-black/40 border border-emerald-900/30 p-3 rounded-xl space-y-3 overflow-hidden"
                >
                  <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-widest block">Add Study Source</span>
                  
                  {/* Enter URL scraper */}
                  <form onSubmit={handleUrlScrape} className="grid grid-cols-12 gap-2 border-b border-emerald-900/20 pb-3">
                    <div className="col-span-9">
                      <input
                        id="input-scrape-url"
                        type="url"
                        placeholder="Paste study URL (e.g. Wikipedia)"
                        value={newUrl}
                        onChange={(e) => setNewUrl(e.target.value)}
                        className="w-full text-xs bg-white/5 text-slate-200 border border-emerald-900/20 rounded px-2.5 py-1.5 focus:outline-none focus:border-emerald-700 font-sans placeholder:text-slate-600"
                      />
                    </div>
                    <button
                      id="btn-scrape-url"
                      type="submit"
                      disabled={isQaLoading || !newUrl}
                      className="col-span-3 bg-emerald-900/30 text-emerald-300 border border-emerald-800/40 rounded text-xs py-1.5 hover:bg-emerald-800/30 transition font-mono disabled:opacity-45"
                    >
                      Scrape
                    </button>
                  </form>

                  {/* Manual Paste */}
                  <form onSubmit={handleAddDocument} className="space-y-2.5">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        id="input-doc-title"
                        type="text"
                        placeholder="Document Title"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        required
                        className="text-xs bg-white/5 text-slate-200 border border-emerald-900/20 rounded px-2.5 py-1.5 focus:outline-none focus:border-emerald-700 font-sans placeholder:text-slate-600"
                      />
                      <select
                        id="select-doc-category"
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                        className="text-xs bg-black/40 text-slate-300 border border-emerald-900/20 rounded px-2.5 py-1.5 focus:outline-none focus:border-emerald-700 font-sans"
                      >
                        <option value="Study Note">Study Note</option>
                        <option value="Lecture Notes">Lecture Notes</option>
                        <option value="Textbook Chapter">Textbook Chapter</option>
                        <option value="Web Outline">Web Outline</option>
                      </select>
                    </div>

                    <textarea
                      id="textarea-doc-content"
                      placeholder="Paste text contents of lecture notes or research papers..."
                      value={newContent}
                      onChange={(e) => setNewContent(e.target.value)}
                      required
                      rows={4}
                      className="w-full text-xs bg-white/5 text-slate-200 border border-emerald-900/20 rounded p-2.5 focus:outline-none focus:border-emerald-700 font-sans leading-relaxed placeholder:text-slate-600"
                    />

                    <div className="flex justify-end gap-2 text-xs font-mono">
                      <button
                        id="btn-cancel-upload"
                        type="button"
                        onClick={() => setIsUploading(false)}
                        className="px-3 py-1.5 text-slate-400 hover:text-slate-250 transition"
                      >
                        Cancel
                      </button>
                      <button
                        id="btn-submit-upload"
                        type="submit"
                        className="px-3 py-1.5 bg-emerald-850 hover:bg-emerald-800 text-white rounded transition shadow border border-emerald-700/50 font-mono"
                      >
                        Add Source
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}

              {/* Loaded document list */}
              <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[220px]">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    id={`doc-card-${doc.id}`}
                    onClick={() => {
                      setSelectedDocId(doc.id);
                      setActiveTab("reader");
                    }}
                    className={`p-3 rounded-xl border transition-all duration-200 cursor-pointer flex items-center justify-between group ${
                      selectedDocId === doc.id
                        ? "bg-emerald-950/40 border-emerald-700/50 shadow shadow-emerald-950/40"
                        : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center border border-white/10">
                        {doc.sourceUrl ? (
                          <Globe className="w-5 h-5 text-sky-400" />
                        ) : (
                          <FileText className="w-5 h-5 text-sky-400" />
                        )}
                      </div>
                      <div className="space-y-0.5">
                        <h4 className="text-xs font-bold text-slate-100 font-sans line-clamp-1">{doc.title}</h4>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 font-mono">{doc.wordCount} words</span>
                          <span className="w-1 h-1 bg-white/20 rounded-full" />
                          <span className="text-[9px] bg-emerald-950 text-emerald-400 font-mono font-bold px-1.5 py-0.25 rounded border border-emerald-900/30">
                            {doc.category}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      id={`delete-doc-btn-${doc.id}`}
                      onClick={(e) => deleteDocument(doc.id, e)}
                      className="p-1.5 rounded-md hover:bg-rose-950/45 text-slate-500 hover:text-rose-400 transition opacity-0 group-hover:opacity-100"
                      title="Remove source"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                {documents.length === 0 && (
                  <div className="flex flex-col items-center justify-center text-center p-8 border border-dashed border-emerald-900/30 rounded-xl bg-white/5">
                    <Upload className="w-8 h-8 text-slate-500 mb-3 animate-pulse" />
                    <span className="text-xs font-bold text-slate-300 font-sans block">No Materials Uploaded</span>
                    <p className="text-[10px] text-slate-500 max-w-xs mt-1 leading-relaxed font-sans">
                      Add a custom article, paste lecture notes, scrape website frameworks, or load presets to activate the NotebookLM companion.
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* TAB 2: Source Reader */}
          {activeTab === "reader" && selectedDoc && (
            <motion.div
              key="reader-tab"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="space-y-4 flex-1 flex flex-col"
            >
              {/* Document metadata info banner */}
              <div className="p-3 bg-white/5 rounded-xl border border-white/10 flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-[9px] uppercase tracking-widest font-mono text-emerald-400 font-bold">SOURCE VIEWER</span>
                  <h4 className="text-xs font-bold text-white font-sans line-clamp-1">{selectedDoc.title}</h4>
                </div>
                <button
                  id="btn-back-to-sources"
                  onClick={() => setActiveTab("sources")}
                  className="text-[10px] font-mono font-medium text-slate-300 hover:text-white transition bg-white/10 px-2.5 py-1 rounded border border-white/10"
                >
                  Change Source
                </button>
              </div>

              {/* Document full contents */}
              <div className="flex-1 max-h-[160px] overflow-y-auto p-3.5 bg-black/40 rounded-xl border border-emerald-900/20 font-sans text-xs text-slate-300 leading-relaxed space-y-3 select-text select-all">
                {selectedDoc.content.split("\n\n").map((para, idx) => (
                  <p key={idx}>{para}</p>
                ))}
              </div>

              {/* Interactive NotebookLM AI Q&A panel */}
              <div className="space-y-3 pt-2 border-t border-emerald-900/20">
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <Sparkles className="w-4 h-4 text-sky-400" />
                  <span className="text-xs font-bold font-mono">Query this Source with AI</span>
                </div>

                <form onSubmit={askQuestion} className="flex gap-1.5">
                  <input
                    id="input-qa-query"
                    type="text"
                    placeholder="e.g. What are the key features of Transformers?"
                    value={qaQuery}
                    onChange={(e) => setQaQuery(e.target.value)}
                    className="flex-1 text-xs bg-black/40 border border-emerald-900/30 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-700 font-sans placeholder:text-slate-600"
                  />
                  <button
                    id="btn-submit-qa"
                    type="submit"
                    disabled={isQaLoading || !qaQuery.trim()}
                    className="p-2 bg-emerald-800 hover:bg-emerald-700 text-white rounded-lg transition shadow disabled:opacity-50 border border-emerald-600/30"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>

                {/* AI Q&A Response window */}
                <AnimatePresence>
                  {(isQaLoading || qaAnswer) && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="p-3 bg-emerald-950/40 border border-emerald-800/40 rounded-xl space-y-1.5 overflow-hidden"
                    >
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                        <span className="text-[10px] font-mono font-bold text-emerald-400">NotebookLM AI</span>
                      </div>
                      
                      {isQaLoading ? (
                        <div className="space-y-1.5 py-1">
                          <div className="h-2 bg-white/5 rounded animate-pulse w-5/6" />
                          <div className="h-2 bg-white/5 rounded animate-pulse w-full" />
                          <div className="h-2 bg-white/5 rounded animate-pulse w-2/3" />
                        </div>
                      ) : (
                        <p className="text-xs text-slate-300 leading-relaxed font-sans">{qaAnswer}</p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
