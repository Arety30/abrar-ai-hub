import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Monitor, 
  Smile, 
  Radio, 
  User, 
  Sparkles, 
  AlertCircle,
  HelpCircle,
  Tv
} from "lucide-react";
import { Participant } from "../types";

interface MeetingStageProps {
  participants: Participant[];
  setParticipants: React.Dispatch<React.SetStateAction<Participant[]>>;
  localStream: MediaStream | null;
  setLocalStream: (stream: MediaStream | null) => void;
  isScreenSharing: boolean;
  setIsScreenSharing: (val: boolean) => void;
  aiConsentGiven: boolean;
  setAiConsentGiven: (val: boolean) => void;
}

interface FloatingEmoji {
  id: string;
  emoji: string;
  x: number;
}

export default function MeetingStage({
  participants,
  setParticipants,
  localStream,
  setLocalStream,
  isScreenSharing,
  setIsScreenSharing,
  aiConsentGiven,
  setAiConsentGiven,
}: MeetingStageProps) {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraPermissionError, setCameraPermissionError] = useState<string | null>(null);
  const [floatingEmojis, setFloatingEmojis] = useState<FloatingEmoji[]>([]);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const audioIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  // Sample slides for the presentation slide fallback deck
  const slideDeck = [
    { title: "Deep Dive: Neural Networks & Transformers", content: "Understanding attention layers, positional encodings, and self-supervised model learning frameworks." },
    { title: "Retrieval Augmented Generation (RAG)", content: "How external data chunks are retrieved from vector stores and injected into the language model's context window." },
    { title: "Context Window Limits & Memory", content: "Evaluating prompt tokens, system instructions, and multi-turn chat persistence in AI search integrations." }
  ];

  // 1. Manage local user stream (webcam and mic)
  const localUser = participants.find(p => p.isLocal);
  const cameraOn = localUser?.cameraOn || false;
  const micOn = localUser?.micOn || false;

  useEffect(() => {
    let activeStream: MediaStream | null = null;

    async function setupMedia() {
      if (cameraOn || micOn) {
        try {
          setCameraPermissionError(null);
          const stream = await navigator.mediaDevices.getUserMedia({
            video: cameraOn,
            audio: micOn
          });
          activeStream = stream;
          setLocalStream(stream);

          // Bind video element
          if (localVideoRef.current && cameraOn) {
            localVideoRef.current.srcObject = stream;
          }

          // Setup simple mock/real audio visualization
          if (micOn) {
            setupAudioVisualization(stream);
          } else {
            setAudioLevel(0);
          }
        } catch (err: any) {
          console.warn("Could not capture real camera/mic:", err);
          setCameraPermissionError("Could not access media devices (blocked or unavailable). Using digital avatar instead.");
          setLocalStream(null);
        }
      } else {
        // Stop current stream
        if (localStream) {
          localStream.getTracks().forEach(track => track.stop());
          setLocalStream(null);
        }
        setAudioLevel(0);
      }
    }

    setupMedia();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
      if (audioIntervalRef.current) {
        clearInterval(audioIntervalRef.current);
      }
    };
  }, [cameraOn, micOn]);

  // Bind local stream if changed
  useEffect(() => {
    if (localVideoRef.current && localStream && cameraOn) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, cameraOn]);

  // Setup actual web audio analyser if possible, otherwise clear or mock it
  function setupAudioVisualization(stream: MediaStream) {
    if (audioIntervalRef.current) clearInterval(audioIntervalRef.current);

    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 32;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      audioIntervalRef.current = setInterval(() => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        setAudioLevel(Math.min(avg / 128, 1)); // scale to 0-1
      }, 100);
    } catch (e) {
      // AudioContext fallback: mock voice levels when mic is active
      audioIntervalRef.current = setInterval(() => {
        setAudioLevel(Math.random() * 0.4 + 0.1);
      }, 200);
    }
  }

  // 2. Manage Screen Share
  async function toggleScreenShare() {
    if (isScreenSharing) {
      setIsScreenSharing(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        setIsScreenSharing(true);
        if (screenVideoRef.current) {
          screenVideoRef.current.srcObject = stream;
        }
        stream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false);
        };
      } catch (err) {
        console.warn("Screen share cancelled or not allowed, using slide deck projection");
        setIsScreenSharing(true); // Treat as presentation slide deck fallback
      }
    }
  }

  // 3. Floating Reaction System
  function sendReaction(emoji: string) {
    const id = Math.random().toString(36).substring(2);
    const x = Math.floor(Math.random() * 60) + 20; // range 20% to 80% width
    const newEmoji = { id, emoji, x };
    setFloatingEmojis(prev => [...prev, newEmoji]);

    // Cleanup after animation completes
    setTimeout(() => {
      setFloatingEmojis(prev => prev.filter(e => e.id !== id));
    }, 2500);
  }

  // Helper toggles
  function toggleCamera() {
    setParticipants(prev => prev.map(p => {
      if (p.isLocal) {
        return { ...p, cameraOn: !p.cameraOn };
      }
      return p;
    }));
  }

  // Filter participants based on consent
  const visibleParticipants = participants.filter(p => !p.isAI || aiConsentGiven);

  function toggleMic() {
    setParticipants(prev => prev.map(p => {
      if (p.isLocal) {
        return { ...p, micOn: !p.micOn };
      }
      return p;
    }));
  }

  return (
    <div id="meeting-stage-container" className="flex flex-col h-full bg-neutral-950 backdrop-blur-md rounded-2xl border border-emerald-900/40 overflow-hidden shadow-2xl relative">
      
      {/* 1. Floating Reactions Render Area */}
      <div className="absolute inset-x-0 bottom-24 top-0 pointer-events-none z-30 overflow-hidden">
        <AnimatePresence>
          {floatingEmojis.map((item) => (
            <motion.div
              key={item.id}
              initial={{ y: "100%", x: `${item.x}%`, opacity: 0, scale: 0.5 }}
              animate={{ 
                y: "-10%", 
                opacity: [0, 1, 1, 0], 
                scale: [0.5, 1.2, 1.2, 0.8],
                x: `${item.x + Math.sin(parseFloat(item.id) || 0) * 10}%`
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2.2, ease: "easeOut" }}
              className="absolute text-4xl select-none"
            >
              {item.emoji}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Header Info */}
      <div className="flex items-center justify-between p-4 bg-black/40 border-b border-emerald-900/30 backdrop-blur-md z-10">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
          <span className="font-mono text-xs text-slate-300 font-medium uppercase tracking-wider">Active Study Session</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-950/40 rounded-full border border-emerald-900/30">
          <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          <span className="text-xs text-emerald-400 font-mono">NotebookLM Lounge</span>
        </div>
      </div>

      {/* 2. Main Stage Content */}
      <div className="flex-1 p-4 relative flex flex-col gap-4 overflow-y-auto">
        
        {/* Consent Banner Display if not granted */}
        {!aiConsentGiven && (
          <div className="w-full bg-emerald-950/40 border border-emerald-800/50 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg z-20 backdrop-blur-sm">
            <div className="flex items-start gap-3">
              <span className="text-xl">🔒</span>
              <div className="space-y-1 text-left">
                <h4 className="text-xs font-bold font-mono text-emerald-400 uppercase tracking-widest">AI Participant Shield Enabled</h4>
                <p className="text-xs text-slate-300 leading-relaxed font-sans max-w-xl">
                  AI companion bots (Lumina & Dr. Keith) are currently restricted from entering your active study session. Grant full user consent to bring AI speakers online, enable local Whisper speech interpretation, and use Piper voice synthesis.
                </p>
              </div>
            </div>
            <button
              onClick={() => setAiConsentGiven(true)}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 active:scale-95 text-white text-xs font-mono font-bold tracking-wider rounded-lg shadow-md border border-emerald-500/30 shrink-0 transition"
            >
              ✓ Grant AI Participant Consent
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1">
          {/* Screen Share / Slide Deck Area (LHS if screensharing) */}
          {isScreenSharing ? (
            <div className="lg:col-span-8 flex flex-col bg-slate-900/60 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden shadow-inner relative group min-h-[300px]">
              <div className="absolute top-3 left-3 bg-emerald-800/95 text-white text-[11px] font-mono px-2.5 py-1 rounded-full flex items-center gap-1.5 z-10 shadow-lg border border-emerald-600/30">
                <Tv className="w-3.5 h-3.5 text-sky-400" />
                <span>PRESENTATION STAGE</span>
              </div>

              {/* Video or Slide Presentation fallback */}
              {screenVideoRef.current?.srcObject ? (
                <video 
                  ref={screenVideoRef} 
                  autoPlay 
                  playsInline 
                  className="w-full h-full object-contain bg-black"
                />
              ) : (
                // Interactive Slides Fallback
                <div className="flex-1 flex flex-col justify-center items-center p-8 text-center bg-gradient-to-br from-neutral-950 via-emerald-950/20 to-neutral-950 text-slate-100 relative">
                  <div className="max-w-md space-y-4">
                    <motion.div 
                      key={currentSlideIndex}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-3"
                    >
                      <span className="text-[10px] uppercase tracking-widest text-emerald-400 font-mono font-bold">
                        Slide {currentSlideIndex + 1} of {slideDeck.length}
                      </span>
                      <h3 className="text-xl font-bold tracking-tight text-white font-display">
                        {slideDeck[currentSlideIndex].title}
                      </h3>
                      <p className="text-sm text-slate-350 leading-relaxed font-sans">
                        {slideDeck[currentSlideIndex].content}
                      </p>
                    </motion.div>
                  </div>

                  {/* Slider pagination */}
                  <div className="absolute bottom-6 flex gap-1.5">
                    {slideDeck.map((_, i) => (
                      <button
                        key={i}
                        id={`slide-btn-${i}`}
                        onClick={() => setCurrentSlideIndex(i)}
                        className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${i === currentSlideIndex ? 'bg-emerald-400 w-6' : 'bg-slate-750 hover:bg-slate-600'}`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {/* Participant Videos Grid (RHS/Full grid depending on screenshare) */}
          <div className={`grid gap-4 ${isScreenSharing ? "lg:col-span-4 grid-cols-1" : "lg:col-span-12 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"} flex-1`}>
            
            {visibleParticipants.map((p) => {
              const isLocalUser = p.isLocal;
              const isVoiceActive = p.activeSpeaker || (isLocalUser && micOn && audioLevel > 0.15);

              return (
                <motion.div
                  key={p.id}
                  id={`participant-${p.id}`}
                  layout
                  className={`relative bg-black border overflow-hidden aspect-video shadow-md flex flex-col justify-between transition-all duration-300 ${
                    isVoiceActive 
                      ? "border-emerald-500 ring-2 ring-emerald-500/20 shadow-emerald-950/40" 
                      : "border-emerald-950"
                  }`}
                >
                  {/* Visual Speaking Waver Indicator */}
                  {isVoiceActive && (
                    <div className="absolute top-3 right-3 flex items-end gap-0.5 h-4 px-2 py-0.5 bg-emerald-600/90 rounded-full text-white text-[10px] font-mono shadow-md z-10 border border-emerald-500/30">
                      <span className="mr-1">SPEAKING</span>
                      <div className="w-0.5 h-2.5 bg-white rounded-full animate-[bounce_0.8s_infinite_100ms]" />
                      <div className="w-0.5 h-3.5 bg-white rounded-full animate-[bounce_0.8s_infinite_300ms]" />
                      <div className="w-0.5 h-1.5 bg-white rounded-full animate-[bounce_0.8s_infinite_0ms]" />
                    </div>
                  )}

                  {/* Local user video component or fallback avatar */}
                  {isLocalUser && cameraOn ? (
                    <div className="absolute inset-0 bg-black z-0">
                      <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover scale-x-[-1]"
                      />
                    </div>
                  ) : null}

                  {/* Avatar Fallback Layer */}
                  {(!isLocalUser || !cameraOn) && (
                    <div className={`absolute inset-0 flex flex-col justify-center items-center bg-gradient-to-b ${p.color} z-0 opacity-80`}>
                      <div className="w-16 h-16 rounded-full bg-slate-950/40 flex items-center justify-center text-white text-2xl font-bold font-mono border border-white/25 shadow-lg relative">
                        <span>{p.avatarIcon}</span>
                        {isVoiceActive && (
                          <span className="absolute -inset-2 rounded-full border border-emerald-400/40 animate-ping" />
                        )}
                      </div>
                      <span className="text-xs font-mono text-slate-200 mt-3 bg-slate-950/60 px-2.5 py-1 rounded-full border border-white/10">{p.role}</span>
                    </div>
                  )}

                  {/* Participant details (Bottom ribbon) */}
                  <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black via-black/85 to-transparent flex items-center justify-between z-10">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white font-sans drop-shadow">
                        {p.name} {isLocalUser && "(You)"}
                      </span>
                      {p.isAI && (
                        <span className="text-[9px] bg-sky-600 text-white font-bold px-1.5 py-0.5 rounded uppercase tracking-wider font-mono border border-sky-450">
                          AI Mate
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 bg-black/40 p-1 rounded-full backdrop-blur-sm border border-emerald-900/30">
                      {p.cameraOn ? (
                        <Video className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <VideoOff className="w-3.5 h-3.5 text-rose-400" />
                      )}
                      {p.micOn ? (
                        <Mic className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <MicOff className="w-3.5 h-3.5 text-rose-400" />
                      )}
                    </div>
                  </div>

                  {/* Local user volume feedback meter overlay */}
                  {isLocalUser && micOn && audioLevel > 0.05 && (
                    <div className="absolute bottom-12 left-3 bg-black/60 px-2 py-1 rounded border border-emerald-900/30 flex items-center gap-1.5 z-10">
                      <span className="text-[9px] text-slate-400 font-mono font-bold">Input Level:</span>
                      <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-400 transition-all duration-75"
                          style={{ width: `${audioLevel * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. Controls / Reactions Toolbar Bar */}
      <div className="p-4 bg-black/40 border-t border-emerald-900/30 flex flex-col sm:flex-row items-center justify-between gap-4 z-10 shadow-lg">
        
        {/* Device controllers */}
        <div className="flex items-center gap-2">
          <button
            id="btn-toggle-camera"
            onClick={toggleCamera}
            className={`p-3 rounded-full transition-all duration-200 border flex items-center justify-center ${
              cameraOn 
                ? "bg-emerald-950/40 border-emerald-800/40 text-emerald-400 hover:bg-emerald-900/20" 
                : "bg-rose-950/40 border-rose-900/60 text-rose-400 hover:bg-rose-900/40"
            }`}
            title={cameraOn ? "Turn Camera Off" : "Turn Camera On"}
          >
            {cameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </button>

          <button
            id="btn-toggle-mic"
            onClick={toggleMic}
            className={`p-3 rounded-full transition-all duration-200 border flex items-center justify-center ${
              micOn 
                ? "bg-emerald-950/40 border-emerald-800/40 text-emerald-400 hover:bg-emerald-900/20" 
                : "bg-rose-950/40 border-rose-900/60 text-rose-400 hover:bg-rose-900/40"
            }`}
            title={micOn ? "Mute Microphone" : "Unmute Microphone"}
          >
            {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </button>

          <button
            id="btn-screenshare"
            onClick={toggleScreenShare}
            className={`px-4 py-2.5 rounded-full transition-all duration-200 border flex items-center gap-2 font-medium text-xs font-mono ${
              isScreenSharing 
                ? "bg-emerald-850 border-emerald-600 text-white hover:bg-emerald-800" 
                : "bg-white/10 border-white/10 text-slate-100 hover:bg-white/15"
            }`}
          >
            <Monitor className="w-4 h-4" />
            <span>{isScreenSharing ? "Stop Presentation" : "Present Screen"}</span>
          </button>
        </div>

        {/* Quick Reactions Deck */}
        <div className="flex items-center gap-1.5 bg-black/40 p-1.5 rounded-full border border-emerald-900/20">
          <span className="text-[10px] text-slate-400 font-mono px-2 hidden md:inline">Reactions:</span>
          {["❤️", "👍", "🎉", "😮", "🔥", "💡"].map((emoji) => (
            <button
              key={emoji}
              id={`reaction-btn-${emoji}`}
              onClick={() => sendReaction(emoji)}
              className="w-8 h-8 rounded-full hover:bg-emerald-950 hover:text-emerald-400 flex items-center justify-center transition-all text-lg active:scale-90"
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Informational Notification */}
        <div className="text-right hidden sm:block">
          <div className="text-[10px] text-emerald-400 font-mono flex items-center gap-1.5 justify-end">
            <Sparkles className="w-3 h-3 text-sky-400 animate-pulse" />
            <span>AI Active Transcript Running</span>
          </div>
          <span className="text-[9px] text-slate-500 font-mono">Click emojis to float reactions</span>
        </div>
      </div>

      {cameraPermissionError && (
        <div className="absolute bottom-24 left-4 right-4 bg-slate-900/95 border border-slate-800 p-3 rounded-lg shadow-2xl flex items-start gap-2.5 z-40 backdrop-blur">
          <AlertCircle className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="text-[11px] font-bold text-indigo-300 font-mono block">DEVICE COMPATIBILITY MODE</span>
            <p className="text-xs text-slate-300 leading-relaxed font-sans">{cameraPermissionError}</p>
          </div>
        </div>
      )}
    </div>
  );
}
