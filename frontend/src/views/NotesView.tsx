import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, Note } from '../lib/api';
import { 
  FileText, 
  Plus, 
  Trash2, 
  Network, 
  Sparkles, 
  RefreshCw, 
  Layers,
  ArrowRight,
  Database,
  Search,
  BookOpen,
  Info,
  Tag,
  Link as LinkIcon,
  HelpCircle,
  Cpu,
  CpuIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function NotesView() {
  const queryClient = useQueryClient();
  const [activeNoteId, setActiveNoteId] = useState<number | null>(null);
  
  // Sidebar tab: explorer vs graph vs plugins
  const [sidebarTab, setSidebarTab] = useState<'explorer' | 'graph' | 'plugins'>('explorer');

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Editor states
  const [editorTitle, setEditorTitle] = useState('');
  const [editorBody, setEditorBody] = useState('');
  const [editorTags, setEditorTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  
  // Copilot helper states
  const [copilotQuery, setCopilotQuery] = useState('');
  const [copilotResponse, setCopilotResponse] = useState('');
  const [isCopilotLoading, setIsCopilotLoading] = useState(false);

  // Fetch all notes
  const { data: notes = [], isLoading: isNotesLoading, refetch: refetchNotes } = useQuery({
    queryKey: ['notes'],
    queryFn: api.getNotes
  });

  // Fetch current backlinks
  const activeNote = notes.find(n => n.id === activeNoteId);
  const { data: backlinksData } = useQuery({
    queryKey: ['backlinks', activeNote?.title],
    queryFn: () => api.getBacklinks(activeNote!.title),
    enabled: !!activeNote?.title
  });
  const backlinks = backlinksData?.backlinks || [];

  // Fetch knowledge graph
  const { data: graphData, refetch: refetchGraph } = useQuery({
    queryKey: ['graph'],
    queryFn: api.getNoteGraph
  });

  // Create Note mutation
  const createNoteMutation = useMutation({
    mutationFn: (data: { title: string; body: string }) => api.createNote(data.title, data.body),
    onSuccess: (newNote) => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      setActiveNoteId(newNote.id);
      refetchNotes();
      refetchGraph();
    }
  });

  // Update Note mutation
  const updateNoteMutation = useMutation({
    mutationFn: (data: { id: number; body: string }) => api.updateNote(data.id, data.body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      refetchGraph();
    }
  });

  // Delete Note mutation
  const deleteNoteMutation = useMutation({
    mutationFn: (id: number) => api.deleteNote(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      if (activeNoteId && !notes.some(n => n.id === activeNoteId)) {
        setActiveNoteId(notes[0]?.id || null);
      }
      refetchNotes();
      refetchGraph();
    }
  });

  // Initialize editor fields when note selected
  useEffect(() => {
    if (activeNote) {
      setEditorTitle(activeNote.title);
      setEditorBody(activeNote.body);
      setEditorTags(activeNote.tags || []);
    } else if (notes.length > 0 && activeNoteId === null) {
      setActiveNoteId(notes[0].id);
    }
  }, [activeNoteId, notes]);

  // Debounced auto-save editor body changes
  useEffect(() => {
    if (!activeNoteId || !activeNote) return;
    if (editorBody === activeNote.body) return; // avoid saving if same

    const timer = setTimeout(() => {
      updateNoteMutation.mutate({ id: activeNoteId, body: editorBody });
    }, 800);

    return () => clearTimeout(timer);
  }, [editorBody]);

  const handleCreateNote = () => {
    createNoteMutation.mutate({
      title: `Untitled ${notes.length + 1}.md`,
      body: '# ' + `Untitled ${notes.length + 1}\n\nStart writing notes here... Link other notes with wiki brackets, e.g. [[Self-Attention Mechanism.md]]`
    });
  };

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTag.trim() || !activeNoteId || !activeNote) return;
    const cleanedTag = newTag.trim().toLowerCase().replace('#', '');
    if (!editorTags.includes(cleanedTag)) {
      const updatedTags = [...editorTags, cleanedTag];
      setEditorTags(updatedTags);
      
      // Update tags in backend by appending tag to the text body
      const newBody = editorBody + `\n#${cleanedTag}`;
      setEditorBody(newBody);
      updateNoteMutation.mutate({ id: activeNoteId, body: newBody });
    }
    setNewTag('');
  };

  const handleCopilotQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!copilotQuery.trim() || !activeNote) return;

    setIsCopilotLoading(true);
    setCopilotResponse('');

    try {
      const response = await api.sendChatMessage(
        `Note Title: ${activeNote.title}\nNote Body:\n${editorBody}\n\nUser Question: ${copilotQuery.trim()}`
      );
      setCopilotResponse(response.text);
    } catch (err: any) {
      setCopilotResponse(`Copilot inference error: ${err.message}`);
    } finally {
      setIsCopilotLoading(true); // completed (using state to persist view)
      setIsCopilotLoading(false);
    }
  };

  // Filter notes based on search query
  const filteredNotes = notes.filter(note => {
    const q = searchQuery.toLowerCase();
    return note.title.toLowerCase().includes(q) || note.body.toLowerCase().includes(q);
  });

  // Calculate coordinates for graph nodes rendering
  const renderGraphNodes = () => {
    if (!graphData || !graphData.nodes || graphData.nodes.length === 0) return null;
    const width = 360;
    const height = 240;
    const center = { x: width / 2, y: height / 2 };
    
    // Distribute nodes in a circle or layout
    const numNodes = graphData.nodes.length;
    const radius = Math.min(width, height) * 0.35;
    const nodeCoords = graphData.nodes.map((node, idx) => {
      const angle = (idx / numNodes) * 2 * Math.PI;
      return {
        id: node.id,
        x: center.x + radius * Math.cos(angle),
        y: center.y + radius * Math.sin(angle),
        label: node.label,
        type: node.type,
      };
    });

    const getCoords = (id: string) => nodeCoords.find(n => n.id === id) || { x: center.x, y: center.y };

    return (
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} className="bg-black/40 rounded border border-border">
        {/* Draw edges (links) */}
        {graphData.edges && graphData.edges.map((edge, i) => {
          const start = getCoords(edge.source);
          const end = getCoords(edge.target);
          return (
            <line
              key={i}
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              stroke="rgba(0, 168, 168, 0.4)"
              strokeWidth="1"
              strokeDasharray="2,2"
            />
          );
        })}

        {/* Draw node circles */}
        {nodeCoords.map((node) => {
          const isActive = (node.type === 'note' && `note:${activeNoteId}` === node.id);
          return (
            <g key={node.id}>
              <circle
                cx={node.x}
                cy={node.y}
                r={isActive ? 6 : 4}
                fill={node.type === 'meeting' ? '#ef4444' : isActive ? '#f59e0b' : '#00a8a8'}
                className="transition-all hover:r-7 cursor-pointer"
              />
              <text
                x={node.x}
                y={node.y - 8}
                textAnchor="middle"
                fill="#9caec2"
                fontSize="7"
                fontFamily="JetBrains Mono, monospace"
                className="pointer-events-none select-none uppercase font-bold"
              >
                {node.label.replace('.md', '')}
              </text>
            </g>
          );
        })}
      </svg>
    );
  };

  return (
    <div className="flex flex-col h-full bg-background scanlines">
      {/* 3-panel split for Notes Workspace */}
      <div className="flex-grow flex overflow-hidden">
        
        {/* Panel 1: Notes List Explorer (200px) */}
        <div className="w-[200px] border-r border-border bg-card/20 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-border bg-card/60 flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase">Vault Files</span>
            <button
              onClick={handleCreateNote}
              className="p-1 rounded bg-secondary/15 text-secondary border border-secondary/20 hover:bg-secondary hover:text-white transition-colors"
              title="Create new markdown note"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-2 border-b border-border">
            <div className="relative flex items-center">
              <Search className="absolute left-2 w-3 h-3 text-muted-foreground" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search notes..."
                className="w-full bg-input-background text-[11px] font-mono pl-7 pr-2 py-1 rounded border border-border focus:border-secondary focus:outline-none"
              />
            </div>
          </div>

          <div className="flex-grow overflow-y-auto p-1.5 space-y-1">
            {isNotesLoading ? (
              <div className="p-3 text-center text-[10px] text-muted-foreground font-mono">Syncing Vault...</div>
            ) : filteredNotes.length === 0 ? (
              <div className="p-3 text-center text-[10px] text-muted-foreground font-mono">No notes found.</div>
            ) : (
              filteredNotes.map(note => (
                <div
                  key={note.id}
                  onClick={() => setActiveNoteId(note.id)}
                  className={`p-2 rounded font-mono text-[11px] transition-all cursor-pointer flex items-center justify-between ${
                    activeNoteId === note.id
                      ? 'bg-secondary/10 border border-secondary/35 text-secondary font-bold'
                      : 'border border-transparent hover:bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span className="truncate max-w-[130px]">{note.title}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNoteMutation.mutate(note.id);
                    }}
                    className="text-muted-foreground hover:text-destructive p-0.5 rounded opacity-40 hover:opacity-100 transition-all"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Panel 2: Live Editor Workspace (Flex Grow) */}
        <div className="flex-1 border-r border-border bg-background flex flex-col overflow-hidden">
          {activeNote ? (
            <div className="flex-grow flex flex-col overflow-hidden">
              {/* Editor Header */}
              <div className="p-3 border-b border-border bg-card/40 flex justify-between items-center font-mono text-xs">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-secondary" />
                  <input
                    value={editorTitle}
                    onChange={e => setEditorTitle(e.target.value)}
                    readOnly // Title changes managed in backend currently by file naming standard
                    className="font-bold bg-transparent text-foreground border-none focus:outline-none select-text cursor-default"
                  />
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase">
                  <span>Auto-saved</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                </div>
              </div>

              {/* Editor Body Textarea */}
              <div className="flex-grow p-4 overflow-hidden flex flex-col space-y-4">
                <textarea
                  value={editorBody}
                  onChange={e => setEditorBody(e.target.value)}
                  placeholder="# Enter Markdown Heading..."
                  className="flex-grow w-full bg-transparent text-xs font-mono text-foreground focus:outline-none resize-none leading-relaxed select-text"
                />

                {/* Backlinks indicator / Tag entry bottom row */}
                <div className="border-t border-border/60 pt-3 space-y-2 font-mono text-xs">
                  <div className="flex justify-between items-start gap-4">
                    {/* Wiki Backlinks tracker */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                        <LinkIcon className="w-3 h-3 text-secondary" />
                        Wiki Backlinks ({backlinks.length})
                      </span>
                      {backlinks.length === 0 ? (
                        <span className="text-[9px] text-muted-foreground/60 block">No files link to this note yet.</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {backlinks.map((link) => (
                            <button
                              key={link.id}
                              onClick={() => setActiveNoteId(link.id)}
                              className="text-[9px] bg-secondary/15 text-secondary border border-secondary/25 px-1.5 py-0.5 rounded hover:bg-secondary hover:text-white transition-colors"
                            >
                              [[{link.title.replace('.md', '')}]]
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Tag list & inline addition form */}
                    <div className="space-y-1.5 shrink-0 max-w-[200px]">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                        <Tag className="w-3 h-3 text-amber-500" />
                        Tags
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {editorTags.map((tag, idx) => (
                          <span key={idx} className="text-[9px] bg-accent/40 text-accent-foreground border border-border px-1.5 py-0.5 rounded">
                            #{tag}
                          </span>
                        ))}
                      </div>
                      <form onSubmit={handleAddTag} className="flex gap-1 mt-1">
                        <input
                          value={newTag}
                          onChange={e => setNewTag(e.target.value)}
                          placeholder="Add #tag..."
                          className="bg-input-background border border-border rounded px-1.5 py-0.5 text-[9px] w-24 text-foreground focus:outline-none"
                        />
                        <button type="submit" className="px-1.5 bg-muted rounded text-[9px] hover:bg-accent border border-border">ADD</button>
                      </form>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-grow flex flex-col items-center justify-center text-center p-8 text-muted-foreground font-mono space-y-2">
              <FileText className="w-8 h-8 text-secondary animate-pulse" />
              <h3 className="text-xs font-bold text-foreground uppercase">Note Workspace Unloaded</h3>
              <p className="text-[11px] max-w-xs">Select a note from the explorer files or click the + button to create a new page.</p>
            </div>
          )}
        </div>

        {/* Panel 3: Knowledge Graph / local-AI Copilot Sidebar (280px) */}
        <div className="w-[280px] bg-card/25 flex flex-col overflow-hidden">
          {/* Header tabs for Graph vs plugins */}
          <div className="flex border-b border-border bg-card/60">
            <button
              onClick={() => setSidebarTab('explorer')}
              className={`flex-1 py-2 text-[10px] font-mono font-bold tracking-wider transition-all border-b-2 uppercase ${
                sidebarTab === 'explorer'
                  ? 'border-secondary text-secondary bg-secondary/5'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Copilot
            </button>
            <button
              onClick={() => setSidebarTab('graph')}
              className={`flex-1 py-2 text-[10px] font-mono font-bold tracking-wider transition-all border-b-2 uppercase ${
                sidebarTab === 'graph'
                  ? 'border-secondary text-secondary bg-secondary/5'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Graph
            </button>
            <button
              onClick={() => setSidebarTab('plugins')}
              className={`flex-1 py-2 text-[10px] font-mono font-bold tracking-wider transition-all border-b-2 uppercase ${
                sidebarTab === 'plugins'
                  ? 'border-secondary text-secondary bg-secondary/5'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Plugins
            </button>
          </div>

          <div className="flex-grow overflow-y-auto p-3">
            <AnimatePresence mode="wait">
              {/* Subtab 1: Llama Copilot for Note queries */}
              {sidebarTab === 'explorer' && (
                <motion.div
                  key="explorer-sub"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4 font-mono text-xs"
                >
                  <div className="bg-secondary/5 border border-secondary/25 p-2 rounded space-y-1.5">
                    <span className="font-bold text-secondary uppercase flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5 text-secondary animate-pulse" />
                      Llama Note Copilot
                    </span>
                    <p className="text-[10px] text-muted-foreground">Ask questions directly about this page content using your local Ollama core.</p>
                  </div>

                  <form onSubmit={handleCopilotQuery} className="space-y-2">
                    <textarea
                      value={copilotQuery}
                      onChange={e => setCopilotQuery(e.target.value)}
                      placeholder="Summarize the foundations of this mechanism...?"
                      rows={3}
                      className="w-full bg-input-background border border-border focus:border-secondary rounded p-2 text-xs text-foreground placeholder:text-muted-foreground/60 resize-none focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={!copilotQuery.trim() || isCopilotLoading || !activeNote}
                      className="w-full py-1.5 bg-primary text-primary-foreground font-bold border border-primary hover:bg-primary-foreground hover:text-primary rounded text-[10px] uppercase tracking-wider flex items-center justify-center gap-1 transition-all"
                    >
                      {isCopilotLoading ? <RefreshCw className="w-3 animate-spin" /> : 'QUERY COPILOT'}
                    </button>
                  </form>

                  {copilotResponse && (
                    <div className="p-3 bg-black/40 border border-border rounded text-[11px] leading-relaxed whitespace-pre-wrap select-text max-h-[220px] overflow-y-auto">
                      <span className="font-bold text-secondary block border-b border-border pb-1 mb-1.5 uppercase">Llama Copilot Response:</span>
                      {copilotResponse}
                    </div>
                  )}
                </motion.div>
              )}

              {/* Subtab 2: Knowledge Graph (SVG network visualization) */}
              {sidebarTab === 'graph' && (
                <motion.div
                  key="graph-sub"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-3 font-mono"
                >
                  <div className="flex justify-between items-center text-[10px] text-muted-foreground uppercase">
                    <span>Note Links Schema</span>
                    <button onClick={() => refetchGraph()} className="text-secondary hover:underline flex items-center gap-0.5">
                      <RefreshCw className="w-3 h-3" /> reload
                    </button>
                  </div>
                  
                  <div className="w-full h-[240px]">
                    {renderGraphNodes()}
                  </div>

                  <div className="bg-accent/40 border border-border p-2 rounded text-[9px] text-muted-foreground space-y-1">
                    <span className="font-bold text-foreground uppercase block">Legend:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#00a8a8]" />
                      <span>Note File</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#f59e0b]" />
                      <span>Active Editor Note</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#ef4444]" />
                      <span>Meeting Transcript Entry</span>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Subtab 3: Obsidian plugins control panel */}
              {sidebarTab === 'plugins' && (
                <motion.div
                  key="plugins-sub"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-3 font-mono text-xs"
                >
                  <span className="text-[10px] font-bold text-muted-foreground uppercase block">Installed plugins</span>
                  
                  <div className="space-y-2">
                    <div className="p-2 border border-border rounded bg-card/60 flex items-start justify-between gap-2">
                      <div>
                        <span className="font-bold text-foreground block text-[11px]">Auto-Wiki Backlinker</span>
                        <p className="text-[9px] text-muted-foreground mt-0.5">Tracks double bracket note titles and aggregates bidirectional links.</p>
                      </div>
                      <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/35 px-1 py-0.2 rounded font-bold uppercase shrink-0">
                        ACTIVE
                      </span>
                    </div>
                    <div className="p-2 border border-border rounded bg-card/60 flex items-start justify-between gap-2">
                      <div>
                        <span className="font-bold text-foreground block text-[11px]">Local Llama Auto-Tagger</span>
                        <p className="text-[9px] text-muted-foreground mt-0.5">Scrapes subject matters and suggests semantic note tags dynamically.</p>
                      </div>
                      <span className="text-[9px] bg-destructive/10 text-destructive border border-destructive/20 px-1 py-0.2 rounded font-bold uppercase shrink-0">
                        OFF
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

      </div>
    </div>
  );
}
