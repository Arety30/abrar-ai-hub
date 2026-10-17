import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Sparkles, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight, 
  CheckSquare, 
  BookOpen, 
  CheckCircle2, 
  HelpCircle,
  FileSpreadsheet
} from "lucide-react";
import { Document, TranscriptEntry, Flashcard } from "../types";

interface NotesPanelProps {
  documents: Document[];
  transcript: TranscriptEntry[];
}

export default function NotesPanel({ documents, transcript }: NotesPanelProps) {
  const [activeTab, setActiveTab] = useState<"guide" | "cards" | "tasks">("guide");
  const [isLoading, setIsLoading] = useState(false);
  
  // Synthesized outputs
  const [studyGuide, setStudyGuide] = useState<string>("");
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [actionItems, setActionItems] = useState<string>("");

  // Flashcards state
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Simulated task check list
  const [checkedTasks, setCheckedTasks] = useState<Record<string, boolean>>({});

  // 1. Synthesize materials with Local Llama 3.2 API
  async function generateSynthesis(type: "guide" | "cards" | "tasks") {
    setIsLoading(true);
    try {
      const response = await fetch("/api/local/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documents,
          transcript,
          type: type === "guide" ? "study_guide" : type === "cards" ? "flashcards" : "action_items"
        })
      });
      const data = await response.json();

      if (type === "guide") {
        setStudyGuide(data.result);
      } else if (type === "cards") {
        let cardsArr: Flashcard[] = [];
        try {
          // Parse potential double-wrapped string JSON
          const rawResult = typeof data.result === "string" ? JSON.parse(data.result) : data.result;
          cardsArr = Array.isArray(rawResult) ? rawResult : [];
        } catch (e) {
          console.warn("Parsing flashcard JSON failed, creating structured fallback", e);
          cardsArr = [
            { question: "Attention Mechanism purpose?", answer: "Enables models to focus dynamically on different token positions regardless of sequence distance." },
            { question: "How does RAG avoid hallucinations?", answer: "By retrieving verified, factually grounded external texts before generating the answer." }
          ];
        }
        setFlashcards(cardsArr);
        setCurrentCardIndex(0);
        setIsFlipped(false);
      } else {
        setActionItems(data.result);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  // Pre-seed mock data if user hasn't queried Llama yet
  const defaultStudyGuide = `### 📚 Study Room Quick Summary

Welcome to your study hub! Select "Generate with Llama 3.2" to synthesize your study sources locally.

*   **Transformers Overview**: Learn about parallel self-attention layers that revolutionized natural language processing.
*   **Retrieval Augmented Generation**: Learn how external vector indices ground language generation, solving hallucinations and outdated facts.
*   **Active Meeting logs**: The chronological conversation and voice transcript are automatically referenced by the local AI companion.`;

  const defaultActionItems = `### 📋 Meeting Actions & Takeaways

Click "Generate Action Items" above to extract actionables.

*   [ ] Read the original Transformer "Attention Is All You Need" paper (All).
*   [ ] Set up an Express backend route for indexing document vectors (Lead developer).
*   [ ] Design the vector similarity search queries using Cosine Similarity (Data team).`;

  function toggleTask(idx: number) {
    setCheckedTasks(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  }

  return (
    <div id="notes-panel-container" className="flex flex-col h-full bg-neutral-900/85 backdrop-blur-xl border border-emerald-900/40 rounded-2xl overflow-hidden shadow-2xl">
      
      {/* Header section with generation button */}
      <div className="p-4 bg-black/20 border-b border-emerald-900/30 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-950 border border-emerald-900/50">
            <Sparkles className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white font-sans">Notebook Local Llama 3.2 Synthesis Panel</h4>
            <p className="text-[10px] text-slate-400 font-sans">Convert meeting transcripts & loaded sources into structured outlines locally.</p>
          </div>
        </div>

        <button
          id={`btn-synthesis-${activeTab}`}
          onClick={() => generateSynthesis(activeTab)}
          disabled={isLoading || documents.length === 0}
          className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-800 to-emerald-700 hover:from-emerald-700 hover:to-emerald-600 text-white font-mono text-xs font-semibold rounded-lg shadow-md hover:shadow-emerald-950 transition flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed border border-emerald-600/30"
        >
          {isLoading ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Synthesizing...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 animate-pulse text-sky-300" />
              <span>Generate with Llama 3.2</span>
            </>
          )}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex bg-black/30 border-b border-emerald-900/30 p-1">
        {[
          { id: "guide", label: "Study Guide" },
          { id: "cards", label: "Flashcards" },
          { id: "tasks", label: "Action Items" }
        ].map(tab => (
          <button
            key={tab.id}
            id={`btn-tab-synth-${tab.id}`}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 py-2 rounded-lg text-[10px] font-mono font-semibold transition-all duration-200 ${
              activeTab === tab.id 
                ? "bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 shadow-inner" 
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Body panel container */}
      <div className="flex-1 p-4 overflow-y-auto min-h-[300px]">
        <AnimatePresence mode="wait">
          
          {/* TAB 1: Study Guide */}
          {activeTab === "guide" && (
            <motion.div
              key="guide-panel"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="prose prose-invert max-w-none text-slate-300 text-xs leading-relaxed space-y-3 font-sans">
                {studyGuide ? (
                  // Simple markdown renderer support
                  studyGuide.split("\n").map((line, i) => {
                    if (line.startsWith("###")) {
                      return <h4 key={i} className="text-sm font-bold text-white mt-4 border-b border-emerald-900/20 pb-1 font-sans">{line.replace("###", "")}</h4>;
                    } else if (line.startsWith("##")) {
                      return <h3 key={i} className="text-base font-bold text-white mt-4 font-sans">{line.replace("##", "")}</h3>;
                    } else if (line.startsWith("#")) {
                      return <h2 key={i} className="text-lg font-bold text-white mt-4 font-sans">{line.replace("#", "")}</h2>;
                    } else if (line.startsWith("*") || line.startsWith("-")) {
                      return <li key={i} className="ml-4 list-disc text-slate-300 font-sans">{line.substring(2)}</li>;
                    } else {
                      return <p key={i} className="text-slate-300 font-sans">{line}</p>;
                    }
                  })
                ) : (
                  // Default visual state
                  defaultStudyGuide.split("\n").map((line, i) => {
                    if (line.startsWith("###")) {
                      return <h4 key={i} className="text-sm font-bold text-emerald-400 font-sans mt-2">{line.replace("###", "")}</h4>;
                    } else if (line.startsWith("*") || line.startsWith("-")) {
                      return <li key={i} className="ml-4 list-disc text-slate-350 font-sans">{line.substring(2)}</li>;
                    } else {
                      return <p key={i} className="text-slate-350 font-sans">{line}</p>;
                    }
                  })
                )}
              </div>
            </motion.div>
          )}

          {/* TAB 2: Flashcards Deck */}
          {activeTab === "cards" && (
            <motion.div
              key="cards-panel"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center space-y-6 py-4"
            >
              {flashcards.length > 0 ? (
                <div className="w-full max-w-sm flex flex-col items-center space-y-4">
                  {/* Outer Flip Card Container */}
                  <div 
                    id="flashcard-element"
                    onClick={() => setIsFlipped(!isFlipped)}
                    className="w-full h-48 cursor-pointer relative perspective"
                  >
                    <motion.div
                      animate={{ rotateY: isFlipped ? 180 : 0 }}
                      transition={{ duration: 0.6, ease: "easeInOut" }}
                      className="w-full h-full relative preserve-3d"
                    >
                      {/* CARD FRONT: Question */}
                      <div className={`absolute inset-0 bg-black/40 border border-emerald-900/30 rounded-2xl p-6 flex flex-col justify-between backface-hidden ${isFlipped ? 'pointer-events-none opacity-0' : 'opacity-100'}`}>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-widest">Question {currentCardIndex + 1} of {flashcards.length}</span>
                          <HelpCircle className="w-4 h-4 text-emerald-400" />
                        </div>
                        <p className="text-sm font-bold text-slate-100 text-center font-display tracking-tight leading-relaxed select-text">
                          {flashcards[currentCardIndex].question}
                        </p>
                        <span className="text-[9px] text-slate-500 font-mono text-center">Click card to reveal answer</span>
                      </div>

                      {/* CARD BACK: Answer */}
                      <div className={`absolute inset-0 bg-emerald-950/35 border border-emerald-800/40 rounded-2xl p-6 flex flex-col justify-between backface-hidden [transform:rotateY(180deg)] ${!isFlipped ? 'pointer-events-none opacity-0' : 'opacity-100'}`}>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono font-bold text-sky-400 uppercase tracking-widest">Answer</span>
                          <CheckCircle2 className="w-4 h-4 text-sky-400" />
                        </div>
                        <p className="text-xs text-slate-200 text-center font-sans leading-relaxed select-text">
                          {flashcards[currentCardIndex].answer}
                        </p>
                        <span className="text-[9px] text-slate-500 font-mono text-center">Click card to view question</span>
                      </div>
                    </motion.div>
                  </div>

                  {/* Navigator arrows */}
                  <div className="flex items-center gap-4">
                    <button
                      id="btn-prev-card"
                      disabled={currentCardIndex === 0}
                      onClick={() => {
                        setCurrentCardIndex(prev => prev - 1);
                        setIsFlipped(false);
                      }}
                      className="p-2 bg-white/10 border border-white/10 rounded-full text-slate-350 hover:text-white disabled:opacity-40 hover:bg-white/15"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs text-slate-400 font-mono">{currentCardIndex + 1} / {flashcards.length}</span>
                    <button
                      id="btn-next-card"
                      disabled={currentCardIndex === flashcards.length - 1}
                      onClick={() => {
                        setCurrentCardIndex(prev => prev + 1);
                        setIsFlipped(false);
                      }}
                      className="p-2 bg-white/10 border border-white/10 rounded-full text-slate-350 hover:text-white disabled:opacity-40 hover:bg-white/15"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center p-8 border border-emerald-900/20 rounded-xl w-full bg-white/5">
                  <FileSpreadsheet className="w-8 h-8 text-slate-700 mb-2 animate-pulse" />
                  <span className="text-xs font-bold text-slate-300 font-sans block">No Flashcards Synthesized</span>
                  <p className="text-[10px] text-slate-500 max-w-xs mt-1 font-sans">
                    Click "Generate with AI" above to transform your lecture materials and active discussion notes into interactive study study cards.
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {/* TAB 3: Action Items */}
          {activeTab === "tasks" && (
            <motion.div
              key="tasks-panel"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="text-xs text-slate-300 font-sans space-y-3 leading-relaxed">
                {actionItems ? (
                  actionItems.split("\n").map((line, i) => {
                    if (line.startsWith("###")) {
                      return <h4 key={i} className="text-sm font-bold text-white mt-4 border-b border-emerald-900/20 pb-1 font-sans">{line.replace("###", "")}</h4>;
                    } else if (line.startsWith("* [") || line.startsWith("- [")) {
                      // Custom interactive checkbox items!
                      const taskText = line.substring(6);
                      const isChecked = checkedTasks[i] || false;
                      return (
                        <div key={i} className="flex items-start gap-2.5 mt-2 group cursor-pointer" onClick={() => toggleTask(i)}>
                          <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-all ${
                            isChecked ? "bg-emerald-600 border-emerald-500 text-white" : "bg-white/5 border-white/10 group-hover:border-white/20"
                          }`}>
                            {isChecked && <div className="w-2 h-2 bg-white rounded-sm" />}
                          </div>
                          <span className={`text-xs font-sans select-none transition-all ${isChecked ? "line-through text-slate-500" : "text-slate-300"}`}>
                            {taskText}
                          </span>
                        </div>
                      );
                    } else {
                      return <p key={i} className="text-slate-300 font-sans">{line}</p>;
                    }
                  })
                ) : (
                  // Default visual checklist
                  defaultActionItems.split("\n").map((line, i) => {
                    if (line.startsWith("###")) {
                      return <h4 key={i} className="text-sm font-bold text-emerald-400 font-sans mt-2">{line.replace("###", "")}</h4>;
                    } else if (line.startsWith("* [") || line.startsWith("- [")) {
                      const taskText = line.substring(6);
                      const isChecked = checkedTasks[i] || false;
                      return (
                        <div key={i} className="flex items-start gap-2.5 mt-2 group cursor-pointer" onClick={() => toggleTask(i)}>
                          <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-all ${
                            isChecked ? "bg-emerald-600 border-emerald-500 text-white" : "bg-white/5 border-white/10"
                          }`}>
                            {isChecked && <div className="w-2 h-2 bg-white rounded-sm" />}
                          </div>
                          <span className={`text-xs font-sans select-none transition-all ${isChecked ? "line-through text-slate-500" : "text-slate-350"}`}>
                            {taskText}
                          </span>
                        </div>
                      );
                    } else {
                      return <p key={i} className="text-slate-350 font-sans">{line}</p>;
                    }
                  })
                )}
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {documents.length === 0 && (
        <div className="p-3 bg-emerald-950/20 border-t border-emerald-900/35 text-center">
          <span className="text-[10px] text-emerald-300 font-mono">⚠️ Synthesis requires at least 1 study document loaded.</span>
        </div>
      )}
    </div>
  );
}
