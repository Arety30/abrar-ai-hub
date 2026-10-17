import React, { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api, ChatResponse } from '../lib/api';
import { 
  Send, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Terminal, 
  Play, 
  Loader2, 
  Server,
  Code2,
  Search as SearchIcon,
  Globe,
  Database,
  Cpu,
  CornerDownLeft,
  Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  model?: string;
  action?: {
    type: string;
    details: string;
  } | null;
}

interface ChatViewProps {
  activeModel: string;
  setTokSpeed: (speed: number) => void;
}

export default function ChatView({ activeModel, setTokSpeed }: ChatViewProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'system',
      content: 'NEXUS COGNITIVE CORE: ONLINE\nLOCAL PROVIDER (OLLAMA/GEMINI): CONNECTED\nAll processes sandbox-contained.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    }
  ]);
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [activeAction, setActiveAction] = useState<{ type: string; details: string; status: 'running' | 'success' | 'failed'; logs: string[] } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, activeAction]);

  // Handle API call for sending text message
  const chatMutation = useMutation({
    mutationFn: (msg: string) => api.sendChatMessage(msg),
    onSuccess: (data: ChatResponse, variables: string) => {
      // Simulate token generation speed
      const textLen = data.text.length;
      const speed = Math.round(15 + Math.random() * 15);
      setTokSpeed(speed);

      // Handle actions emitted by the agentic core
      if (data.action) {
        handleAgentAction(data.action);
      }

      const newMsg: Message = {
        id: Math.random().toString(),
        role: 'assistant',
        content: data.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        model: data.model,
        action: data.action,
      };

      setMessages(prev => [...prev, newMsg]);

      // If TTS is enabled, read aloud the response
      if (ttsEnabled) {
        speakResponse(data.text);
      }
    },
    onError: (err) => {
      setMessages(prev => [
        ...prev,
        {
          id: Math.random().toString(),
          role: 'system',
          content: `CRITICAL ERROR: Failed to route response. ${err.message}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        }
      ]);
    }
  });

  const handleSend = () => {
    if (!input.trim() || chatMutation.isPending) return;

    const userMsg: Message = {
      id: Math.random().toString(),
      role: 'user',
      content: input,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    chatMutation.mutate(userMsg.content);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Agent action execution visualization simulation
  const handleAgentAction = (action: { type: string; details: string }) => {
    setActiveAction({
      type: action.type,
      details: action.details,
      status: 'running',
      logs: [`Initializing sandbox task: ${action.type}`, `Target resource: ${action.details}`]
    });

    // Simulate logs printing out
    setTimeout(() => {
      setActiveAction(prev => prev ? {
        ...prev,
        logs: [...prev.logs, 'Acquiring security locks...', 'Reading block sectors...']
      } : null);
    }, 800);

    setTimeout(() => {
      setActiveAction(prev => prev ? {
        ...prev,
        status: 'success',
        logs: [...prev.logs, 'Execution completed.', 'Returned response stream to cognitive gateway.']
      } : null);
    }, 1800);

    setTimeout(() => {
      setActiveAction(null);
    }, 4500);
  };

  // Speak response using backend TTS
  const speakResponse = async (text: string) => {
    // Strip headers, markdown symbols for cleaner TTS
    const cleanText = text.replace(/[*#`_\-]/g, '').replace(/ACTION:.*$/gm, '').trim();
    if (!cleanText) return;

    try {
      setIsSpeaking(true);
      const audioBlob = await api.speak(cleanText);
      const audioUrl = URL.createObjectURL(audioBlob);
      
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      
      const audio = new Audio(audioUrl);
      audioPlayerRef.current = audio;
      audio.onended = () => {
        setIsSpeaking(false);
      };
      audio.onerror = () => {
        setIsSpeaking(false);
      };
      audio.play();
    } catch (e) {
      console.error(e);
      setIsSpeaking(false);
    }
  };

  // Voice recording & transcription
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        setIsRecording(false);
        
        // Transcribe audio
        setMessages(prev => [
          ...prev,
          {
            id: 'transcribing',
            role: 'system',
            content: 'STT PIPELINE: Transcribing incoming audio stream...',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          }
        ]);

        try {
          const sttData = await api.transcribe(audioBlob);
          setMessages(prev => prev.filter(m => m.id !== 'transcribing'));
          
          if (sttData.text && sttData.text.trim()) {
            const userMsg: Message = {
              id: Math.random().toString(),
              role: 'user',
              content: sttData.text,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            };
            setMessages(prev => [...prev, userMsg]);
            chatMutation.mutate(userMsg.content);
          } else {
            setMessages(prev => [
              ...prev,
              {
                id: Math.random().toString(),
                role: 'system',
                content: 'STT WARNING: No verbal tokens detected in stream.',
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              }
            ]);
          }
        } catch (err: any) {
          setMessages(prev => prev.filter(m => m.id !== 'transcribing'));
          setMessages(prev => [
            ...prev,
            {
              id: Math.random().toString(),
              role: 'system',
              content: `STT PIPELINE FAILURE: ${err.message}`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            }
          ]);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (e: any) {
      setMessages(prev => [
        ...prev,
        {
          id: Math.random().toString(),
          role: 'system',
          content: `MICROPHONE RESOURCE ACCESS DENIED: ${e.message}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
      ]);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'SHELL': return <Terminal className="w-4 h-4 text-amber-500" />;
      case 'WRITE_FILE':
      case 'READ_FILE': return <Code2 className="w-4 h-4 text-emerald-500" />;
      case 'SEARCH': return <SearchIcon className="w-4 h-4 text-cyan-500" />;
      case 'SPEAK': return <Volume2 className="w-4 h-4 text-pink-500" />;
      default: return <Cpu className="w-4 h-4 text-amber-500" />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-background scanlines">
      {/* Top Banner indicating conversation parameters */}
      <div className="flex justify-between items-center px-4 py-2 border-b border-border bg-card/40 text-[10px] text-muted-foreground font-mono">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
            NEXUS ENGINE: READY
          </span>
          <span>SESSION: CONV-001</span>
          <span>PROVIDER: {activeModel}</span>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setTtsEnabled(!ttsEnabled)}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded border transition-colors ${
              ttsEnabled 
                ? 'bg-primary/20 text-primary border-primary/50' 
                : 'hover:bg-muted border-transparent'
            }`}
          >
            {ttsEnabled ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
            SPEECH SYNTHESIS
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col max-w-[85%] ${
              msg.role === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'
            }`}
          >
            {/* Header: role, timestamp, model */}
            <div className="flex items-center gap-2 mb-1 text-[10px] font-mono text-muted-foreground">
              <span className={`uppercase font-bold ${
                msg.role === 'user' ? 'text-primary' : msg.role === 'system' ? 'text-destructive' : 'text-secondary'
              }`}>
                {msg.role === 'user' ? 'User // Client' : msg.role === 'system' ? 'System // Core' : 'Assistant // Local'}
              </span>
              <span>·</span>
              <span>{msg.timestamp}</span>
              {msg.model && (
                <>
                  <span>·</span>
                  <span className="text-[9px] bg-secondary/15 text-secondary px-1 py-0.2 rounded font-mono border border-secondary/25">
                    {msg.model}
                  </span>
                </>
              )}
            </div>

            {/* Message Body */}
            <div className={`px-4 py-3 rounded-lg text-sm leading-relaxed border font-mono ${
              msg.role === 'user'
                ? 'bg-primary/10 border-primary/30 text-foreground'
                : msg.role === 'system'
                ? 'bg-destructive/10 border-destructive/30 text-destructive-foreground whitespace-pre-line border-l-4'
                : 'bg-card/90 border-border text-foreground whitespace-pre-wrap'
            }`}>
              {msg.content}
            </div>

            {/* In-message Actions indicator if any */}
            {msg.action && (
              <div className="mt-1.5 flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono bg-accent/35 text-accent-foreground border border-border rounded-md">
                {getActionIcon(msg.action.type)}
                <span className="font-bold text-amber-500 uppercase">{msg.action.type}:</span>
                <span className="truncate max-w-[200px]">{msg.action.details}</span>
              </div>
            )}
          </div>
        ))}

        {/* Live Active Execution Sandbox Overlay (Dynamic Agent Activity) */}
        <AnimatePresence>
          {activeAction && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="border border-secondary bg-black/85 p-3 rounded-lg max-w-[85%] font-mono space-y-2 border-l-4 border-l-amber-500"
            >
              <div className="flex items-center justify-between text-xs border-b border-secondary/30 pb-1">
                <div className="flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                  <span className="font-bold uppercase tracking-wider text-amber-500">
                    Agent Action Executing // {activeAction.type}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    activeAction.status === 'running' 
                      ? 'bg-amber-500 animate-ping' 
                      : 'bg-emerald-500'
                  }`} />
                  <span className="text-[10px] text-muted-foreground uppercase">{activeAction.status}</span>
                </div>
              </div>
              <div className="text-[11px] space-y-0.5 text-emerald-400/90 leading-tight">
                {activeAction.logs.map((log, idx) => (
                  <div key={idx} className="flex gap-1.5">
                    <span className="text-secondary/60">&gt;</span>
                    <span>{log}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pending response generation indicator */}
        {chatMutation.isPending && (
          <div className="flex flex-col items-start max-w-[85%]">
            <div className="flex items-center gap-2 mb-1 text-[10px] font-mono text-muted-foreground">
              <span className="uppercase font-bold text-secondary">Assistant // Local</span>
              <span>·</span>
              <span>Routing token sequence...</span>
            </div>
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg border bg-card/90 border-secondary/30 text-muted-foreground text-sm font-mono border-l-4 border-l-secondary animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin text-secondary" />
              <span>Ollama inference active...</span>
            </div>
          </div>
        )}

        {/* Speacking indicator wave overlay */}
        {isSpeaking && (
          <div className="flex items-center gap-2 text-[10px] font-mono text-amber-500 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
            <span>NEXUS VOCAL ENVELOPE: SPEAKING</span>
            <div className="flex items-center gap-0.5 ml-1">
              <span className="w-[2px] h-[8px] bg-amber-500 animate-bounce" style={{ animationDelay: '0.1s' }} />
              <span className="w-[2px] h-[12px] bg-amber-500 animate-bounce" style={{ animationDelay: '0.2s' }} />
              <span className="w-[2px] h-[6px] bg-amber-500 animate-bounce" style={{ animationDelay: '0.3s' }} />
              <span className="w-[2px] h-[10px] bg-amber-500 animate-bounce" style={{ animationDelay: '0.4s' }} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input controls form */}
      <div className="p-4 border-t border-border bg-card/60 relative">
        {/* Severity border stripes at bottom for technical control look */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-secondary/20 to-transparent" />
        
        <div className="flex items-stretch gap-2">
          {/* Microphone dictate button */}
          <button
            type="button"
            onClick={toggleRecording}
            className={`flex items-center justify-center w-11 rounded-lg border transition-all duration-200 ${
              isRecording
                ? 'bg-destructive/20 border-destructive text-destructive animate-pulse'
                : 'bg-muted hover:bg-accent border-border hover:border-secondary text-foreground'
            }`}
            title={isRecording ? 'Stop speech dictation' : 'Start speech dictation'}
          >
            {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          {/* Text Input area */}
          <div className="flex-1 relative flex items-center">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Send instruction stream to Nexus core (Press Enter to transmit)..."
              disabled={chatMutation.isPending}
              className="w-full bg-input-background text-foreground border border-border focus:border-secondary focus:ring-1 focus:ring-secondary/40 rounded-lg px-4 py-2.5 pr-10 text-sm font-mono placeholder:text-muted-foreground/60 resize-none h-11 leading-normal overflow-hidden focus:outline-none"
            />
            <span className="absolute right-3 text-[10px] font-mono text-muted-foreground/45 pointer-events-none flex items-center gap-0.5">
              <span>Enter</span>
              <CornerDownLeft className="w-2.5 h-2.5" />
            </span>
          </div>

          {/* Send Button */}
          <button
            onClick={handleSend}
            disabled={!input.trim() || chatMutation.isPending}
            className={`flex items-center justify-center px-4 rounded-lg border text-sm font-mono transition-all font-bold ${
              input.trim() && !chatMutation.isPending
                ? 'bg-primary hover:bg-primary-foreground hover:text-primary border-primary text-primary-foreground cursor-pointer shadow-lg shadow-primary/25'
                : 'bg-muted border-border text-muted-foreground cursor-not-allowed'
            }`}
          >
            {chatMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <span className="flex items-center gap-1.5">
                TRANSMIT
                <Send className="w-3.5 h-3.5" />
              </span>
            )}
          </button>
        </div>

        {/* Small prompt status info */}
        <div className="flex justify-between items-center mt-2 text-[10px] text-muted-foreground font-mono px-1">
          <span>Ollama: llama3.2:3b [Active]</span>
          <span>Fallback: Gemini-1.5-Flash</span>
        </div>
      </div>
    </div>
  );
}
