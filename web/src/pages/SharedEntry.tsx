import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { api, type Entry } from '../api';

export function SharedEntry() {
  const { token } = useParams<{ token: string }>();
  const [entry, setEntry] = useState<Entry | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.get<Entry>(`/s/${token}`)
      .then(r => setEntry(r.data))
      .catch(() => setError(true));
  }, [token]);

  if (error) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center font-sans text-white relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-red-500/5 rounded-full blur-[100px] -z-10 pointer-events-none" />
        <div className="text-center animate-fade-in-up">
          <p className="text-red-500/80 font-mono text-6xl font-bold mb-4 text-glow">404</p>
          <p className="text-textMuted text-lg">Entry not found or no longer shared.</p>
        </div>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="min-h-screen bg-transparent flex flex-col items-center justify-center font-sans text-white relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-brand/5 rounded-full blur-[100px] -z-10 pointer-events-none" />
        <div className="w-8 h-8 rounded-full border-2 border-brand/20 border-t-brand animate-spin mb-4" />
        <p className="text-textMuted font-mono text-sm animate-pulse">loading stream...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent text-white font-sans flex flex-col">
      {/* Background glow */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand/5 rounded-full blur-[100px] -z-10 pointer-events-none" />

      {/* Sticky Header */}
      <header className="border-b border-border/50 bg-background/50 backdrop-blur-md sticky top-0 z-50 px-4 md:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className="text-brand font-mono font-bold text-lg text-glow">pipe</span>
          <span className="text-white font-mono font-bold text-lg">log</span>
          <span className="text-brand font-mono text-lg">_</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-brand animate-pulse" />
          <span className="text-textMuted text-xs font-mono uppercase tracking-widest">Shared Session</span>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-6 lg:p-8 animate-fade-in">
        {/* Meta Header */}
        <div className="mb-8">
          <h1 className="text-white text-2xl md:text-3xl font-bold mb-2 tracking-tight">
            {entry.title ?? entry.command ?? 'Untitled Event'}
          </h1>
          
          {entry.command && entry.title && (
            <div className="inline-block bg-surface/50 border border-border/50 px-3 py-1.5 rounded-md mb-4 font-mono text-sm">
              <span className="text-textMuted mr-2">$</span>
              <span className="text-brand/90">{entry.command}</span>
            </div>
          )}
          
          <div className="flex items-center gap-2 md:gap-3 flex-wrap">
            {entry.exit_code !== undefined && entry.exit_code !== null && (
              <span className={`text-xs font-mono font-bold px-2.5 py-1 rounded-md border ${
                entry.exit_code === 0 
                  ? 'text-brand border-brand/30 bg-brand/10' 
                  : 'text-red-400 border-red-500/30 bg-red-500/10'
              }`}>
                exit {entry.exit_code}
              </span>
            )}
            
            {entry.tags?.map(tag => (
              <span key={tag} className="text-xs text-brand border border-brand/20 bg-brand/5 px-2.5 py-1 rounded-md">
                {tag}
              </span>
            ))}
            
            <div className="flex items-center gap-2 ml-auto text-textMuted text-sm font-medium">
              {entry.author_name && (
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-surface border border-border flex items-center justify-center text-[8px] text-white">
                    {entry.author_name.charAt(0).toUpperCase()}
                  </span>
                  {entry.author_name}
                </span>
              )}
              {entry.author_name && <span className="opacity-30">•</span>}
              <span>
                {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
              </span>
            </div>
          </div>
        </div>

        {/* Terminal Output */}
        <div className="rounded-xl border border-border bg-surface/80 overflow-hidden shadow-2xl relative">
           {/* Terminal Header */}
           <div className="absolute top-0 left-0 w-full h-10 bg-[#111] border-b border-border/50 flex items-center px-4 z-10">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-[#ff5f56]"></div>
                <div className="w-3 h-3 rounded-full bg-[#ffbd2e]"></div>
                <div className="w-3 h-3 rounded-full bg-[#27c93f]"></div>
              </div>
              <div className="absolute left-1/2 -translate-x-1/2 text-[10px] text-textMuted font-mono">
                pipelog — {entry.id?.substring(0, 8) || 'shared'}
              </div>
           </div>
           
           {/* Log Content */}
          <div className="p-6 pt-16 overflow-auto max-h-[70vh] custom-scrollbar bg-[#050505]">
            <pre className="text-[#d4d4d4] text-sm font-mono leading-relaxed whitespace-pre-wrap break-all">
              {entry.output}
            </pre>
          </div>
        </div>

        <div className="text-center mt-12 mb-8">
          <p className="text-textMuted text-sm">
            Powered by <a href="/" className="text-brand hover:underline font-mono ml-1">pipelog</a>
          </p>
        </div>
      </main>
    </div>
  );
}
