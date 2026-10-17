import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { 
  Settings, 
  Server, 
  Database, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Volume2, 
  Sliders,
  Sun,
  Moon,
  ShieldCheck,
  Cpu
} from 'lucide-react';

interface SettingsViewProps {
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
  activeModel: string;
  setActiveModel: (model: string) => void;
}

export default function SettingsView({ theme, setTheme, activeModel, setActiveModel }: SettingsViewProps) {
  const [latency, setLatency] = useState<number | null>(null);

  // Query backend health
  const { data: healthData, isLoading: isHealthLoading, refetch: refetchHealth } = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const startTime = performance.now();
      const res = await api.getHealth();
      const endTime = performance.now();
      setLatency(Math.round(endTime - startTime));
      return res;
    }
  });

  const handleToggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
  };

  const getStatusDot = (ok: boolean) => {
    return ok 
      ? <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-md shadow-emerald-500/20" />
      : <span className="w-2.5 h-2.5 rounded-full bg-destructive shadow-md shadow-destructive/20 animate-pulse" />;
  };

  return (
    <div className="flex flex-col h-full bg-background scanlines p-4 space-y-4 overflow-y-auto">
      <div className="flex items-center gap-2 border-b border-border pb-2 font-mono">
        <Settings className="w-5 h-5 text-secondary" />
        <h1 className="text-base font-bold text-foreground">SYSTEM SETTINGS // CONTROL</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Panel 1: Theme & Interface Parameters */}
        <div className="border border-border rounded-lg bg-card/45 p-4 font-mono text-xs space-y-4">
          <span className="font-bold text-secondary uppercase block border-b border-border/40 pb-1.5 flex items-center gap-1.5">
            <Sliders className="w-4 h-4 text-secondary" />
            01 // Visual & Client options
          </span>

          <div className="flex justify-between items-center py-2 border-b border-border/30">
            <div>
              <span className="font-bold text-foreground block">System Theme</span>
              <p className="text-[10px] text-muted-foreground mt-0.5">Toggle between dark navy-ink and cool near-white.</p>
            </div>
            <button
              onClick={handleToggleTheme}
              className="px-3 py-1.5 bg-muted hover:bg-accent border border-border rounded font-bold uppercase transition-all flex items-center gap-1.5 hover:border-secondary"
            >
              {theme === 'dark' ? (
                <>
                  <Moon className="w-3.5 h-3.5 text-secondary" />
                  Dark Navy
                </>
              ) : (
                <>
                  <Sun className="w-3.5 h-3.5 text-primary" />
                  Light Ground
                </>
              )}
            </button>
          </div>

          <div className="flex justify-between items-center py-2 border-b border-border/30">
            <div>
              <span className="font-bold text-foreground block">Cognitive Core Model</span>
              <p className="text-[10px] text-muted-foreground mt-0.5">Choose primary inference router model.</p>
            </div>
            <select
              value={activeModel}
              onChange={e => setActiveModel(e.target.value)}
              className="bg-card border border-border rounded px-2.5 py-1.5 text-foreground focus:outline-none focus:border-secondary text-xs uppercase"
            >
              <option value="llama3.2:3b">llama3.2:3b (Local)</option>
              <option value="deepseek-coder:1.3b">deepseek-coder:1.3b (Local)</option>
              <option value="gemini-1.5-flash">Gemini 1.5 Flash (Cloud)</option>
            </select>
          </div>

          <div className="flex justify-between items-center py-2">
            <div>
              <span className="font-bold text-foreground block">Vocal Synthesizer Voice</span>
              <p className="text-[10px] text-muted-foreground mt-0.5">Default voice for text-to-speech output.</p>
            </div>
            <select
              className="bg-card border border-border rounded px-2.5 py-1.5 text-foreground focus:outline-none focus:border-secondary text-xs uppercase"
            >
              <option>Piper (Local Default)</option>
              <option>ElevenLabs (Rachel)</option>
              <option>ElevenLabs (Adam)</option>
              <option>Google TTS</option>
            </select>
          </div>
        </div>

        {/* Panel 2: FastAPI Server Status & Metrics */}
        <div className="border border-border rounded-lg bg-card/45 p-4 font-mono text-xs space-y-4">
          <span className="font-bold text-secondary uppercase block border-b border-border/40 pb-1.5 flex items-center gap-1.5">
            <Server className="w-4 h-4 text-secondary" />
            02 // Backend diagnostics
          </span>

          <div className="flex justify-between items-center py-1 border-b border-border/30">
            <span className="text-muted-foreground uppercase">API Endpoint</span>
            <span className="font-bold text-foreground font-mono">http://127.0.0.1:8100</span>
          </div>

          <div className="flex justify-between items-center py-1 border-b border-border/30">
            <span className="text-muted-foreground uppercase">Database URL</span>
            <span className="font-bold text-foreground font-mono">sqlite:///data/suite.db</span>
          </div>

          <div className="flex justify-between items-center py-1 border-b border-border/30">
            <span className="text-muted-foreground uppercase">Core Gateway Status</span>
            <span className="flex items-center gap-1.5 font-bold uppercase text-foreground">
              {healthData?.ok ? 'Connected' : 'Offline'}
              {getStatusDot(!!healthData?.ok)}
            </span>
          </div>

          <div className="flex justify-between items-center py-1 border-b border-border/30">
            <span className="text-muted-foreground uppercase">Inference Network Latency</span>
            <span className="font-bold text-foreground">{latency !== null ? `${latency} ms` : 'N/A'}</span>
          </div>

          <button
            onClick={() => refetchHealth()}
            disabled={isHealthLoading}
            className="w-full py-2 bg-muted hover:bg-accent border border-border text-foreground font-bold rounded uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
          >
            {isHealthLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Refresh diagnostics
          </button>
        </div>
      </div>

      {/* Provider Fallback Chains Grid */}
      <div className="border border-border rounded-lg bg-card/45 p-4 font-mono text-xs space-y-4">
        <span className="font-bold text-secondary uppercase block border-b border-border/40 pb-1.5 flex items-center gap-1.5">
          <Sliders className="w-4 h-4 text-secondary" />
          03 // Provider Fallback Chain Config (Local First)
        </span>

        {isHealthLoading ? (
          <div className="p-4 text-center text-muted-foreground">Checking gateway provider configurations...</div>
        ) : !healthData ? (
          <div className="p-4 text-center text-destructive flex items-center justify-center gap-1">
            <XCircle className="w-4 h-4" />
            Backend core unreachable. Fallbacks read default config.toml structure.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* LLM Chain */}
            <div className="p-3 bg-black/40 border border-border rounded-lg space-y-2">
              <span className="font-bold text-foreground block uppercase flex items-center gap-1">
                <Cpu className="w-3.5 h-3.5 text-secondary" />
                LLM Inference
              </span>
              <div className="space-y-1 text-[11px]">
                {healthData.providers.llm?.map((p, idx) => (
                  <div key={idx} className="flex justify-between items-center border-b border-border/20 py-0.5">
                    <span className="text-muted-foreground">Level {idx + 1}</span>
                    <span className="font-bold text-secondary uppercase font-mono">{p}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* STT Chain */}
            <div className="p-3 bg-black/40 border border-border rounded-lg space-y-2">
              <span className="font-bold text-foreground block uppercase flex items-center gap-1">
                <Sliders className="w-3.5 h-3.5 text-secondary" />
                STT Transcribers
              </span>
              <div className="space-y-1 text-[11px]">
                {healthData.providers.stt?.map((p, idx) => (
                  <div key={idx} className="flex justify-between items-center border-b border-border/20 py-0.5">
                    <span className="text-muted-foreground">Level {idx + 1}</span>
                    <span className="font-bold text-secondary uppercase font-mono">{p}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* TTS Chain */}
            <div className="p-3 bg-black/40 border border-border rounded-lg space-y-2">
              <span className="font-bold text-foreground block uppercase flex items-center gap-1">
                <Volume2 className="w-3.5 h-3.5 text-secondary" />
                TTS Synthesizers
              </span>
              <div className="space-y-1 text-[11px]">
                {healthData.providers.tts?.map((p, idx) => (
                  <div key={idx} className="flex justify-between items-center border-b border-border/20 py-0.5">
                    <span className="text-muted-foreground">Level {idx + 1}</span>
                    <span className="font-bold text-secondary uppercase font-mono">{p}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-3 bg-accent/20 border border-border/60 rounded flex items-start gap-2 font-mono text-[10px] text-muted-foreground">
        <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
        <p>
          Local-first privacy standard active. External model routers like Gemini are invoked strictly as fallback mechanisms when local Ollama models do not respond. Data is processed locally on SQLite block memory.
        </p>
      </div>
    </div>
  );
}
