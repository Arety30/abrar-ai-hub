import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  MessageSquare, 
  Clock, 
  Mic, 
  Send, 
  Volume2, 
  VolumeX, 
  Sparkles, 
  User, 
  ArrowDownCircle,
  Megaphone
} from "lucide-react";
import { ChatMessage, TranscriptEntry, Document, Participant } from "../types";

interface MeetingChatProps {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  transcript: TranscriptEntry[];
  setTranscript: React.Dispatch<React.SetStateAction<TranscriptEntry[]>>;
  documents: Document[];
  participants: Participant[];
  setParticipants: React.Dispatch<React.SetStateAction<Participant[]>>;
}

export default function MeetingChat({
  messages,
  setMessages,
  transcript,
  setTranscript,
  documents,
  participants,
  setParticipants,
}: MeetingChatProps) {
  const [activeTab, setActiveTab] = useState<"chat" | "transcript">("chat");
  const [textInput, setTextInput] = useState("");
  const [isAiResponding, setIsAiResponding] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  
  // Voice simulation state
  const [voicePrompt, setVoicePrompt] = useState("");
  const [isDictating, setIsDictating] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAiResponding]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  // Find active AI speaker from participants
  const activeAiSpeaker = participants.find(p => p.isAI && p.activeSpeaker) || participants.find(p => p.isAI) || null;

  // 1. Text Chat messaging & AI interaction loop
  useEffect(() => {
    // Initial load
    fetch("/api/chat")
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setMessages(data);
        }
      })
      .catch(err => console.warn("Error fetching initial chat:", err));

    // Poll for real-time messages
    const interval = setInterval(() => {
      fetch("/api/chat")
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setMessages(data);
          }
        })
        .catch(err => console.warn("Error polling chat:", err));
    }, 3000);

    return () => clearInterval(interval);
  }, [setMessages]);

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!textInput.trim()) return;

    // Retrieve active logged in user from local storage
    let localUser = { username: "Sarah Miller", id: "local-user" };
    try {
      const stored = localStorage.getItem("studysync_user");
      if (stored) {
        localUser = JSON.parse(stored);
      }
    } catch (_) {}

    const textPayload = textInput.trim();
    setTextInput("");

    try {
      // Post User Message to Server Chat database
      const chatPostRes = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderName: localUser.username,
          text: textPayload,
          isAI: false,
          color: "text-indigo-400"
        })
      });
      const userMsg = await chatPostRes.json();

      // Immediately refresh local chat messages list
      setMessages(prev => [...prev, userMsg]);
      setIsAiResponding(true);

      const speakerName = activeAiSpeaker ? activeAiSpeaker.name : "Lumina";

      // Set AI participant active speaker visually
      setParticipants(prev => prev.map(p => {
        if (p.isAI && p.name === speakerName) {
          return { ...p, activeSpeaker: true };
        }
        return { ...p, activeSpeaker: false };
      }));

      // Call server side Local Llama 3.2 for an answer
      const response = await fetch("/api/local/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMsg],
          documents,
          activeSpeaker: speakerName,
          transcript
        }),
      });
      const data = await response.json();

      const aiText = data.text || "I'm listening closely. Let's continue studying.";

      // Post AI Message to Server Chat database
      const aiPostRes = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderName: speakerName,
          text: aiText,
          isAI: true,
          color: speakerName === "Lumina" ? "text-indigo-400" : "text-emerald-400"
        })
      });
      const aiMsg = await aiPostRes.json();

      setMessages(prev => [...prev, aiMsg]);

      // Add to transcript too! Live meeting spoken logs capture AI feedback
      const aiSpokenEntry: TranscriptEntry = {
        id: "tr-" + Math.random().toString(36).substring(2),
        speaker: speakerName,
        text: aiMsg.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isAI: true
      };
      setTranscript(prev => [...prev, aiSpokenEntry]);

      // Trigger Web Speech TTS synthesis if enabled
      if (ttsEnabled && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(aiMsg.text);
        const voices = window.speechSynthesis.getVoices();
        const docVoice = voices.find(v => v.lang.startsWith("en"));
        if (docVoice) utterance.voice = docVoice;
        utterance.rate = 1.05;
        window.speechSynthesis.speak(utterance);
      }

    } catch (err: any) {
      console.error(err);
      const errMessage: ChatMessage = {
        id: "msg-err",
        senderId: "system",
        senderName: "System",
        text: "Error calling study companion: " + err.message,
        timestamp: new Date().toLocaleTimeString(),
        isAI: true,
        color: "text-rose-500"
      };
      setMessages(prev => [...prev, errMessage]);
    } finally {
      setIsAiResponding(false);
      setTimeout(() => {
        setParticipants(prev => prev.map(p => ({ ...p, activeSpeaker: false })));
      }, 4000);
    }
  }

  // 2. Microphone dictation simulation
  async function handleSimulateSpeech(e: React.FormEvent) {
    e.preventDefault();
    if (!voicePrompt.trim()) return;

    setIsDictating(true);

    try {
      // Call server side self-hosted OpenAI Whisper to turn simple idea into verbal contribution
      const response = await fetch("/api/local/speech-to-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: voicePrompt.trim() }),
      });
      const data = await response.json();

      const spokenWords = data.text || voicePrompt.trim();

      const entry: TranscriptEntry = {
        id: "tr-" + Math.random().toString(36).substring(2),
        speaker: "Local Student",
        text: spokenWords,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isAI: false
      };

      setTranscript(prev => [...prev, entry]);
      setVoicePrompt("");

      // Trigger AI to respond naturally in chat to what was just spoken!
      // This makes the study companion feel fully interactive to speech!
      triggerAiToSpokenInput(spokenWords);

    } catch (err) {
      console.error(err);
    } finally {
      setIsDictating(false);
    }
  }

  // Trigger AI automatically to voice contributions
  async function triggerAiToSpokenInput(spokenInput: string) {
    setIsAiResponding(true);
    const speakerName = activeAiSpeaker ? activeAiSpeaker.name : "Lumina";

    setParticipants(prev => prev.map(p => {
      if (p.isAI && p.name === speakerName) {
        return { ...p, activeSpeaker: true };
      }
      return { ...p, activeSpeaker: false };
    }));

    try {
      const chatContext = [
        ...messages,
        { id: "sp-in", senderId: "user", senderName: "User (Spoken)", text: `[Spoken comment in meeting]: "${spokenInput}"`, isAI: false, timestamp: "", color: "text-white" }
      ];

      const response = await fetch("/api/local/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: chatContext,
          documents,
          activeSpeaker: speakerName,
          transcript: [...transcript, { id: "sp-in", speaker: "Local Student", text: spokenInput, isAI: false, timestamp: "" }]
        }),
      });
      const data = await response.json();

      const aiMsg: ChatMessage = {
        id: "msg-" + Math.random().toString(36).substring(2),
        senderId: "ai-" + speakerName.toLowerCase(),
        senderName: speakerName,
        text: data.text || "Intriguing point. Let's delve deeper.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isAI: true,
        color: speakerName === "Lumina" ? "text-indigo-400" : "text-emerald-400"
      };

      setMessages(prev => [...prev, aiMsg]);

      const aiSpokenEntry: TranscriptEntry = {
        id: "tr-" + Math.random().toString(36).substring(2),
        speaker: speakerName,
        text: aiMsg.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isAI: true
      };
      setTranscript(prev => [...prev, aiSpokenEntry]);

      if (ttsEnabled && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(aiMsg.text);
        window.speechSynthesis.speak(utterance);
      }

    } catch (e) {
      console.warn(e);
    } finally {
      setIsAiResponding(false);
      setTimeout(() => {
        setParticipants(prev => prev.map(p => ({ ...p, activeSpeaker: false })));
      }, 4000);
    }
  }

  // Quick speech shortcut prompts
  const speechPresets = [
    "Summarize our active source text",
    "Explain attention heads simply",
    "How does RAG solve LLM hallucinations?"
  ];

  return (
    <div id="chat-transcript-container" className="flex flex-col h-full bg-neutral-900/85 backdrop-blur-xl border border-emerald-900/40 rounded-2xl overflow-hidden shadow-2xl">
      
      {/* Tab Selectors */}
      <div className="flex bg-black/40 border-b border-emerald-900/30 p-1">
        <button
          id="btn-tab-chat"
          onClick={() => setActiveTab("chat")}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-mono font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 border ${
            activeTab === "chat" 
              ? "bg-emerald-950/60 text-emerald-400 border-emerald-800/40 shadow-inner" 
              : "text-slate-400 hover:text-slate-200 border-transparent"
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Meeting Chat</span>
        </button>

        <button
          id="btn-tab-transcript"
          onClick={() => setActiveTab("transcript")}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-mono font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 border ${
            activeTab === "transcript" 
              ? "bg-emerald-950/60 text-emerald-400 border-emerald-800/40 shadow-inner" 
              : "text-slate-400 hover:text-slate-200 border-transparent"
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Live Transcript</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col min-h-[250px]">
        <AnimatePresence mode="wait">
          
          {/* TAB 1: Chat Window */}
          {activeTab === "chat" && (
            <motion.div
              key="chat-tab"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="flex-1 flex flex-col space-y-4 justify-between"
            >
              {/* Message scroll container */}
              <div className="flex-1 space-y-3.5 overflow-y-auto max-h-[160px] pr-1">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.senderId === "local-user" ? "items-end" : "items-start"}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[10px] font-mono text-slate-400">{msg.senderName}</span>
                      <span className="text-[9px] text-slate-500 font-mono">{msg.timestamp}</span>
                    </div>

                    <div className={`px-3 py-2.5 rounded-2xl max-w-[85%] text-xs leading-relaxed font-sans border shadow-sm ${
                      msg.senderId === "local-user"
                        ? "bg-emerald-950/45 border-emerald-800/40 text-white rounded-tr-none backdrop-blur-sm"
                        : "bg-white/5 border-white/10 text-slate-200 rounded-tl-none backdrop-blur-sm"
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                ))}

                {isAiResponding && (
                  <div className="flex flex-col items-start space-y-1">
                    <span className="text-[10px] font-mono text-emerald-400">AI Study partner is typing...</span>
                    <div className="px-3.5 py-3 bg-white/5 border border-white/10 rounded-2xl rounded-tl-none flex items-center gap-1">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" />
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.4s]" />
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>

              {/* Input Form & Speech configuration */}
              <div className="space-y-2.5 pt-2 border-t border-emerald-900/20">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-400">Addressing: <strong className="text-emerald-400">{activeAiSpeaker?.name || "Lumina"}</strong></span>
                  
                  {/* TTS Voice switcher toggle */}
                  <button
                    id="btn-toggle-tts"
                    onClick={() => setTtsEnabled(!ttsEnabled)}
                    className="flex items-center gap-1 text-[10px] font-mono text-slate-400 hover:text-slate-200 transition"
                  >
                    {ttsEnabled ? (
                      <>
                        <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Piper TTS Active</span>
                      </>
                    ) : (
                      <>
                        <VolumeX className="w-3.5 h-3.5 text-slate-500" />
                        <span>Voice Muted</span>
                      </>
                    )}
                  </button>
                </div>

                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <input
                    id="input-chat-text"
                    type="text"
                    placeholder={`Message ${activeAiSpeaker?.name || "Lumina"}...`}
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    className="flex-1 text-xs bg-black/40 border border-emerald-900/30 rounded-xl px-3 py-2.5 text-slate-200 focus:outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-800/40 font-sans"
                  />
                  <button
                    id="btn-submit-chat"
                    type="submit"
                    disabled={!textInput.trim() || isAiResponding}
                    className="p-2.5 bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl transition shadow active:scale-95 disabled:opacity-40 border border-emerald-800/40"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </motion.div>
          )}

          {/* TAB 2: Transcript Log */}
          {activeTab === "transcript" && (
            <motion.div
              key="transcript-tab"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="flex-1 flex flex-col space-y-4 justify-between"
            >
              {/* Spoken transcript timeline logs */}
              <div className="flex-1 space-y-4 overflow-y-auto max-h-[160px] pr-1">
                {transcript.map((entry) => (
                  <div key={entry.id} className="relative pl-4 border-l-2 border-emerald-900/30 space-y-1">
                    <div className="absolute -left-1.5 top-0.5 w-3.5 h-3.5 bg-neutral-950 rounded-full border border-emerald-900/30 flex items-center justify-center">
                      <div className={`w-1.5 h-1.5 rounded-full ${entry.isAI ? "bg-sky-400" : "bg-emerald-400"}`} />
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold text-slate-300">{entry.speaker}</span>
                      <span className="text-[9px] text-slate-500 font-mono">{entry.timestamp}</span>
                    </div>

                    <p className="text-xs text-slate-400 leading-relaxed font-sans">{entry.text}</p>
                  </div>
                ))}

                {transcript.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <Mic className="w-8 h-8 text-neutral-800 mb-2.5 animate-pulse" />
                    <span className="text-xs font-bold text-slate-300 font-sans block">No Spoken Logs Captured</span>
                    <p className="text-[10px] text-slate-500 max-w-xs mt-1 font-sans">
                      Speak or type ideas using the voice dictation interface below to record the chronological conversation.
                    </p>
                  </div>
                )}

                <div ref={transcriptEndRef} />
              </div>

              {/* Interactive Speech Recognition simulator deck */}
              <div className="p-3 bg-black/40 rounded-xl border border-emerald-900/20 space-y-3.5 shadow-lg relative">
                
                {/* Whisper and Piper engine details status bar */}
                <div className="flex flex-wrap items-center justify-between border-b border-emerald-900/20 pb-2 gap-2">
                  <div className="flex items-center gap-1.5 text-emerald-400">
                    <Mic className="w-4 h-4 animate-pulse" />
                    <span className="text-xs font-bold font-mono">Whisper STT dictation active</span>
                  </div>
                  <div className="flex gap-2 text-[8px] font-mono text-slate-400">
                    <span className="px-1.5 py-0.5 bg-emerald-950/60 border border-emerald-800/40 text-emerald-400 rounded">Whisper: ONLINE</span>
                    <span className="px-1.5 py-0.5 bg-sky-950/60 border border-sky-850 text-sky-400 rounded">Piper TTS: ONLINE</span>
                  </div>
                </div>

                {/* Speech outline quick selector buttons */}
                <div className="flex flex-wrap gap-1.5">
                  {speechPresets.map((preset, i) => (
                    <button
                      key={i}
                      id={`speech-preset-btn-${i}`}
                      onClick={() => setVoicePrompt(preset)}
                      className="text-[10px] font-mono bg-white/5 border border-white/10 text-slate-300 px-2.5 py-1 rounded-full hover:bg-emerald-950 hover:text-emerald-400 hover:border-emerald-800/40 transition duration-150"
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleSimulateSpeech} className="flex gap-2">
                  <input
                    id="input-voice-prompt"
                    type="text"
                    placeholder="Enter what you want to verbally contribute..."
                    value={voicePrompt}
                    onChange={(e) => setVoicePrompt(e.target.value)}
                    className="flex-1 text-xs bg-black/40 border border-emerald-900/30 rounded-lg px-2.5 py-2 text-slate-200 focus:outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-800/40 font-sans"
                  />
                  <button
                    id="btn-simulate-voice"
                    type="submit"
                    disabled={isDictating || !voicePrompt.trim()}
                    className="px-3.5 py-2 bg-emerald-850 hover:bg-emerald-800 text-white rounded-lg text-xs font-mono font-bold transition flex items-center gap-1.5 shadow disabled:opacity-40 border border-emerald-800/40"
                  >
                    <span>{isDictating ? "Whisper parsing..." : "Speak"}</span>
                  </button>
                </form>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
