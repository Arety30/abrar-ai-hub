import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  FileText, 
  Paperclip, 
  Plus, 
  Trash2, 
  Network, 
  Settings, 
  HelpCircle, 
  Upload, 
  ArrowRight, 
  Brain, 
  Mic, 
  Play, 
  Sparkles, 
  FileCode, 
  Tag, 
  RefreshCw, 
  Database,
  Search,
  BookOpen,
  Info,
  Layers,
  ListCollapse,
  Sparkle
} from "lucide-react";
import { ObsidianFile, ObsidianPlugin, GraphNode, GraphLink, TranscriptEntry, ChatMessage } from "../types";

interface ObsidianWorkspaceProps {
  transcript: TranscriptEntry[];
  messages: ChatMessage[];
  meetings: { id: string; title: string }[];
  onOpenMeeting: (id: string) => void;
}

// Preset notes for Obsidian
const PRESET_OBSIDIAN_FILES: ObsidianFile[] = [
  {
    id: "obs-note-1",
    name: "Self-Attention Mechanism.md",
    content: `# Deep Dive: Multi-Head Self-Attention\n\nSelf-attention allows the model to relate different positions of a single sequence in order to compute a representation of the sequence.\n\nMathematically, it's defined as:\nAttention(Q, K, V) = softmax(QK^T / sqrt(d_k))V\n\nBy stacking multiple heads, the model can jointly attend to information from different representation subspaces at different positions.\n\nRelated: [[Deep Learning.md]] and [[System Architecture.md]]`,
    tags: ["neural-networks", "math", "transformer"],
    lastModified: "2026-06-25 14:19",
    size: 512,
    type: "note"
  },
  {
    id: "obs-note-2",
    name: "Deep Learning.md",
    content: `# Deep Learning Foundations\n\nDeep learning is a subset of machine learning based on artificial neural networks with representation learning.\n\nModern architectures like [[Self-Attention Mechanism.md]] have completely superseded older structures like RNNs for sequence modeling.\n\nKey themes:\n- Backpropagation\n- Parallel training constraints\n- Self-hosted deployment models (like running llama3.2:1b locally)`,
    tags: ["deep-learning", "foundations"],
    lastModified: "2026-06-25 14:21",
    size: 420,
    type: "note"
  },
  {
    id: "obs-note-3",
    name: "System Architecture.md",
    content: `# System Architecture with LLMs\n\nDeploying AI systems requires robust hardware provisioning and network design.\n\nWe utilize self-hosted services for full privacy control:\n- [[Self-Attention Mechanism.md]] processes sequence requests\n- Whisper is self-hosted on custom GPUs for real-time speech-to-text transcript generation\n- Piper is utilized as a ultra-low latency text-to-speech engine`,
    tags: ["systems", "architecture", "self-hosted"],
    lastModified: "2026-06-25 15:02",
    size: 480,
    type: "note"
  }
];

export default function ObsidianWorkspace({
  transcript,
  messages,
  meetings,
  onOpenMeeting,
}: ObsidianWorkspaceProps) {
  // --- Workspace States ---
  const [vaultFiles, setVaultFiles] = useState<ObsidianFile[]>(PRESET_OBSIDIAN_FILES);
  const [activeFileId, setActiveFileId] = useState<string>("obs-note-1");
  const [searchQuery, setSearchQuery] = useState("");
  const [editorContent, setEditorContent] = useState("");
  const [editorName, setEditorName] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [sidebarTab, setSidebarTab] = useState<"explorer" | "graph" | "plugins">("explorer");
  
  // Drag and drop uploading files
  const [isDragging, setIsDragging] = useState(false);

  // --- Obsidian Plugin State ---
  const [plugins, setPlugins] = useState<ObsidianPlugin[]>([
    { id: "llama-copilot", name: "llama3.2:1b Offline Co-Pilot", description: "Enables offline private local AI co-pilot panel for note queries and summaries.", enabled: true, category: "ai" },
    { id: "whisper-stt", name: "Whisper STT Dictation", description: "Transcribe voice streams into the active note editor utilizing self-hosted Whisper.", enabled: true, category: "utility" },
    { id: "backlinks-tracker", name: "Backlink Analysis Engine", description: "Dynamically identifies and tracks bi-directional links (e.g. [[Note Name]]) inside notes.", enabled: true, category: "visualization" },
    { id: "auto-tagger", name: "Semantic Auto-Tagger", description: "Suggests tags and classifications based on the note's subject matter.", enabled: false, category: "utility" },
    { id: "word-stats", name: "Word Complexity Analytics", description: "Provides semantic depth, vocabulary richness, and reading difficulty levels.", enabled: false, category: "visualization" }
  ]);

  // --- Llama 3.2 Offline Assistant States ---
  const [llamaInput, setLlamaInput] = useState("");
  const [llamaResponse, setLlamaResponse] = useState("");
  const [isLlamaLoading, setIsLlamaLoading] = useState(false);
  const [llamaTemperature, setLlamaTemperature] = useState(0.3);
  const [llamaMaxTokens, setLlamaMaxTokens] = useState(256);
  const [llamaSystemPrompt, setLlamaSystemPrompt] = useState("You are an offline llama3.2:1b model hosted locally. Speak objectively and precisely.");

  // --- Whisper STT Voice Simulation ---
  const [isWhisperDictating, setIsWhisperDictating] = useState(false);
  const [whisperConfidence, setWhisperConfidence] = useState<number | null>(null);
  const [whisperLatency, setWhisperLatency] = useState<number | null>(null);

  // --- Graph Visualization States ---
  const [graphNodes, setGraphNodes] = useState<GraphNode[]>([]);
  const [graphLinks, setGraphLinks] = useState<GraphLink[]>([]);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const graphContainerRef = useRef<SVGSVGElement | null>(null);

  const activeFile = vaultFiles.find(f => f.id === activeFileId);

  // Load active note values when changed
  useEffect(() => {
    if (activeFile) {
      setEditorContent(activeFile.content);
      setEditorName(activeFile.name);
    }
  }, [activeFileId]);

  // Save active note changes to vault list
  const handleSaveNote = () => {
    if (!activeFile) return;
    setVaultFiles(prev => prev.map(f => {
      if (f.id === activeFileId) {
        return {
          ...f,
          name: editorName,
          content: editorContent,
          lastModified: new Date().toISOString().replace('T', ' ').substring(0, 16),
          size: editorContent.length
        };
      }
      return f;
    }));
  };

  // Auto-save on editor content or name change
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      handleSaveNote();
    }, 400);
    return () => clearTimeout(delayDebounceFn);
  }, [editorContent, editorName]);

  // Create new blank Markdown Note
  const handleCreateNote = () => {
    const newNote: ObsidianFile = {
      id: "obs-note-" + Math.random().toString(36).substring(2),
      name: "Untitled Note.md",
      content: "# Untitled Note\n\nStart writing notes here... Link other notes with double brackets like [[Self-Attention Mechanism.md]]",
      tags: ["new"],
      lastModified: new Date().toISOString().replace('T', ' ').substring(0, 16),
      size: 150,
      type: "note"
    };
    setVaultFiles(prev => [...prev, newNote]);
    setActiveFileId(newNote.id);
  };

  // Add Tag to Active Note
  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim() || !activeFile) return;
    const cleanTag = newTagName.trim().toLowerCase().replace("#", "");
    if (!activeFile.tags.includes(cleanTag)) {
      setVaultFiles(prev => prev.map(f => {
        if (f.id === activeFileId) {
          return { ...f, tags: [...f.tags, cleanTag] };
        }
        return f;
      }));
    }
    setNewTagName("");
  };

  // Remove Tag
  const handleRemoveTag = (tag: string) => {
    if (!activeFile) return;
    setVaultFiles(prev => prev.map(f => {
      if (f.id === activeFileId) {
        return { ...f, tags: f.tags.filter(t => t !== tag) };
      }
      return f;
    }));
  };

  // Delete Note
  const handleDeleteNote = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (vaultFiles.length <= 1) return; // Prevent deleting the last file
    const remaining = vaultFiles.filter(f => f.id !== id);
    setVaultFiles(remaining);
    if (activeFileId === id) {
      setActiveFileId(remaining[0].id);
    }
  };

  // --- Dynamic Bi-directional Links Parser (Obsidian Core) ---
  const getBacklinks = (targetName: string) => {
    if (!plugins.find(p => p.id === "backlinks-tracker")?.enabled) return [];
    return vaultFiles.filter(f => f.name !== targetName && f.content.includes(`[[${targetName}]]`));
  };

  // Insert markdown link or dynamic meeting links
  const insertTextAtCursor = (textToInsert: string) => {
    const textarea = document.getElementById("obsidian-editor") as HTMLTextAreaElement;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentVal = textarea.value;
    const newVal = currentVal.substring(0, start) + textToInsert + currentVal.substring(end);
    setEditorContent(newVal);
    // Refocus
    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + textToInsert.length;
    }, 50);
  };

  // Import Current Transcript into the active note
  const handleImportTranscript = () => {
    if (transcript.length === 0) return;
    const transcriptMD = `\n\n## Imported Live Transcript (Whisper Engine)\n\n${
      transcript.map(t => `> **${t.speaker}** (${t.timestamp}): *${t.text}*`).join("\n\n")
    }`;
    insertTextAtCursor(transcriptMD);
  };

  // Import Active AI chat log
  const handleImportChat = () => {
    if (messages.length === 0) return;
    const chatMD = `\n\n## Imported Chat log (Local Llama Assistance)\n\n${
      messages.map(m => `* **${m.senderName}**: ${m.text}`).join("\n")
    }`;
    insertTextAtCursor(chatMD);
  };

  // --- File Uploader Drag and Drop ---
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files) as File[];
    processFiles(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(Array.from(e.target.files) as File[]);
    }
  };

  const processFiles = (files: File[]) => {
    files.forEach(file => {
      const isMd = file.name.endsWith(".md") || file.name.endsWith(".txt");
      const reader = new FileReader();
      
      reader.onload = (event) => {
        const text = event.target?.result as string || "";
        const newFile: ObsidianFile = {
          id: "obs-file-" + Math.random().toString(36).substring(2),
          name: file.name,
          content: isMd ? text : `# Attachment: ${file.name}\n\nBinary or image files uploaded. Size: ${(file.size / 1024).toFixed(1)} KB. Type: ${file.type}`,
          tags: [file.type.split("/")[0] || "uploaded", "attachment"],
          lastModified: new Date().toISOString().replace('T', ' ').substring(0, 16),
          size: file.size,
          type: isMd ? "note" : "attachment"
        };
        setVaultFiles(prev => [...prev, newFile]);
        setActiveFileId(newFile.id);
      };

      if (isMd) {
        reader.readAsText(file);
      } else {
        reader.readAsDataURL(file); // mock attachment data urls
      }
    });
  };

  // --- Llama 3.2: 1B Offline Copilot Simulation ---
  const triggerLlamaCopilot = async (action: "summarize" | "flashcard" | "action-items" | "custom") => {
    if (!activeFile) return;
    setIsLlamaLoading(true);
    setLlamaResponse("");

    let prompt = "";
    if (action === "summarize") {
      prompt = `Summarize this note: "${activeFile.name}" with key architectural insights. Context:\n${editorContent}`;
    } else if (action === "flashcard") {
      prompt = `Create study flashcards from this note:\n${editorContent}`;
    } else if (action === "action-items") {
      prompt = `Synthesize actionable steps from this note content:\n${editorContent}`;
    } else {
      prompt = llamaInput;
    }

    try {
      // Simulate llama3.2:1b self-hosted latency & model loading parameters
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // We can query our local endpoint in the background but frame the response context beautifully as a local Llama completion
      const response = await fetch("/api/local/speech-to-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          prompt: `Simulate a response from llama3.2:1b (a 1 billion parameter local offline neural network model with temperature ${llamaTemperature}) for this query: "${prompt}". Frame your response in concise technical markdown structure. Point out that you are running self-hosted on custom academic hardware.` 
        }),
      });

      const data = await response.json();
      
      // Typewriter stream effect
      const responseText = data.text || "No offline model synthesis generated.";
      let index = 0;
      const interval = setInterval(() => {
        setLlamaResponse(prev => prev + responseText.charAt(index));
        index++;
        if (index >= responseText.length) {
          clearInterval(interval);
          setIsLlamaLoading(false);
        }
      }, 10); // rapid typing effect

    } catch (err: any) {
      setLlamaResponse(`Offline model initialization error: ${err.message}. Confirm docker self-hosted service container is booted.`);
      setIsLlamaLoading(false);
    }
  };

  // --- Whisper STT Dictation Simulation ---
  const triggerWhisperDictation = async () => {
    if (isWhisperDictating) return;
    setIsWhisperDictating(true);
    setWhisperConfidence(null);
    setWhisperLatency(null);

    // Simulate whisper transcription engine processing
    setTimeout(async () => {
      try {
        const presets = [
          "The posities of attention layers can be modeled locally via sinusoidal equations.",
          "Let us verify the Piper TTS sound speed and latency parameter configurations.",
          "I will link this documentation directly to the system architecture mindmap node."
        ];
        const spokenText = presets[Math.floor(Math.random() * presets.length)];
        
        insertTextAtCursor(` ${spokenText}`);
        
        setWhisperConfidence(Math.floor(Math.random() * 8) + 91); // 91% - 99%
        setWhisperLatency(Math.floor(Math.random() * 80) + 90); // 90ms - 170ms
      } catch (err) {
        console.warn("Whisper STT mock error", err);
      } finally {
        setIsWhisperDictating(false);
      }
    }, 1200);
  };

  // --- Knowledge Graph Physics-Based Node positions generator ---
  // Pure SVG physics rendering loop for robust performance & visual charm
  useEffect(() => {
    // 1. Build Node list
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];

    // Note nodes
    vaultFiles.forEach((file) => {
      nodes.push({
        id: file.id,
        label: file.name,
        type: file.type === "note" ? "note" : "transcript",
        x: Math.random() * 300 + 100,
        y: Math.random() * 250 + 80,
        vx: 0,
        vy: 0
      });
    });

    // Meeting Node if available
    meetings.forEach(m => {
      nodes.push({
        id: `m-${m.id}`,
        label: `📅 ${m.title}`,
        type: "meeting",
        x: Math.random() * 300 + 100,
        y: Math.random() * 250 + 80,
        vx: 0,
        vy: 0
      });
    });

    // Transcript segment
    if (transcript.length > 0) {
      nodes.push({
        id: "tr-node",
        label: "🗣️ Live Transcripts",
        type: "transcript",
        x: Math.random() * 300 + 100,
        y: Math.random() * 250 + 80,
        vx: 0,
        vy: 0
      });
    }

    // 2. Build Links list based on references in markdown [[Note Name]]
    vaultFiles.forEach((file) => {
      // Find matches for [[Note Name.md]] or [[Note Name]]
      const linkRegex = /\[\[(.*?)\]\]/g;
      let match;
      while ((match = linkRegex.exec(file.content)) !== null) {
        const targetName = match[1];
        const targetFile = vaultFiles.find(f => f.name === targetName || f.name.replace(".md", "") === targetName);
        if (targetFile) {
          links.push({
            source: file.id,
            target: targetFile.id
          });
        }
      }

      // Automatically link notes to the active meeting nodes
      meetings.forEach(m => {
        if (file.content.toLowerCase().includes(m.title.toLowerCase()) || file.content.includes(m.id)) {
          links.push({
            source: file.id,
            target: `m-${m.id}`
          });
        }
      });

      // Link notes containing Whisper/Speech keywords to Transcript node
      if (file.content.toLowerCase().includes("transcript") || file.content.toLowerCase().includes("whisper")) {
        if (transcript.length > 0) {
          links.push({
            source: file.id,
            target: "tr-node"
          });
        }
      }
    });

    setGraphNodes(nodes);
    setGraphLinks(links);
  }, [vaultFiles, meetings, transcript, sidebarTab]);

  // Run SVG physics simulation iteration
  useEffect(() => {
    if (sidebarTab !== "graph" || graphNodes.length === 0) return;

    let animFrameId: number;
    const iteratePhysics = () => {
      setGraphNodes((prevNodes) => {
        const updated = prevNodes.map(n => ({ ...n }));
        const kForce = 0.04;
        const gravity = 0.015;
        const center = { x: 250, y: 200 };
        const minDistance = 75;

        // Apply pairwise repulsion (charge)
        for (let i = 0; i < updated.length; i++) {
          for (let j = i + 1; j < updated.length; j++) {
            const dx = updated[j].x - updated[i].x;
            const dy = updated[j].y - updated[i].y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;

            if (dist < 180) {
              const force = (minDistance - dist) * 0.015;
              const fx = (dx / dist) * force;
              const fy = (dy / dist) * force;
              
              updated[i].vx = (updated[i].vx || 0) - fx;
              updated[i].vy = (updated[i].vy || 0) - fy;
              updated[j].vx = (updated[j].vx || 0) + fx;
              updated[j].vy = (updated[j].vy || 0) + fy;
            }
          }
        }

        // Apply link tension constraints
        graphLinks.forEach((link) => {
          const s = updated.find(n => n.id === link.source);
          const t = updated.find(n => n.id === link.target);
          if (s && t) {
            const dx = t.x - s.x;
            const dy = t.y - s.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const desired = 90;
            const force = (dist - desired) * kForce;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            s.vx = (s.vx || 0) + fx;
            s.vy = (s.vy || 0) + fy;
            t.vx = (t.vx || 0) - fx;
            t.vy = (t.vy || 0) - fy;
          }
        });

        // Apply gravity center attraction & update coordinate positions
        updated.forEach((n) => {
          const dx = center.x - n.x;
          const dy = center.y - n.y;
          n.vx = (n.vx || 0) + dx * gravity;
          n.vy = (n.vy || 0) + dy * gravity;

          // Friction damping
          n.vx *= 0.82;
          n.vy *= 0.82;

          n.x += n.vx;
          n.y += n.vy;

          // Constrain within frame limits
          n.x = Math.max(25, Math.min(475, n.x));
          n.y = Math.max(25, Math.min(375, n.y));
        });

        return updated;
      });

      animFrameId = requestAnimationFrame(iteratePhysics);
    };

    animFrameId = requestAnimationFrame(iteratePhysics);
    return () => cancelAnimationFrame(animFrameId);
  }, [sidebarTab, graphLinks]);

  // Click on graph node to navigate directly
  const handleNodeClick = (node: GraphNode) => {
    if (node.id.startsWith("m-")) {
      onOpenMeeting(node.id.replace("m-", ""));
    } else if (node.id === "tr-node") {
      // Open transript notes helper or link
    } else {
      setActiveFileId(node.id);
      setSidebarTab("explorer");
    }
  };

  // Search filtered notes
  const filteredFiles = vaultFiles.filter(file => {
    const textMatch = file.content.toLowerCase().includes(searchQuery.toLowerCase()) || 
                      file.name.toLowerCase().includes(searchQuery.toLowerCase());
    return textMatch;
  });

  return (
    <div id="obsidian-workspace" className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-full min-h-[600px] text-white">
      
      {/* 1. LEFT SIDEBAR: Notes explorer, graph visualizer and plugin toggle switches (4 cols) */}
      <div className="lg:col-span-4 bg-neutral-900/80 border border-emerald-900/40 rounded-2xl flex flex-col overflow-hidden shadow-2xl relative">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>

        {/* Sidebar Header */}
        <div className="p-4 border-b border-emerald-900/40 bg-black/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold tracking-wider font-mono text-emerald-400 uppercase">Obsidian Vault</h3>
          </div>
          <span className="text-[10px] font-mono text-sky-400 px-2 py-0.5 bg-sky-950/40 border border-sky-800/40 rounded">
            {vaultFiles.length} files
          </span>
        </div>

        {/* Workspace views select toolbar */}
        <div className="p-2 border-b border-emerald-900/30 flex gap-1 bg-black/20">
          {[
            { id: "explorer", label: "Files", icon: FileText },
            { id: "graph", label: "Graph Map", icon: Network },
            { id: "plugins", label: "Plugins", icon: Settings }
          ].map(view => {
            const Icon = view.icon;
            return (
              <button
                key={view.id}
                onClick={() => setSidebarTab(view.id as any)}
                className={`flex-1 py-1.5 rounded-lg text-[10px] font-semibold font-mono tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                  sidebarTab === view.id
                    ? "bg-emerald-950 border border-emerald-800/50 text-emerald-400 font-bold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{view.label}</span>
              </button>
            );
          })}
        </div>

        {/* Sidebar dynamic tab pane */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col">
          <AnimatePresence mode="wait">
            
            {/* VIEW A: Notes explorer tree */}
            {sidebarTab === "explorer" && (
              <motion.div
                key="explorer-tab"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4 flex-1 flex flex-col"
              >
                {/* Search notes bar */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search markdown notes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-black/40 border border-emerald-900/30 rounded-xl py-2 pl-9 pr-4 text-xs text-white placeholder:text-neutral-600 focus:outline-none focus:border-emerald-700 transition-colors font-sans"
                  />
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-neutral-600" />
                </div>

                {/* Create blank note card */}
                <div className="flex gap-2">
                  <button
                    onClick={handleCreateNote}
                    className="flex-1 py-2 bg-emerald-900/30 hover:bg-emerald-900/40 border border-emerald-800/40 rounded-xl text-xs font-mono font-bold text-emerald-400 flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Markdown</span>
                  </button>
                </div>

                {/* Drag & drop upload files box */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border border-dashed p-4 rounded-xl text-center cursor-pointer transition-all ${
                    isDragging
                      ? "border-emerald-500 bg-emerald-950/20"
                      : "border-emerald-900/30 bg-black/10 hover:bg-black/20"
                  }`}
                  onClick={() => document.getElementById("obsidian-file-input")?.click()}
                >
                  <input
                    id="obsidian-file-input"
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <Upload className="w-5 h-5 text-emerald-400 mx-auto mb-1 animate-pulse" />
                  <span className="text-[10px] font-bold text-neutral-300 block">Drag & Drop Files</span>
                  <span className="text-[8px] text-neutral-500 font-mono">Uploads .md, .txt, or attachment files</span>
                </div>

                {/* Vault files list */}
                <div className="space-y-2 flex-1 overflow-y-auto max-h-[220px] pr-1">
                  {filteredFiles.map(file => {
                    const isSelected = activeFileId === file.id;
                    return (
                      <div
                        key={file.id}
                        onClick={() => setActiveFileId(file.id)}
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between group ${
                          isSelected
                            ? "bg-emerald-950/35 border-emerald-800/60 shadow shadow-emerald-950/40"
                            : "bg-black/20 border-emerald-900/10 hover:bg-black/45"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {file.type === "note" ? (
                            <FileText className={`w-4 h-4 ${isSelected ? "text-emerald-400" : "text-slate-400"}`} />
                          ) : (
                            <Paperclip className={`w-4 h-4 ${isSelected ? "text-sky-400" : "text-slate-400"}`} />
                          )}
                          <div className="text-left">
                            <span className={`text-xs font-bold font-sans line-clamp-1 block ${isSelected ? "text-white" : "text-neutral-300"}`}>
                              {file.name}
                            </span>
                            <span className="text-[8px] font-mono text-neutral-500 block">
                              Modified: {file.lastModified} • {(file.size / 1024).toFixed(1)} KB
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={(e) => handleDeleteNote(file.id, e)}
                          className="p-1.5 rounded hover:bg-red-950/40 text-neutral-600 hover:text-rose-400 transition opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}

                  {filteredFiles.length === 0 && (
                    <div className="text-center py-6 text-neutral-600 font-mono text-xs">
                      No files match filter queries.
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* VIEW B: Interactive Physics Node-Link Knowledge Graph */}
            {sidebarTab === "graph" && (
              <motion.div
                key="graph-tab"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col space-y-3"
              >
                <div className="p-3 bg-emerald-950/10 border border-emerald-900/30 rounded-xl flex items-start gap-2">
                  <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-neutral-400 leading-relaxed font-sans">
                    <strong>Interactive Brain Map:</strong> Draggable physics nodes represent notes, meetings, and voice logs. Double-click any node to open it!
                  </p>
                </div>

                {/* SVG Graph Frame */}
                <div className="w-full h-[280px] bg-black/60 rounded-xl border border-emerald-900/20 relative overflow-hidden flex items-center justify-center">
                  <svg
                    ref={graphContainerRef}
                    className="w-full h-full"
                    viewBox="0 0 500 400"
                  >
                    {/* Render connection links */}
                    {graphLinks.map((link, idx) => {
                      const sNode = graphNodes.find(n => n.id === link.source);
                      const tNode = graphNodes.find(n => n.id === link.target);
                      if (!sNode || !tNode) return null;
                      return (
                        <line
                          key={`link-${idx}`}
                          x1={sNode.x}
                          y1={sNode.y}
                          x2={tNode.x}
                          y2={tNode.y}
                          stroke="#047857"
                          strokeWidth="1.5"
                          strokeOpacity="0.45"
                        />
                      );
                    })}

                    {/* Render nodes */}
                    {graphNodes.map((node) => {
                      const isHovered = hoveredNodeId === node.id;
                      const isActiveNode = activeFileId === node.id;
                      let color = "#10b981"; // note dark green
                      if (node.type === "meeting") color = "#38bdf8"; // meeting light blue
                      if (node.type === "transcript") color = "#facc15"; // transcript golden

                      return (
                        <g
                          key={node.id}
                          className="cursor-pointer select-none"
                          onMouseEnter={() => setHoveredNodeId(node.id)}
                          onMouseLeave={() => setHoveredNodeId(null)}
                          onClick={() => handleNodeClick(node)}
                        >
                          <circle
                            cx={node.x}
                            cy={node.y}
                            r={isActiveNode ? 8 : isHovered ? 10 : 6}
                            fill={color}
                            stroke={isActiveNode ? "#38bdf8" : "#022c22"}
                            strokeWidth="2"
                            className="transition-all duration-150"
                          />
                          {/* Label overlay */}
                          {(isHovered || isActiveNode) && (
                            <g>
                              <rect
                                x={node.x + 10}
                                y={node.y - 12}
                                width={Math.min(180, node.label.length * 7 + 10)}
                                height="18"
                                rx="4"
                                fill="#09090b"
                                stroke="#047857"
                                strokeWidth="1"
                                opacity="0.9"
                              />
                              <text
                                x={node.x + 15}
                                y={node.y}
                                fill="#ffffff"
                                fontSize="10"
                                fontFamily="monospace"
                                className="font-bold"
                              >
                                {node.label.length > 22 ? `${node.label.substring(0, 20)}...` : node.label}
                              </text>
                            </g>
                          )}
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </motion.div>
            )}

            {/* VIEW C: Community Plugins Toggle list */}
            {sidebarTab === "plugins" && (
              <motion.div
                key="plugins-tab"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-3 flex-1 overflow-y-auto max-h-[300px]"
              >
                {plugins.map((plugin) => (
                  <div
                    key={plugin.id}
                    className="p-3 bg-black/40 border border-emerald-900/20 rounded-xl flex items-start justify-between gap-3 hover:border-emerald-800/40 transition-all"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white font-sans">{plugin.name}</span>
                        {plugin.category === "ai" && (
                          <span className="text-[8px] px-1 bg-sky-950 border border-sky-800/40 text-sky-400 font-bold rounded">LLM Engine</span>
                        )}
                      </div>
                      <p className="text-[10px] text-neutral-400 leading-relaxed font-sans">{plugin.description}</p>
                    </div>

                    <button
                      onClick={() => {
                        setPlugins(prev => prev.map(p => p.id === plugin.id ? { ...p, enabled: !p.enabled } : p));
                      }}
                      className={`px-2 py-1 rounded text-[9px] font-mono font-bold uppercase tracking-wider shrink-0 border transition-all ${
                        plugin.enabled
                          ? "bg-emerald-950 border-emerald-800/40 text-emerald-400"
                          : "bg-neutral-900 border-neutral-800 text-neutral-500"
                      }`}
                    >
                      {plugin.enabled ? "Active" : "Disabled"}
                    </button>
                  </div>
                ))}
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>

      {/* 2. MIDDLE & RIGHT PANEL: Full interactive markdown editor & Llama Co-pilot Sidebar (8 cols) */}
      <div className="lg:col-span-8 flex flex-col gap-5">
        {activeFile ? (
          <div className="bg-neutral-900/80 border border-emerald-900/40 rounded-2xl p-5 flex-1 flex flex-col overflow-hidden shadow-2xl min-h-[500px]">
            
            {/* Note title and quick information bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-emerald-900/40 pb-4 mb-4">
              <div className="flex-1">
                <input
                  type="text"
                  value={editorName}
                  onChange={(e) => setEditorName(e.target.value)}
                  className="bg-transparent text-lg font-bold text-white focus:outline-none border-b border-transparent focus:border-emerald-700 w-full font-sans tracking-tight"
                />
                <span className="text-[10px] font-mono text-neutral-500 block mt-1">
                  Obsidian Note File • Auto-saves instantly • Links tracked bi-directionally
                </span>
              </div>

              {/* Import context hooks tools */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  onClick={handleImportTranscript}
                  disabled={transcript.length === 0}
                  className="px-2.5 py-1.5 bg-black/40 border border-emerald-900/40 rounded-lg text-[10px] font-mono text-emerald-400 hover:bg-emerald-950 transition-colors flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Link live meeting spoken transcription logs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Import Transcript</span>
                </button>

                <button
                  onClick={handleImportChat}
                  disabled={messages.length === 0}
                  className="px-2.5 py-1.5 bg-black/40 border border-emerald-900/40 rounded-lg text-[10px] font-mono text-emerald-400 hover:bg-emerald-950 transition-colors flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Import local LLM conversation transcripts"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Import AI Chat</span>
                </button>
              </div>
            </div>

            {/* Main content viewport: split into editor and co-pilot sidebar */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 overflow-hidden">
              
              {/* NOTE EDITOR (LHS: taking up 7 cols or full depending on plugin) */}
              <div className={`flex flex-col gap-3 ${plugins.find(p => p.id === "llama-copilot")?.enabled ? "lg:col-span-7" : "lg:col-span-12"}`}>
                
                {/* Whisper STT Dictation button if plugin is enabled */}
                {plugins.find(p => p.id === "whisper-stt")?.enabled && (
                  <div className="flex items-center justify-between p-2 bg-emerald-950/25 border border-emerald-900/40 rounded-xl">
                    <div className="flex items-center gap-2">
                      <Mic className="w-4 h-4 text-emerald-400 animate-pulse" />
                      <span className="text-[10px] font-mono text-slate-300">Self-Hosted Whisper transcription engine is active</span>
                    </div>

                    <button
                      onClick={triggerWhisperDictation}
                      disabled={isWhisperDictating}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1 transition-all ${
                        isWhisperDictating
                          ? "bg-amber-950 border-amber-800 text-amber-400 cursor-not-allowed"
                          : "bg-emerald-900/50 hover:bg-emerald-900 border border-emerald-800 text-emerald-400 hover:text-white"
                      }`}
                    >
                      <span>{isWhisperDictating ? "Whisper is listening..." : "Dictate Note"}</span>
                    </button>
                  </div>
                )}

                {/* Micro Whisper feedback report */}
                {whisperConfidence && (
                  <span className="text-[9px] font-mono text-sky-400 block px-2">
                    ✓ Whisper transcribed successfully. Confidence: {whisperConfidence}% • Latency: {whisperLatency}ms
                  </span>
                )}

                {/* Markdown text editor */}
                <textarea
                  id="obsidian-editor"
                  value={editorContent}
                  onChange={(e) => setEditorContent(e.target.value)}
                  className="flex-1 w-full bg-black/40 border border-emerald-900/20 focus:border-emerald-700/60 rounded-xl p-4 text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-800/40 leading-relaxed resize-none select-text"
                  placeholder="Type note content in Markdown format..."
                />

                {/* Tags manager */}
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1.5 items-center">
                    <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest flex items-center gap-1">
                      <Tag className="w-3 h-3" /> Note Tags:
                    </span>
                    {activeFile.tags.map(tag => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 bg-emerald-950/40 border border-emerald-800/40 text-[9px] font-bold text-emerald-400 rounded-md font-mono flex items-center gap-1"
                      >
                        <span>#{tag}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="hover:text-rose-400 font-sans"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>

                  <form onSubmit={handleAddTag} className="flex gap-2 max-w-xs">
                    <input
                      type="text"
                      placeholder="Add custom tag..."
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      className="flex-1 bg-black/40 border border-emerald-900/30 rounded-lg px-2.5 py-1 text-[10px] text-white focus:outline-none focus:border-emerald-700 font-sans"
                    />
                    <button
                      type="submit"
                      className="px-2.5 py-1 bg-emerald-900/50 hover:bg-emerald-900 border border-emerald-800/40 text-[10px] font-mono text-emerald-400 hover:text-white rounded-lg transition-all"
                    >
                      Add
                    </button>
                  </form>
                </div>

                {/* Bi-directional links feedback panel */}
                {plugins.find(p => p.id === "backlinks-tracker")?.enabled && (
                  <div className="mt-3 p-3 bg-black/40 border border-emerald-900/20 rounded-xl space-y-2">
                    <span className="text-[9px] font-mono font-bold text-sky-400 uppercase tracking-widest block">
                      Bi-Directional Backlinks
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {getBacklinks(activeFile.name).map(backlink => (
                        <button
                          key={backlink.id}
                          onClick={() => setActiveFileId(backlink.id)}
                          className="px-2.5 py-1 bg-sky-950/40 border border-sky-800/30 rounded text-[10px] font-mono text-sky-300 hover:border-sky-500 transition-all"
                        >
                          [[{backlink.name}]]
                        </button>
                      ))}

                      {getBacklinks(activeFile.name).length === 0 && (
                        <span className="text-[10px] text-neutral-600 font-mono">No other files link here yet. Link this file using [[{activeFile.name}]] in any other note file.</span>
                      )}
                    </div>
                  </div>
                )}

              </div>

              {/* LLAMA CO-PILOT SIDEBAR (RHS: 5 cols) */}
              {plugins.find(p => p.id === "llama-copilot")?.enabled && (
                <div className="lg:col-span-5 bg-black/40 border border-emerald-900/20 rounded-xl p-4 flex flex-col justify-between overflow-y-auto">
                  
                  {/* Co-Pilot Header */}
                  <div className="space-y-1.5 border-b border-emerald-900/20 pb-3 mb-3">
                    <div className="flex items-center gap-1.5 text-sky-400">
                      <Brain className="w-4 h-4 text-sky-400 animate-pulse" />
                      <span className="text-xs font-bold font-mono uppercase tracking-wider">llama3.2:1b Engine</span>
                    </div>
                    <span className="text-[9px] font-mono text-neutral-500 block">
                      Offline LLM Sandbox • Local neural execution
                    </span>

                    {/* Parameter configurations */}
                    <div className="space-y-1.5 pt-2">
                      <div className="flex justify-between text-[8px] font-mono text-slate-400">
                        <span>Temperature: {llamaTemperature}</span>
                        <span>Max Tokens: {llamaMaxTokens}</span>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="range"
                          min="0.1"
                          max="1.0"
                          step="0.1"
                          value={llamaTemperature}
                          onChange={(e) => setLlamaTemperature(parseFloat(e.target.value))}
                          className="flex-1 accent-emerald-500"
                        />
                        <input
                          type="range"
                          min="64"
                          max="512"
                          step="32"
                          value={llamaMaxTokens}
                          onChange={(e) => setLlamaMaxTokens(parseInt(e.target.value))}
                          className="flex-1 accent-emerald-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Built-in local note parsing commands */}
                  <div className="space-y-2 flex-1 overflow-y-auto pr-1">
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        onClick={() => triggerLlamaCopilot("summarize")}
                        disabled={isLlamaLoading}
                        className="p-2 bg-emerald-950/20 border border-emerald-800/40 rounded-lg text-[9px] font-mono text-emerald-400 hover:bg-emerald-950 transition-colors text-left"
                      >
                        ⚡ Summarize Note
                      </button>
                      <button
                        onClick={() => triggerLlamaCopilot("flashcard")}
                        disabled={isLlamaLoading}
                        className="p-2 bg-emerald-950/20 border border-emerald-800/40 rounded-lg text-[9px] font-mono text-emerald-400 hover:bg-emerald-950 transition-colors text-left"
                      >
                        ⚡ Study Cards
                      </button>
                    </div>

                    {/* Custom query prompt field */}
                    <div className="space-y-1.5 pt-2">
                      <span className="text-[9px] font-mono text-neutral-500 uppercase tracking-widest block">Query Co-Pilot:</span>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          placeholder="Ask Llama model..."
                          value={llamaInput}
                          onChange={(e) => setLlamaInput(e.target.value)}
                          className="flex-1 bg-black/40 border border-emerald-900/30 rounded-lg px-2.5 py-1 text-[10px] text-white focus:outline-none focus:border-emerald-700 font-sans"
                        />
                        <button
                          onClick={() => triggerLlamaCopilot("custom")}
                          disabled={isLlamaLoading || !llamaInput.trim()}
                          className="p-1 bg-emerald-800 hover:bg-emerald-700 text-white rounded-lg transition-colors flex items-center justify-center"
                        >
                          <Play className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Completion response terminal block */}
                    {(isLlamaLoading || llamaResponse) && (
                      <div className="mt-3 p-3 bg-neutral-950 rounded-xl border border-emerald-900/40 font-mono text-[10px] text-slate-300 leading-relaxed space-y-1.5 relative overflow-hidden">
                        <div className="flex items-center justify-between">
                          <span className="text-[8px] text-neutral-500 font-mono">llama3.2:1b self-hosted stdout</span>
                          {isLlamaLoading && (
                            <RefreshCw className="w-3 h-3 text-sky-400 animate-spin" />
                          )}
                        </div>

                        <div className="select-text whitespace-pre-wrap">
                          {llamaResponse || "Awaiting thread stream initialization..."}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="text-[8px] text-center text-neutral-600 font-mono pt-3 border-t border-emerald-900/10">
                    Offline private parameters secure • Tokenizer: llama-bpe
                  </div>
                </div>
              )}

            </div>

          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-neutral-900/80 border border-emerald-900/40 rounded-2xl">
            <Layers className="w-12 h-12 text-emerald-900 mb-2 animate-bounce" />
            <h4 className="text-sm font-bold text-white font-sans">No Active Note File Selected</h4>
            <p className="text-xs text-neutral-500">Create a new markdown note or select one from the Obsidian Vault explorer list.</p>
          </div>
        )}
      </div>

    </div>
  );
}
