import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { 
  Video, 
  Mic, 
  MicOff, 
  Users, 
  Calendar, 
  Clock, 
  MessageSquare,
  Play, 
  RefreshCw, 
  Plus, 
  Volume2, 
  UserCheck2,
  Tv,
  ListFilter,
  UserCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Meeting {
  id: string;
  title: string;
  startTime: string;
  participants: string[];
  transcript: { speaker: string; text: string; time: string }[];
}

const PRESET_MEETINGS: Meeting[] = [
  {
    id: 'meet-1',
    title: 'Abrar AI Hub Deployment Sync',
    startTime: '10:00 AM',
    participants: ['Abrar (Lead)', 'Lumina (AI Swarm Manager)', 'Discord Bot Client'],
    transcript: [
      { speaker: 'Abrar (Lead)', text: "Let's review the current local deployment status of the Ollama LLM.", time: '10:01 AM' },
      { speaker: 'Lumina (AI Swarm Manager)', text: 'The local model llama3.2:3b is fully loaded. COSINE vector similarity indexes for NotebookLM documentation are ready.', time: '10:01 AM' },
      { speaker: 'Discord Bot Client', text: 'I am successfully polling the FastAPI websocket and answering user commands in the Discord test guild.', time: '10:02 AM' },
      { speaker: 'Abrar (Lead)', text: 'Excellent. Make sure STT transcribes in under 120ms.', time: '10:03 AM' }
    ]
  },
  {
    id: 'meet-2',
    title: 'Outbound Campaign Strategy',
    startTime: '02:30 PM',
    participants: ['Abrar (Lead)', 'Elevenlabs Outbound Caller', 'Database Swarm Client'],
    transcript: [
      { speaker: 'Abrar (Lead)', text: 'We need to deploy the outbound telephony campaign next week.', time: '02:31 PM' },
      { speaker: 'Elevenlabs Outbound Caller', text: 'Batch outgoing triggers are ready. The voice parameters are tuned to a professional receptionist tone.', time: '02:32 PM' },
    ]
  }
];

export default function MeetingsView() {
  const [meetings, setMeetings] = useState<Meeting[]>(PRESET_MEETINGS);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>('meet-1');
  const [activeSpeaker, setActiveSpeaker] = useState<string | null>(null);

  // Live recording status
  const [isRecording, setIsRecording] = useState(false);
  const [transcriptionLogs, setTranscriptionLogs] = useState<string[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const selectedMeeting = meetings.find(m => m.id === selectedMeetingId) || meetings[0];

  // Auto speaker simulation (simulates visual speaker active states randomly)
  useEffect(() => {
    if (!selectedMeeting) return;
    const interval = setInterval(() => {
      const parts = [...selectedMeeting.participants, null];
      const randomSpeaker = parts[Math.floor(Math.random() * parts.length)];
      setActiveSpeaker(randomSpeaker);
    }, 4000);
    return () => clearInterval(interval);
  }, [selectedMeetingId]);

  // Transcribe live voice input to meeting
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
        setTranscriptionLogs(prev => [...prev, 'STT ENGINE: Parsing incoming wave buffers...']);

        try {
          const sttData = await api.transcribe(audioBlob);
          if (sttData.text && sttData.text.trim()) {
            const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            // Append transcribed line as User speaking to active meeting
            setMeetings(prev => prev.map(m => {
              if (m.id === selectedMeetingId) {
                return {
                  ...m,
                  transcript: [...m.transcript, { speaker: 'User (Mic)', text: sttData.text, time }]
                };
              }
              return m;
            }));
            
            setTranscriptionLogs(prev => [...prev, `STT SUCCESS: Added transcript.`]);
          } else {
            setTranscriptionLogs(prev => [...prev, 'STT WARNING: Empty verbal stream.']);
          }
        } catch (err: any) {
          setTranscriptionLogs(prev => [...prev, `STT ERROR: ${err.message}`]);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setTranscriptionLogs(['Recording voice buffer...']);
    } catch (e: any) {
      setTranscriptionLogs([`Microphone access denied: ${e.message}`]);
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

  const handleAddMeeting = () => {
    const newMeet: Meeting = {
      id: 'meet-' + Math.random().toString(36).substring(2),
      title: 'New Swarm Sync Session',
      startTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      participants: ['Abrar (Lead)', 'Lumina (AI Swarm Manager)'],
      transcript: [
        { speaker: 'System // Core', text: 'Meeting started. Audio transcribers active.', time: 'Start' }
      ]
    };
    setMeetings(prev => [...prev, newMeet]);
    setSelectedMeetingId(newMeet.id);
  };

  return (
    <div className="flex flex-col h-full bg-background scanlines">
      {/* Main split dashboard view */}
      <div className="flex-grow flex overflow-hidden">
        
        {/* Left column: Meetings list Explorer (220px) */}
        <div className="w-[220px] border-r border-border bg-card/20 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-border bg-card/60 flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase">Audio Session Logs</span>
            <button
              onClick={handleAddMeeting}
              className="p-1 rounded bg-secondary/15 text-secondary border border-secondary/20 hover:bg-secondary hover:text-white transition-colors"
              title="Start a new meeting session"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-grow overflow-y-auto p-1.5 space-y-1">
            {meetings.map(meet => (
              <div
                key={meet.id}
                onClick={() => setSelectedMeetingId(meet.id)}
                className={`p-2.5 rounded border font-mono text-xs transition-all cursor-pointer flex flex-col gap-1.5 ${
                  selectedMeetingId === meet.id
                    ? 'border-secondary bg-secondary/10'
                    : 'border-transparent hover:bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                <span className="font-bold text-foreground truncate">{meet.title}</span>
                <div className="flex justify-between items-center text-[9px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />
                    {meet.startTime}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-2.5 h-2.5" />
                    {meet.participants.length}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right column: Audio stage and Live Transcript panels (Flex Grow) */}
        <div className="flex-1 flex flex-col overflow-hidden bg-background">
          {selectedMeeting ? (
            <div className="flex-grow flex flex-col md:flex-row overflow-hidden">
              
              {/* Stage: Visual participants circles (40% width) */}
              <div className="md:w-[40%] border-r border-border bg-card/10 flex flex-col p-4 space-y-4 overflow-y-auto">
                <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase">Virtual Meeting Stage</span>
                
                {/* Visual grid representing audio sources */}
                <div className="flex-grow flex flex-col items-center justify-center space-y-6 py-6 border border-border bg-black/30 rounded-lg">
                  {selectedMeeting.participants.map((person, idx) => {
                    const isSpeaking = person === activeSpeaker;
                    return (
                      <div key={idx} className="flex flex-col items-center space-y-1">
                        <div className="relative">
                          {/* Pulse ring indicating voice detection */}
                          {isSpeaking && (
                            <span className="absolute -inset-2 rounded-full border border-amber-500 animate-ping opacity-60" />
                          )}
                          <div className={`w-14 h-14 rounded-full flex items-center justify-center border font-mono font-bold text-sm transition-all duration-300 ${
                            isSpeaking
                              ? 'border-amber-500 bg-amber-500/20 text-amber-500 shadow-lg shadow-amber-500/10'
                              : 'border-secondary bg-secondary/10 text-secondary'
                          }`}>
                            {person.substring(0, 2).toUpperCase()}
                          </div>
                        </div>
                        <span className={`text-[10px] font-mono font-medium ${isSpeaking ? 'text-amber-500 font-bold' : 'text-muted-foreground'}`}>
                          {person}
                        </span>
                        {isSpeaking && (
                          <div className="flex items-center gap-0.5 mt-0.5">
                            <span className="w-[1.5px] h-[5px] bg-amber-500 animate-bounce" style={{ animationDelay: '0.1s' }} />
                            <span className="w-[1.5px] h-[8px] bg-amber-500 animate-bounce" style={{ animationDelay: '0.2s' }} />
                            <span className="w-[1.5px] h-[4px] bg-amber-500 animate-bounce" style={{ animationDelay: '0.3s' }} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Live Mic Speech Dictation interface */}
                <div className="bg-muted/30 border border-border p-3 rounded-lg space-y-3 font-mono text-xs">
                  <div className="flex justify-between items-center border-b border-border pb-1">
                    <span className="font-bold text-secondary uppercase">Local Dictation STT</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  </div>
                  
                  <button
                    onClick={toggleRecording}
                    className={`w-full py-2.5 rounded font-bold text-xs uppercase transition-all flex items-center justify-center gap-2 ${
                      isRecording
                        ? 'bg-destructive/20 border border-destructive text-destructive animate-pulse'
                        : 'bg-secondary text-white hover:bg-secondary-foreground cursor-pointer shadow-lg shadow-secondary/15'
                    }`}
                  >
                    {isRecording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                    {isRecording ? 'MUTE DICTATION' : 'DICTATE ON STAGE'}
                  </button>

                  {transcriptionLogs.length > 0 && (
                    <div className="bg-black/40 p-2 rounded text-[10px] text-emerald-400 font-mono space-y-0.5 max-h-[80px] overflow-y-auto">
                      {transcriptionLogs.map((log, idx) => (
                        <div key={idx} className="flex gap-1">
                          <span className="text-secondary/55">&gt;</span>
                          <span>{log}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Transcripts: Transcript lines list (60% width) */}
              <div className="flex-1 flex flex-col overflow-hidden p-4 space-y-3">
                <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase">Real-Time Transcription Log</span>
                
                <div className="flex-grow border border-border bg-card/45 rounded-lg p-3 overflow-y-auto space-y-3 font-mono text-xs">
                  {selectedMeeting.transcript.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-muted-foreground">Empty logs.</div>
                  ) : (
                    selectedMeeting.transcript.map((line, i) => (
                      <div key={i} className="space-y-0.5 border-b border-border/20 pb-2">
                        <div className="flex justify-between items-center text-[9px] text-muted-foreground">
                          <span className="font-bold text-secondary uppercase">{line.speaker}</span>
                          <span>{line.time}</span>
                        </div>
                        <p className="text-foreground text-[11px] leading-relaxed select-text">{line.text}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          ) : (
            <div className="flex-grow flex flex-col items-center justify-center text-center p-8 text-muted-foreground font-mono space-y-2">
              <Tv className="w-8 h-8 text-secondary animate-pulse" />
              <h3 className="text-xs font-bold text-foreground uppercase">Meeting Center Empty</h3>
              <p className="text-[11px]">Select a session log from the list on the left to read transcription records.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
