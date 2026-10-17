import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from './lib/api';
import ChatView from './views/ChatView';
import StudyView from './views/StudyView';
import NotesView from './views/NotesView';
import MeetingsView from './views/MeetingsView';
import AgentsView from './views/AgentsView';
import SettingsView from './views/SettingsView';
import { 
  MessageSquare, 
  BookOpen, 
  FileText, 
  Video, 
  Cpu, 
  Settings, 
  Menu,
  Moon,
  Sun,
  Activity,
  Maximize2,
  Minimize2,
  X
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'chat' | 'study' | 'notes' | 'meetings' | 'agents' | 'settings'>('chat');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [activeModel, setActiveModel] = useState('llama3.2:3b');
  const [tokSpeed, setTokSpeed] = useState(24);

  // Sync theme to index.html element
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
  }, [theme]);

  // Query backend health to check status
  const { data: health, isLoading } = useQuery({
    queryKey: ['health-check'],
    queryFn: api.getHealth,
    refetchInterval: 12000,
  });

  const isOnline = !!health?.ok;

  // Mock window close/minimize/maximize actions
  const handleWindowAction = (action: string) => {
    console.log(`Window mock action: ${action}`);
  };

  const getStatusIndicator = () => {
    return isOnline ? (
      <span className="flex items-center gap-1.5 text-emerald-400 font-bold uppercase text-[9px] bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/25">
        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
        Core online
      </span>
    ) : (
      <span className="flex items-center gap-1.5 text-destructive font-bold uppercase text-[9px] bg-destructive/10 px-2 py-0.5 rounded border border-destructive/20 animate-pulse">
        <span className="w-1.5 h-1.5 bg-destructive rounded-full" />
        Core offline
      </span>
    );
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden text-foreground bg-background select-none">
      
      {/* 1. TOP HEADER (48px height) */}
      <header className="h-[48px] border-b border-border bg-card/65 px-4 flex items-center justify-between shrink-0 font-mono text-xs relative">
        {/* Brand label */}
        <div className="flex items-center gap-2">
          <span className="font-extrabold tracking-widest text-secondary font-sans text-sm">
            ABRAR AI <span className="text-muted-foreground">//</span> NEXUS
          </span>
          <span className="text-[10px] text-muted-foreground/60 select-none">v0.1.0</span>
        </div>

        {/* Model status pill & tok speed indicator */}
        <div className="hidden sm:flex items-center gap-4">
          <div className="flex items-center gap-2 px-2.5 py-1 bg-muted/60 border border-border rounded-md">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="font-bold text-[10px] uppercase font-mono tracking-wider">{activeModel}</span>
          </div>
          <div className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Activity className="w-3 h-3 text-secondary animate-pulse" />
            <span>LOCAL · {tokSpeed} TOK/S</span>
          </div>
        </div>

        {/* Right side window controls mock & status */}
        <div className="flex items-center gap-4">
          {getStatusIndicator()}

          {/* Theme Selector */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors border border-transparent hover:border-border"
          >
            {theme === 'dark' ? <Sun className="w-3.5 h-3.5 text-primary" /> : <Moon className="w-3.5 h-3.5 text-secondary" />}
          </button>

          {/* Window Buttons */}
          <div className="flex items-center gap-1.5 pl-2 border-l border-border/60">
            <button 
              onClick={() => handleWindowAction('minimize')}
              className="p-0.5 text-muted-foreground/65 hover:text-foreground rounded transition-colors"
            >
              <Minimize2 className="w-3 h-3" />
            </button>
            <button 
              onClick={() => handleWindowAction('maximize')}
              className="p-0.5 text-muted-foreground/65 hover:text-foreground rounded transition-colors"
            >
              <Maximize2 className="w-3 h-3" />
            </button>
            <button 
              onClick={() => handleWindowAction('close')}
              className="p-0.5 text-muted-foreground/65 hover:text-destructive rounded transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container Shell */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* 2. LEFT SIDEBAR (256px width) */}
        <aside className="w-[256px] border-r border-border bg-sidebar/55 flex flex-col justify-between shrink-0 font-mono text-xs">
          
          <div className="p-3 space-y-4">
            {/* New Conversation Trigger */}
            <button
              onClick={() => setActiveTab('chat')}
              className="w-full py-2.5 rounded-lg border border-primary/45 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground font-bold transition-all shadow-md shadow-primary/10 tracking-widest flex items-center justify-center gap-2 cursor-pointer"
            >
              <MessageSquare className="w-4 h-4" />
              NEW CONVERSATION
            </button>

            {/* Navigation links block */}
            <nav className="space-y-1">
              <span className="text-[9px] text-muted-foreground/50 tracking-widest uppercase block px-2 mb-2">SYSTEM CAPABILITIES</span>
              
              <button
                onClick={() => setActiveTab('chat')}
                className={`w-full py-2 px-3 rounded-md transition-all flex items-center gap-3 justify-start border ${
                  activeTab === 'chat'
                    ? 'bg-secondary/10 border-secondary text-secondary font-bold'
                    : 'bg-transparent border-transparent text-sidebar-foreground hover:bg-card/50 hover:text-foreground'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                <span>CHAT // COMM</span>
              </button>

              <button
                onClick={() => setActiveTab('study')}
                className={`w-full py-2 px-3 rounded-md transition-all flex items-center gap-3 justify-start border ${
                  activeTab === 'study'
                    ? 'bg-secondary/10 border-secondary text-secondary font-bold'
                    : 'bg-transparent border-transparent text-sidebar-foreground hover:bg-card/50 hover:text-foreground'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                <span>STUDY // RAG</span>
              </button>

              <button
                onClick={() => setActiveTab('notes')}
                className={`w-full py-2 px-3 rounded-md transition-all flex items-center gap-3 justify-start border ${
                  activeTab === 'notes'
                    ? 'bg-secondary/10 border-secondary text-secondary font-bold'
                    : 'bg-transparent border-transparent text-sidebar-foreground hover:bg-card/50 hover:text-foreground'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>NOTES // GRAPH</span>
              </button>

              <button
                onClick={() => setActiveTab('meetings')}
                className={`w-full py-2 px-3 rounded-md transition-all flex items-center gap-3 justify-start border ${
                  activeTab === 'meetings'
                    ? 'bg-secondary/10 border-secondary text-secondary font-bold'
                    : 'bg-transparent border-transparent text-sidebar-foreground hover:bg-card/50 hover:text-foreground'
                }`}
              >
                <Video className="w-4 h-4" />
                <span>MEETINGS // AUDIO</span>
              </button>

              <button
                onClick={() => setActiveTab('agents')}
                className={`w-full py-2 px-3 rounded-md transition-all flex items-center gap-3 justify-start border ${
                  activeTab === 'agents'
                    ? 'bg-secondary/10 border-secondary text-secondary font-bold'
                    : 'bg-transparent border-transparent text-sidebar-foreground hover:bg-card/50 hover:text-foreground'
                }`}
              >
                <Cpu className="w-4 h-4" />
                <span>SWARM // AGENTS</span>
              </button>
            </nav>
          </div>

          {/* Bottom Sidebar Action panel */}
          <div className="p-3 border-t border-border bg-card/15 space-y-2">
            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full py-2 px-3 rounded-md transition-all flex items-center gap-3 justify-start border ${
                activeTab === 'settings'
                  ? 'bg-secondary/10 border-secondary text-secondary font-bold'
                  : 'bg-transparent border-transparent text-sidebar-foreground hover:bg-card/50 hover:text-foreground'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>SETTINGS // SYS</span>
            </button>
            
            <div className="flex justify-between items-center text-[9px] text-muted-foreground/60 px-1 border-t border-border/30 pt-2 font-mono">
              <span>LOCAL GATEWAY</span>
              <span>127.0.0.1:8100</span>
            </div>
          </div>

        </aside>

        {/* 3. MAIN WORKSPACE */}
        <main className="flex-1 flex flex-col overflow-hidden bg-background">
          {activeTab === 'chat' && <ChatView activeModel={activeModel} setTokSpeed={setTokSpeed} />}
          {activeTab === 'study' && <StudyView />}
          {activeTab === 'notes' && <NotesView />}
          {activeTab === 'meetings' && <MeetingsView />}
          {activeTab === 'agents' && <AgentsView />}
          {activeTab === 'settings' && (
            <SettingsView 
              theme={theme} 
              setTheme={setTheme} 
              activeModel={activeModel} 
              setActiveModel={setActiveModel} 
            />
          )}
        </main>

      </div>
    </div>
  );
}
