import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, DocumentSource } from '../lib/api';
import { 
  BookOpen, 
  Upload, 
  Trash2, 
  Sparkles, 
  Send, 
  HelpCircle, 
  CheckCircle2, 
  XCircle,
  BookOpenCheck,
  RefreshCw,
  Plus,
  BookOpenText,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function StudyView() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'sources' | 'generate' | 'qa'>('sources');
  const [selectedDocIds, setSelectedDocIds] = useState<number[]>([]);
  const [activeDoc, setActiveDoc] = useState<DocumentSource | null>(null);

  // Doc ingestion states
  const [showAddForm, setShowAddForm] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [docText, setDocText] = useState('');
  const [docCategory, setDocCategory] = useState('Research Paper');

  // RAG states
  const [ragQuery, setRagQuery] = useState('');
  const [ragAnswer, setRagAnswer] = useState('');
  const [ragSources, setRagSources] = useState<{ doc_id: number; title: string }[]>([]);
  const [isRagLoading, setIsRagLoading] = useState(false);

  // Study generation states
  const [studyKind, setStudyKind] = useState<'guide' | 'flashcards' | 'quiz'>('guide');
  const [generatedResult, setGeneratedResult] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Flashcards active card index
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [isCardFlipped, setIsCardFlipped] = useState(false);

  // Quiz active states
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  // Fetch documents
  const { data: documents = [], isLoading: isDocsLoading, refetch: refetchDocs } = useQuery({
    queryKey: ['documents'],
    queryFn: api.getDocuments
  });

  // Handle doc ingestion
  const addDocMutation = useMutation({
    mutationFn: (data: { title: string; text: string; category: string }) =>
      api.addDocument(data.title, data.text, data.category),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      setDocTitle('');
      setDocText('');
      setShowAddForm(false);
      refetchDocs();
    }
  });

  // Handle doc deletion
  const deleteDocMutation = useMutation({
    mutationFn: (id: number) => api.deleteDocument(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      if (activeDoc && !documents.some(d => d.id === activeDoc.id)) {
        setActiveDoc(null);
      }
      setSelectedDocIds(prev => prev.filter(id => id !== activeDoc?.id));
      refetchDocs();
    }
  });

  const handleAddDocument = (e: React.FormEvent) => {
    e.preventDefault();
    if (!docTitle.trim() || !docText.trim()) return;
    addDocMutation.mutate({ title: docTitle.trim(), text: docText.trim(), category: docCategory });
  };

  const handleToggleDocSelect = (id: number) => {
    setSelectedDocIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Run RAG Q&A
  const handleAskRAG = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ragQuery.trim()) return;
    
    setIsRagLoading(true);
    setRagAnswer('');
    setRagSources([]);

    try {
      // If we have selected docs, restrict RAG query to them
      const docIds = selectedDocIds.length > 0 ? selectedDocIds : undefined;
      const data = await api.askRAG(ragQuery.trim(), docIds);
      setRagAnswer(data.answer);
      setRagSources(data.sources);
    } catch (err: any) {
      setRagAnswer(`Error performing RAG inference: ${err.message}`);
    } finally {
      setIsRagLoading(false);
    }
  };

  // Run Study Generator
  const handleGenerateStudy = async () => {
    if (selectedDocIds.length === 0) return;
    setIsGenerating(true);
    setGeneratedResult(null);
    setActiveCardIndex(0);
    setIsCardFlipped(false);
    setQuizAnswers({});
    setQuizSubmitted(false);

    try {
      const data = await api.generateStudy(studyKind, selectedDocIds);
      setGeneratedResult(data);
      setActiveTab('generate'); // Switch tab to view result
    } catch (err: any) {
      setGeneratedResult({ error: `Generation failed: ${err.message}` });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleQuizSelectAnswer = (qIdx: number, oIdx: number) => {
    if (quizSubmitted) return;
    setQuizAnswers(prev => ({ ...prev, [qIdx]: oIdx }));
  };

  const getQuizCorrectCount = () => {
    if (!generatedResult || !generatedResult.items) return 0;
    return generatedResult.items.reduce((acc: number, item: any, idx: number) => {
      return acc + (quizAnswers[idx] === item.answer_index ? 1 : 0);
    }, 0);
  };

  return (
    <div className="flex flex-col h-full bg-background scanlines">
      {/* Top action rail */}
      <div className="flex border-b border-border bg-card/30">
        <button
          onClick={() => setActiveTab('sources')}
          className={`flex-1 py-3 px-4 text-xs font-mono font-bold tracking-wider transition-all border-b-2 uppercase ${
            activeTab === 'sources'
              ? 'border-secondary text-secondary bg-secondary/5'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <span className="flex items-center justify-center gap-2">
            <BookOpenText className="w-3.5 h-3.5" />
            01 // Ingestion & Sources
          </span>
        </button>
        <button
          onClick={() => setActiveTab('qa')}
          className={`flex-1 py-3 px-4 text-xs font-mono font-bold tracking-wider transition-all border-b-2 uppercase ${
            activeTab === 'qa'
              ? 'border-secondary text-secondary bg-secondary/5'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <span className="flex items-center justify-center gap-2">
            <HelpCircle className="w-3.5 h-3.5" />
            02 // RAG cognitive Q&A
          </span>
        </button>
        <button
          onClick={() => setActiveTab('generate')}
          className={`flex-1 py-3 px-4 text-xs font-mono font-bold tracking-wider transition-all border-b-2 uppercase ${
            activeTab === 'generate'
              ? 'border-secondary text-secondary bg-secondary/5'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <span className="flex items-center justify-center gap-2">
            <Sparkles className="w-3.5 h-3.5" />
            03 // Study synchronizer
          </span>
        </button>
      </div>

      {/* Main split dashboard view */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left column: Sources library / checklist */}
        <div className="w-[300px] border-r border-border bg-card/25 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-border bg-card/60 flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-muted-foreground uppercase">Vault Sources</span>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="p-1 rounded bg-secondary/10 border border-secondary/30 text-secondary hover:bg-secondary hover:text-white transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-grow overflow-y-auto p-2 space-y-2">
            {/* Add Document overlay drawer inside pane */}
            <AnimatePresence>
              {showAddForm && (
                <motion.form
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  onSubmit={handleAddDocument}
                  className="bg-accent/40 border border-secondary/30 rounded p-3 space-y-3 font-mono text-xs overflow-hidden"
                >
                  <div className="flex items-center justify-between border-b border-border pb-1">
                    <span className="font-bold text-secondary uppercase">Ingest Document</span>
                    <button type="button" onClick={() => setShowAddForm(false)} className="text-muted-foreground hover:text-foreground">✕</button>
                  </div>
                  <div>
                    <label className="block text-[10px] text-muted-foreground mb-1">TITLE</label>
                    <input
                      value={docTitle}
                      onChange={e => setDocTitle(e.target.value)}
                      placeholder="e.g. Transformers.txt"
                      required
                      className="w-full bg-background border border-border rounded px-2 py-1 text-foreground focus:outline-none focus:border-secondary"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-muted-foreground mb-1">CATEGORY</label>
                    <select
                      value={docCategory}
                      onChange={e => setDocCategory(e.target.value)}
                      className="w-full bg-background border border-border rounded px-2 py-1 text-foreground focus:outline-none focus:border-secondary"
                    >
                      <option>Research Paper</option>
                      <option>Class Syllabus</option>
                      <option>Meeting Transcript</option>
                      <option>Manual / Guide</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-muted-foreground mb-1">BODY CONTENT</label>
                    <textarea
                      value={docText}
                      onChange={e => setDocText(e.target.value)}
                      placeholder="Paste factual document content here..."
                      rows={5}
                      required
                      className="w-full bg-background border border-border rounded px-2 py-1 text-foreground focus:outline-none focus:border-secondary resize-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={addDocMutation.isPending}
                    className="w-full py-1.5 bg-secondary text-white rounded font-bold hover:bg-secondary-foreground transition-all flex items-center justify-center gap-1.5"
                  >
                    {addDocMutation.isPending ? <RefreshCw className="w-3 animate-spin" /> : 'INGEST SOURCE'}
                  </button>
                </motion.form>
              )}
            </AnimatePresence>

            {/* Documents selection check items */}
            {isDocsLoading ? (
              <div className="p-4 text-center text-xs text-muted-foreground font-mono">Loading sources catalog...</div>
            ) : documents.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground font-mono border border-dashed border-border rounded">
                No sources ingested. Click the + button above to upload standard class notes or papers.
              </div>
            ) : (
              documents.map(doc => (
                <div
                  key={doc.id}
                  onClick={() => setActiveDoc(doc)}
                  className={`p-2.5 rounded border font-mono text-xs transition-all cursor-pointer flex flex-col gap-1.5 ${
                    activeDoc?.id === doc.id
                      ? 'border-secondary bg-secondary/5'
                      : 'border-border bg-card/60 hover:border-muted-foreground/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedDocIds.includes(doc.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleToggleDocSelect(doc.id);
                        }}
                        className="rounded border-border text-secondary focus:ring-secondary w-3.5 h-3.5 accent-secondary"
                      />
                      <span className="font-bold text-foreground truncate max-w-[170px]">{doc.title}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteDocMutation.mutate(doc.id);
                      }}
                      className="p-0.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                      title="Purge source from RAG DB"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-[9px] text-muted-foreground">
                    <span className="bg-muted px-1 py-0.2 rounded border border-border uppercase">{doc.category}</span>
                    <span>{doc.text.split(/\s+/).length} words</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Sync control block at bottom of list */}
          <div className="p-3 border-t border-border bg-card/50 space-y-2">
            <div className="flex justify-between items-center text-[10px] font-mono text-muted-foreground">
              <span>SELECTED SOURCES</span>
              <span className="font-bold text-secondary font-mono">{selectedDocIds.length} / {documents.length}</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <button
                onClick={() => setStudyKind('guide')}
                className={`py-1.5 text-[9px] font-mono font-bold uppercase rounded border transition-colors ${
                  studyKind === 'guide'
                    ? 'bg-secondary/20 border-secondary text-secondary'
                    : 'bg-muted border-transparent hover:bg-accent text-muted-foreground'
                }`}
              >
                Guide
              </button>
              <button
                onClick={() => setStudyKind('flashcards')}
                className={`py-1.5 text-[9px] font-mono font-bold uppercase rounded border transition-colors ${
                  studyKind === 'flashcards'
                    ? 'bg-secondary/20 border-secondary text-secondary'
                    : 'bg-muted border-transparent hover:bg-accent text-muted-foreground'
                }`}
              >
                Cards
              </button>
              <button
                onClick={() => setStudyKind('quiz')}
                className={`py-1.5 text-[9px] font-mono font-bold uppercase rounded border transition-colors ${
                  studyKind === 'quiz'
                    ? 'bg-secondary/20 border-secondary text-secondary'
                    : 'bg-muted border-transparent hover:bg-accent text-muted-foreground'
                }`}
              >
                Quiz
              </button>
            </div>
            <button
              onClick={handleGenerateStudy}
              disabled={selectedDocIds.length === 0 || isGenerating}
              className={`w-full py-2 rounded text-xs font-mono font-bold uppercase transition-all flex items-center justify-center gap-1.5 ${
                selectedDocIds.length > 0 && !isGenerating
                  ? 'bg-primary border border-primary text-primary-foreground hover:bg-primary-foreground hover:text-primary shadow-lg shadow-primary/25 cursor-pointer'
                  : 'bg-muted border-border text-muted-foreground cursor-not-allowed'
              }`}
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Compile Study Set
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right column: Action Board depending on active tab */}
        <div className="flex-1 overflow-y-auto bg-background p-4">
          <AnimatePresence mode="wait">
            {/* TAB 1: Sources view (Default) */}
            {activeTab === 'sources' && (
              <motion.div
                key="sources-tab"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4 h-full"
              >
                {activeDoc ? (
                  <div className="border border-border rounded-lg bg-card/90 overflow-hidden flex flex-col h-[calc(100%-10px)] max-h-[600px]">
                    <div className="p-3 border-b border-border bg-muted/30 flex justify-between items-center font-mono">
                      <div>
                        <h2 className="text-sm font-bold text-foreground">{activeDoc.title}</h2>
                        <div className="text-[10px] text-muted-foreground uppercase mt-0.5">
                          Category: {activeDoc.category} · Source: {activeDoc.source}
                        </div>
                      </div>
                      <span className="text-[10px] bg-secondary/15 text-secondary px-2 py-0.5 rounded border border-secondary/35 uppercase">
                        Active Source
                      </span>
                    </div>
                    <div className="flex-grow p-4 overflow-y-auto font-mono text-xs leading-relaxed text-foreground whitespace-pre-wrap select-text">
                      {activeDoc.text}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full border border-dashed border-border rounded-lg p-8 text-center text-muted-foreground font-mono space-y-3">
                    <BookOpen className="w-10 h-10 text-secondary animate-pulse" />
                    <div>
                      <h3 className="text-sm font-bold text-foreground uppercase">Cognitive Source Vault</h3>
                      <p className="text-xs max-w-sm mt-1 text-muted-foreground">
                        Select a document from the left catalog to read it here, or check multiple documents and trigger the study compiling workflow.
                      </p>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* TAB 2: Cognitive Q&A (RAG Ask) */}
            {activeTab === 'qa' && (
              <motion.div
                key="qa-tab"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                <div className="border border-border rounded-lg bg-card/40 p-4 font-mono space-y-4">
                  <div className="border-b border-border pb-2 flex justify-between items-center">
                    <span className="text-xs font-bold text-secondary uppercase">RAG Inference Engine</span>
                    {selectedDocIds.length > 0 ? (
                      <span className="text-[10px] bg-primary/20 text-primary border border-primary/40 px-2 py-0.5 rounded">
                        RESTRICTED TO {selectedDocIds.length} DOCUMENTS
                      </span>
                    ) : (
                      <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded border border-border">
                        CROSS-REPOSITORY SEARCH ACTIVED
                      </span>
                    )}
                  </div>

                  <form onSubmit={handleAskRAG} className="flex gap-2">
                    <input
                      value={ragQuery}
                      onChange={e => setRagQuery(e.target.value)}
                      placeholder="Ask the retrieval core about Transformers, RAG algorithms, or meeting outlines..."
                      className="flex-grow bg-input-background border border-border focus:border-secondary rounded px-3 py-2 text-xs text-foreground focus:outline-none placeholder:text-muted-foreground/60 font-mono"
                    />
                    <button
                      type="submit"
                      disabled={!ragQuery.trim() || isRagLoading}
                      className="px-4 bg-primary text-primary-foreground border border-primary hover:bg-primary-foreground hover:text-primary rounded text-xs font-bold transition-all flex items-center gap-1.5"
                    >
                      {isRagLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      QUERY
                    </button>
                  </form>

                  {/* Sources retrieved and answers rendered */}
                  {isRagLoading && (
                    <div className="p-4 bg-card/90 border border-secondary/20 rounded flex items-center gap-3 text-xs text-muted-foreground">
                      <RefreshCw className="w-4 h-4 animate-spin text-secondary" />
                      <span>Retrieving chunks, running cosine calculations, synthesizing prompt...</span>
                    </div>
                  )}

                  {ragAnswer && (
                    <div className="space-y-3 font-mono">
                      <div className="p-4 bg-card border border-border rounded text-xs leading-relaxed text-foreground whitespace-pre-wrap select-text">
                        <span className="font-bold text-secondary block border-b border-border pb-1.5 mb-2 uppercase">Synthesized Answer:</span>
                        {ragAnswer}
                      </div>

                      {ragSources.length > 0 && (
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase">Retrieved Citations:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {ragSources.map((src, i) => (
                              <span key={i} className="text-[9px] bg-secondary/10 border border-secondary/35 text-secondary px-2 py-0.5 rounded">
                                [{i + 1}] {src.title}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* TAB 3: Compiled Generated Study Sets */}
            {activeTab === 'generate' && (
              <motion.div
                key="generate-tab"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {!generatedResult ? (
                  <div className="flex flex-col items-center justify-center p-8 border border-dashed border-border rounded-lg text-center text-muted-foreground font-mono space-y-2 h-[300px]">
                    <Sparkles className="w-8 h-8 text-primary animate-pulse" />
                    <h3 className="text-xs font-bold text-foreground uppercase">Synchronizer Sandbox Idle</h3>
                    <p className="text-[11px] max-w-xs text-muted-foreground">
                      Select documents on the left, choose a compilation type (Guide, Flashcards, or Quiz), and click "Compile Study Set".
                    </p>
                  </div>
                ) : generatedResult.error ? (
                  <div className="p-4 bg-destructive/10 border border-destructive/30 rounded font-mono text-xs text-destructive flex items-start gap-2">
                    <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block uppercase mb-1">Compilation Failure</span>
                      {generatedResult.error}
                    </div>
                  </div>
                ) : (
                  <div className="border border-border rounded-lg bg-card/45 p-4 font-mono space-y-4">
                    <div className="border-b border-border pb-2 flex justify-between items-center text-xs">
                      <span className="font-bold text-secondary uppercase flex items-center gap-1.5">
                        <BookOpenCheck className="w-4 h-4" />
                        Compilation Output: {generatedResult.kind}
                      </span>
                      <button
                        onClick={() => setGeneratedResult(null)}
                        className="text-[10px] text-muted-foreground hover:text-foreground"
                      >
                        RESET SANDBOX
                      </button>
                    </div>

                    {/* GUIDE RESULT */}
                    {generatedResult.kind === 'guide' && (
                      <div className="p-4 bg-card border border-border rounded text-xs leading-relaxed text-foreground whitespace-pre-wrap select-text max-h-[450px] overflow-y-auto">
                        {generatedResult.markdown}
                      </div>
                    )}

                    {/* FLASHCARDS RESULT */}
                    {generatedResult.kind === 'flashcards' && generatedResult.items && (
                      <div className="flex flex-col items-center py-6 space-y-6">
                        {/* Interactive Card Flip */}
                        <div 
                          onClick={() => setIsCardFlipped(!isCardFlipped)}
                          className="w-[320px] h-[180px] cursor-pointer perspective bg-card border border-secondary/35 rounded-xl flex flex-col items-center justify-center p-6 text-center shadow-lg transition-all hover:shadow-secondary/15 hover:border-secondary"
                        >
                          <AnimatePresence mode="wait">
                            {!isCardFlipped ? (
                              <motion.div
                                key="front"
                                initial={{ rotateY: -90, opacity: 0 }}
                                animate={{ rotateY: 0, opacity: 1 }}
                                exit={{ rotateY: 90, opacity: 0 }}
                                className="space-y-3"
                              >
                                <span className="text-[10px] font-bold text-secondary uppercase tracking-wider block">Question // Front</span>
                                <p className="text-xs font-bold leading-normal text-foreground">
                                  {generatedResult.items[activeCardIndex]?.question}
                                </p>
                                <span className="text-[9px] text-muted-foreground block animate-pulse">Click to Reveal Answer</span>
                              </motion.div>
                            ) : (
                              <motion.div
                                key="back"
                                initial={{ rotateY: -90, opacity: 0 }}
                                animate={{ rotateY: 0, opacity: 1 }}
                                exit={{ rotateY: 90, opacity: 0 }}
                                className="space-y-3"
                              >
                                <span className="text-[10px] font-bold text-primary uppercase tracking-wider block">Response // Back</span>
                                <p className="text-xs text-foreground leading-normal font-medium">
                                  {generatedResult.items[activeCardIndex]?.answer}
                                </p>
                                <span className="text-[9px] text-muted-foreground block animate-pulse">Click to Flip Back</span>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* Controls */}
                        <div className="flex items-center gap-4 text-xs">
                          <button
                            onClick={() => {
                              setIsCardFlipped(false);
                              setActiveCardIndex(prev => Math.max(0, prev - 1));
                            }}
                            disabled={activeCardIndex === 0}
                            className="px-3 py-1 bg-muted hover:bg-accent border border-border text-foreground rounded disabled:opacity-40"
                          >
                            PREVIOUS
                          </button>
                          <span>{activeCardIndex + 1} / {generatedResult.items.length}</span>
                          <button
                            onClick={() => {
                              setIsCardFlipped(false);
                              setActiveCardIndex(prev => Math.min(generatedResult.items.length - 1, prev + 1));
                            }}
                            disabled={activeCardIndex === generatedResult.items.length - 1}
                            className="px-3 py-1 bg-muted hover:bg-accent border border-border text-foreground rounded disabled:opacity-40"
                          >
                            NEXT
                          </button>
                        </div>
                      </div>
                    )}

                    {/* QUIZ RESULT */}
                    {generatedResult.kind === 'quiz' && generatedResult.items && (
                      <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                        {generatedResult.items.map((item: any, qIdx: number) => (
                          <div key={qIdx} className="p-3 bg-card border border-border rounded-lg space-y-2">
                            <p className="text-xs font-bold text-foreground">
                              {qIdx + 1}. {item.question}
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                              {item.options.map((opt: string, oIdx: number) => {
                                const isSelected = quizAnswers[qIdx] === oIdx;
                                const isCorrect = item.answer_index === oIdx;
                                return (
                                  <button
                                    key={oIdx}
                                    onClick={() => handleQuizSelectAnswer(qIdx, oIdx)}
                                    className={`p-2 rounded text-left border transition-all ${
                                      quizSubmitted
                                        ? isCorrect
                                          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                                          : isSelected
                                          ? 'border-destructive bg-destructive/10 text-destructive'
                                          : 'border-border bg-muted/40 text-muted-foreground'
                                        : isSelected
                                        ? 'border-secondary bg-secondary/5 text-foreground'
                                        : 'border-border hover:border-muted-foreground bg-card'
                                    }`}
                                  >
                                    <span className="font-bold mr-1.5">{['A', 'B', 'C', 'D'][oIdx]}.</span>
                                    {opt}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}

                        {/* Submit Actions */}
                        <div className="border-t border-border pt-4 flex items-center justify-between">
                          {!quizSubmitted ? (
                            <button
                              onClick={() => setQuizSubmitted(true)}
                              className="px-5 py-2 bg-primary text-primary-foreground font-bold text-xs uppercase border border-primary hover:bg-primary-foreground hover:text-primary rounded-lg transition-all shadow-md shadow-primary/25"
                            >
                              SUBMIT ANSWERS
                            </button>
                          ) : (
                            <div className="flex items-center gap-4 text-xs">
                              <span className="font-bold text-secondary flex items-center gap-1">
                                <CheckCircle2 className="w-4 h-4" />
                                SCORE: {getQuizCorrectCount()} / {generatedResult.items.length} ({Math.round(getQuizCorrectCount() / generatedResult.items.length * 100)}%)
                              </span>
                              <button
                                onClick={() => {
                                  setQuizAnswers({});
                                  setQuizSubmitted(false);
                                }}
                                className="px-3 py-1 border border-border bg-muted hover:bg-accent rounded text-[10px]"
                              >
                                RETAKE QUIZ
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
