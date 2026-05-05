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
      <div className="min-h-screen bg-[#080808] flex items-center justify-center" style={{ fontFamily: 'monospace' }}>
        <div className="text-center">
          <p className="text-[#333] text-4xl mb-3">404</p>
          <p className="text-[#444] text-sm">Entry not found or no longer shared</p>
        </div>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center" style={{ fontFamily: 'monospace' }}>
        <p className="text-[#333] text-sm">loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080808] text-white" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
      {/* Header */}
      <header className="border-b border-[#1a1a1a] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className="text-[#00ff88] font-bold">pipe</span>
          <span className="text-white font-bold">log</span>
          <span className="text-[#00ff88] font-bold">_</span>
        </div>
        <span className="text-[#333] text-xs">shared output</span>
      </header>

      <div className="max-w-4xl mx-auto p-6">
        {/* Meta */}
        <div className="mb-6">
          <h1 className="text-white text-lg font-bold mb-1">
            {entry.title ?? entry.command ?? 'untitled'}
          </h1>
          {entry.command && entry.title && (
            <code className="text-[#00ff88] text-sm">$ {entry.command}</code>
          )}
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            {entry.tags?.map(tag => (
              <span key={tag} className="text-[10px] text-[#00ff88] border border-[#1a3a25] bg-[#0a1f15] px-2 py-0.5 rounded">
                {tag}
              </span>
            ))}
            {entry.exit_code !== undefined && entry.exit_code !== null && (
              <span className={`text-[10px] px-2 py-0.5 rounded border ${entry.exit_code === 0 ? 'text-[#00ff88] border-[#1a3a25]' : 'text-red-400 border-red-900'}`}>
                exit {entry.exit_code}
              </span>
            )}
            {entry.author_name && (
              <span className="text-[#333] text-xs">by {entry.author_name}</span>
            )}
            <span className="text-[#333] text-xs">
              {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
            </span>
          </div>
        </div>

        {/* Output */}
        <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-6 overflow-auto">
          <pre className="text-[#d4d4d4] text-xs leading-relaxed whitespace-pre-wrap break-all">
            {entry.output}
          </pre>
        </div>

        <p className="text-[#222] text-xs text-center mt-8">
          shared via <span className="text-[#333]">pipelog</span>
        </p>
      </div>
    </div>
  );
}
