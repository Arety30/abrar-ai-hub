import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';
import { 
  Cpu, 
  Terminal, 
  Play, 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle,
  PlayCircle,
  Clock,
  Layers,
  Pause,
  AlertCircle,
  Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Agent {
  id: number;
  name: string;
  role: string;
  status: 'active' | 'idle' | 'warning';
  activeTask?: string;
  cycles: number;
}

interface SwarmTask {
  id: number;
  prompt: string;
  assignedAgent: string;
  status: 'queued' | 'running' | 'success' | 'failed';
  result?: string;
}

const PRESET_AGENTS: Agent[] = [
  { id: 1, name: 'Lumina', role: 'Orchestrator Node // Swarm Lead', status: 'active', activeTask: 'Routing core API requests to Ollama', cycles: 12431 },
  { id: 2, name: 'Aegis', role: 'Security Auditor // Sandbox Sentinel', status: 'idle', cycles: 8740 },
  { id: 3, name: 'Chronos', role: 'Scheduler // Telephony Dispatcher', status: 'active', activeTask: 'Polling ElevenLabs outbound queue', cycles: 9811 },
  { id: 4, name: 'Scribe', role: 'Obsidian Indexer // Auto-wiki Parser', status: 'active', activeTask: 'Parsing links inside self-attention.md', cycles: 15403 },
  { id: 5, name: 'Atlas', role: 'Knowledge Graph Mapper // D3 Layout', status: 'idle', cycles: 4322 },
  { id: 6, name: 'Whisper-01', role: 'Audio Stream Transcriber // Wave chunker', status: 'idle', cycles: 28410 },
  { id: 7, name: 'Piper-02', role: 'TTS Synthesizer // Low latency TTS', status: 'idle', cycles: 19540 },
  { id: 8, name: 'Discord-Bot', role: 'Discord Client Gateway // Command routing', status: 'active', activeTask: 'Polling websocket for user commands', cycles: 34105 },
];

const PRESET_TASKS: SwarmTask[] = [
  { id: 1, prompt: 'Index introduction to transformers document for RAG search', assignedAgent: 'Scribe', status: 'success', result: 'Ingested and chunked into 4 sectors. Embedded vector weights calculated.' },
  { id: 2, prompt: 'Verify local model security sandboxing credentials', assignedAgent: 'Aegis', status: 'success', result: 'Sandbox verified. Subprocess shell limits active.' },
  { id: 3, prompt: 'Perform system note links compilation to refresh graph', assignedAgent: 'Atlas', status: 'running' }
];

const LOG_TEMPLATES = [
  "Agent #04 (Scribe) - Wikipedia chunking cosine calculation completed.",
  "Agent #01 (Lumina) - Distributing RAG query weights across active sectors.",
  "Agent #03 (Chronos) - Outbound receptionist call trigger resolved successfully.",
  "Agent #08 (Discord-Bot) - WebSocket connection heartbeats sent to Discord API gateway.",
  "Agent #06 (Whisper-01) - Speech transcription latency recorded: 104ms.",
  "Agent #02 (Aegis) - Scanning note directory write permissions... safe.",
  "Agent #07 (Piper-02) - Audio TTS buffer flushing to audio client player.",
];

export default function AgentsView() {
  const [agents, setAgents] = useState<Agent[]>(PRESET_AGENTS);
  const [tasks, setTasks] = useState<SwarmTask[]>(PRESET_TASKS);
  const [swarmStatus, setSwarmStatus] = useState<'online' | 'paused'>('online');

  // Input form state
  const [taskPrompt, setTaskPrompt] = useState('');
  const [taskAgent, setTaskAgent] = useState('Lumina');

  // Scrolling terminal logs state
  const [terminalLogs, setTerminalLogs] = useState<string[]>([
    "SWARM CORE GATEWAY INITIALIZED // 43 WORKERS DISPATCH READY",
    "All security isolation namespaces (cgroups) mounted successfully.",
    "Websocket listener starting on port 8100..."
  ]);
  
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Dynamic log updates simulation
  useEffect(() => {
    if (swarmStatus !== 'online') return;

    const interval = setInterval(() => {
      const template = LOG_TEMPLATES[Math.floor(Math.random() * LOG_TEMPLATES.length)];
      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setTerminalLogs(prev => [...prev.slice(-30), `[${timestamp}] ${template}`]);
      
      // Randomly bump cycles count on active agents
      setAgents(prev => prev.map(a => {
        if (a.status === 'active') {
          return { ...a, cycles: a.cycles + Math.floor(Math.random() * 5) };
        }
        return a;
      }));
    }, 2000);

    return () => clearInterval(interval);
  }, [swarmStatus]);

  // Handle auto scrolling terminal
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [terminalLogs]);

  // Simulate task processing loop
  useEffect(() => {
    const activeTask = tasks.find(t => t.status === 'running');
    if (!activeTask) return;

    const timer = setTimeout(() => {
      setTasks(prev => prev.map(t => {
        if (t.id === activeTask.id) {
          return {
            ...t,
            status: 'success',
            result: 'Process completed. Verified all database parameters and returned success exit code.'
          };
        }
        return t;
      }));

      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setTerminalLogs(prev => [
        ...prev,
        `[${timestamp}] Swarm task #${activeTask.id} completed. Assigning worker idle status.`
      ]);
    }, 5000);

    return () => clearTimeout(timer);
  }, [tasks]);

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskPrompt.trim()) return;

    const newTask: SwarmTask = {
      id: tasks.length + 1,
      prompt: taskPrompt.trim(),
      assignedAgent: taskAgent,
      status: 'queued'
    };

    setTasks(prev => [...prev, newTask]);
    setTaskPrompt('');

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setTerminalLogs(prev => [
      ...prev,
      `[${timestamp}] Enqueued Swarm Task #${newTask.id} to agent "${taskAgent}": ${newTask.prompt}`
    ]);

    // Dispatch queued tasks to running
    setTimeout(() => {
      setTasks(prev => prev.map(t => {
        if (t.id === newTask.id) {
          return { ...t, status: 'running' };
        }
        return t;
      }));
      setTerminalLogs(prev => [
        ...prev,
        `[${timestamp}] Dispatching Task #${newTask.id} to Agent (${taskAgent}). Status set to RUNNING.`
      ]);
    }, 1500);
  };

  return (
    <div className="flex flex-col h-full bg-background scanlines">
      {/* Top Banner Control */}
      <div className="flex justify-between items-center px-4 py-2 border-b border-border bg-card/40 text-[10px] text-muted-foreground font-mono">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${swarmStatus === 'online' ? 'bg-secondary animate-pulse' : 'bg-destructive'}`} />
            SWARM CORE: {swarmStatus === 'online' ? 'ACTIVE' : 'MUTED'} (43 WORKERS)
          </span>
          <span>COMPLETED JOBS: {tasks.filter(t => t.status === 'success').length}</span>
        </div>
        <div className="flex items-center gap-2">
          {swarmStatus === 'online' ? (
            <button
              onClick={() => setSwarmStatus('paused')}
              className="flex items-center gap-1 px-2 py-0.5 rounded border border-destructive bg-destructive/10 text-destructive hover:bg-destructive hover:text-white transition-all font-mono"
            >
              <Pause className="w-2.5 h-2.5" />
              Pause Swarm
            </button>
          ) : (
            <button
              onClick={() => setSwarmStatus('online')}
              className="flex items-center gap-1 px-2 py-0.5 rounded border border-secondary bg-secondary/10 text-secondary hover:bg-secondary hover:text-white transition-all font-mono"
            >
              <Play className="w-2.5 h-2.5" />
              Resume Swarm
            </button>
          )}
        </div>
      </div>

      {/* Grid Dashboard */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left Side: Swarm Nodes Grid & Task dispatch (60% width) */}
        <div className="md:w-[60%] border-r border-border p-4 overflow-y-auto space-y-4 flex flex-col">
          <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase block">Active Swarm Workers (43 Nodes catalog)</span>
          
          {/* Swarm Agents Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {agents.map((agent) => (
              <div key={agent.id} className="p-3 bg-card/80 border border-border rounded-lg font-mono text-xs space-y-2 relative overflow-hidden">
                {/* Visual accent stripes for active agents */}
                {agent.status === 'active' && (
                  <div className="absolute top-0 left-0 bottom-0 w-[3px] bg-secondary" />
                )}
                
                <div className="flex justify-between items-start gap-1">
                  <div>
                    <span className="font-bold text-foreground block">{agent.name}</span>
                    <span className="text-[9px] text-muted-foreground uppercase">{agent.role}</span>
                  </div>
                  <span className={`text-[9px] border px-1.5 py-0.2 rounded font-bold uppercase ${
                    agent.status === 'active'
                      ? 'border-secondary/40 bg-secondary/10 text-secondary'
                      : 'border-border bg-muted text-muted-foreground'
                  }`}>
                    {agent.status}
                  </span>
                </div>

                {agent.activeTask ? (
                  <div className="bg-black/35 p-1.5 rounded border border-secondary/15 text-[10px] text-secondary leading-tight flex items-start gap-1">
                    <span className="animate-pulse">⚡</span>
                    <span className="truncate">{agent.activeTask}</span>
                  </div>
                ) : (
                  <div className="text-[9px] text-muted-foreground/60 italic">System namespace idle... awaiting jobs.</div>
                )}

                <div className="flex justify-between items-center text-[9px] text-muted-foreground border-t border-border/40 pt-1.5">
                  <span>CYCLES PROCESSED</span>
                  <span className="font-bold text-foreground font-mono">{agent.cycles.toLocaleString()}</span>
                </div>
              </div>
            ))}
            
            {/* Swarm size overflow indicator card */}
            <div className="p-3 border border-dashed border-border rounded-lg font-mono text-xs flex flex-col items-center justify-center text-center text-muted-foreground/80 space-y-1 bg-muted/10">
              <span className="font-bold text-foreground text-sm">+35 Sandbox Nodes</span>
              <span className="text-[9px] uppercase">Review, CLI workers, Outbound receptionist callers</span>
            </div>
          </div>

          {/* Task Dispatch Console form */}
          <div className="border border-border bg-card/35 rounded-lg p-3 space-y-3 font-mono text-xs shrink-0">
            <span className="font-bold text-secondary uppercase block border-b border-border/60 pb-1">Task Dispatch console</span>
            <form onSubmit={handleCreateTask} className="flex gap-2">
              <input
                value={taskPrompt}
                onChange={e => setTaskPrompt(e.target.value)}
                placeholder="Instruct swarm, e.g. Audit security namespaces, Check notes for wiki loops..."
                className="flex-grow bg-input-background border border-border focus:border-secondary rounded px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
              />
              <select
                value={taskAgent}
                onChange={e => setTaskAgent(e.target.value)}
                className="bg-card border border-border rounded px-2 text-xs text-foreground focus:outline-none"
              >
                {agents.map(a => (
                  <option key={a.id} value={a.name}>{a.name}</option>
                ))}
              </select>
              <button
                type="submit"
                disabled={!taskPrompt.trim()}
                className="px-4 bg-primary text-primary-foreground border border-primary hover:bg-primary-foreground hover:text-primary rounded font-bold transition-all uppercase flex items-center gap-1 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                Dispatch
              </button>
            </form>
          </div>
        </div>

        {/* Right Side: Swarm-wide logs terminal (40% width) */}
        <div className="flex-1 flex flex-col overflow-hidden p-4 space-y-3">
          <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase">Live Swarm Logs & Task Queue</span>
          
          {/* Task Queue list */}
          <div className="bg-card/45 border border-border rounded-lg p-3 space-y-2 max-h-[180px] overflow-y-auto font-mono text-xs">
            <span className="font-bold text-muted-foreground text-[10px] uppercase block">Swarm Job Queue</span>
            {tasks.map(task => (
              <div key={task.id} className="p-2 border border-border/60 bg-black/25 rounded space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-secondary text-[10px] uppercase">Job #{task.id} // {task.assignedAgent}</span>
                  <span className={`text-[9px] font-bold px-1 py-0.2 rounded border ${
                    task.status === 'success'
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                      : task.status === 'running'
                      ? 'border-amber-500 bg-amber-500/10 text-amber-400 animate-pulse'
                      : 'border-border bg-muted text-muted-foreground'
                  }`}>
                    {task.status}
                  </span>
                </div>
                <p className="text-[11px] text-foreground leading-normal">{task.prompt}</p>
                {task.result && (
                  <div className="border-t border-border/20 pt-1 mt-1 text-[9px] text-emerald-400">
                    <span className="font-bold uppercase">Result:</span> {task.result}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Swarm Live Terminal Console */}
          <div className="flex-grow flex flex-col border border-border bg-black rounded-lg overflow-hidden relative">
            <div className="bg-muted/40 p-2 border-b border-border flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground uppercase select-none">
              <Terminal className="w-3.5 h-3.5 text-secondary animate-pulse" />
              <span>Cognitive Namespace Terminal Output</span>
            </div>
            
            <div className="flex-grow p-3 overflow-y-auto space-y-1.5 font-mono text-[10px] leading-tight select-text text-emerald-400 scroll-smooth">
              {terminalLogs.map((log, idx) => (
                <div key={idx} className="flex gap-1.5">
                  <span className="text-secondary/55 select-none">&gt;&gt;</span>
                  <span>{log}</span>
                </div>
              ))}
              <div ref={terminalEndRef} />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
