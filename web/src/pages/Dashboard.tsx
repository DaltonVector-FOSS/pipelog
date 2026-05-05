import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import { api, useAuthStore, type Entry } from '../api';

function commandBasename(command?: string | null): string | null {
  if (!command) return null;
  const trimmed = command.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(/\s+/);
  if (parts.length === 0) return null;
  const exec = parts[0].split('/').filter(Boolean).pop() ?? parts[0];
  if (!exec) return null;
  const rest = parts.slice(1).join(' ');
  return rest ? `${exec} ${rest}` : exec;
}

export function Dashboard() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [selected, setSelected] = useState<Entry | null>(null);
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [allTags, setAllTags] = useState<string[]>([]);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<Entry[]>('/entries?limit=50');
      setEntries(data);
      const tags = Array.from(new Set(data.flatMap(e => e.tags))).sort();
      setAllTags(tags);
    } catch {
      toast.error('Failed to load entries');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const filteredEntries = useMemo(
    () => (tagFilter ? entries.filter(e => e.tags.includes(tagFilter)) : entries),
    [entries, tagFilter],
  );

  const doSearch = async () => {
    if (!search.trim()) return fetchEntries();
    setLoading(true);
    try {
      const { data } = await api.get<Entry[]>(`/entries/search?q=${encodeURIComponent(search)}`);
      setEntries(data);
      const tags = Array.from(new Set(data.flatMap(e => e.tags))).sort();
      setAllTags(tags);
    } finally {
      setLoading(false);
    }
  };

  const shareEntry = async (entry: Entry) => {
    try {
      const { data } = await api.post<Entry>(`/entries/${entry.id}/share`);
      const url = `${window.location.origin}/s/${data.share_token}`;
      await navigator.clipboard.writeText(url);
      toast.success('Share link copied!');
      setEntries(es => es.map(e => e.id === entry.id ? { ...e, ...data } : e));
      if (selected?.id === entry.id) setSelected({ ...selected, ...data });
    } catch {
      toast.error('Failed to share');
    }
  };

  const deleteEntry = async (id: string) => {
    if (!confirm('Delete this entry?')) return;
    try {
      await api.delete(`/entries/${id}`);
      setEntries(es => es.filter(e => e.id !== id));
      if (selected?.id === id) setSelected(null);
      toast.success('Deleted');
    } catch {
      toast.error('Failed to delete');
    }
  };

  const copyOutputToClipboard = async (output: string) => {
    try {
      await navigator.clipboard.writeText(output);
      toast.success('Output copied');
    } catch {
      toast.error('Could not copy');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#080808] text-white flex flex-col" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}>
      {/* Header */}
      <header className="border-b border-[#1a1a1a] px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-[#00ff88] font-bold text-lg">pipe</span>
          <span className="text-white font-bold text-lg">log</span>
          <span className="text-[#00ff88] text-lg">_</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[#444] text-xs">{user?.email}</span>
          <button onClick={handleLogout} className="text-[#444] hover:text-[#00ff88] text-xs transition-colors">
            logout
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-80 border-r border-[#1a1a1a] flex flex-col overflow-hidden">
          {/* Search */}
          <div className="p-4 border-b border-[#1a1a1a]">
            <div className="flex gap-2">
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && doSearch()}
                placeholder="$ search entries..."
                className="flex-1 bg-[#111] border border-[#222] text-white text-xs px-3 py-2 rounded focus:outline-none focus:border-[#00ff88] placeholder-[#333] transition-colors"
              />
              <button
                onClick={doSearch}
                className="bg-[#111] border border-[#222] text-[#00ff88] px-3 py-2 rounded hover:border-[#00ff88] transition-colors text-xs"
              >
                ⏎
              </button>
            </div>
          </div>

          {/* Tags */}
          {allTags.length > 0 && (
            <div className="p-4 border-b border-[#1a1a1a]">
              <p className="text-[#333] text-xs uppercase tracking-widest mb-2">tags</p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setTagFilter('')}
                  className={`text-xs px-2 py-0.5 rounded border transition-colors ${tagFilter === '' ? 'border-[#00ff88] text-[#00ff88]' : 'border-[#222] text-[#444] hover:border-[#444]'}`}
                >
                  all
                </button>
                {allTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => setTagFilter(tag === tagFilter ? '' : tag)}
                    className={`text-xs px-2 py-0.5 rounded border transition-colors ${tagFilter === tag ? 'border-[#00ff88] text-[#00ff88]' : 'border-[#222] text-[#444] hover:border-[#444]'}`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Entry list */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-6 text-[#333] text-xs text-center">loading...</div>
            ) : entries.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-[#333] text-xs mb-3">no entries yet</p>
                <code className="text-[#00ff88] text-xs bg-[#111] px-3 py-2 rounded block">
                  {"<cmd> | pipelog"}
                </code>
              </div>
            ) : filteredEntries.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-[#333] text-xs">no entries match this tag</p>
              </div>
            ) : (
              filteredEntries.map(entry => (
                <button
                  key={entry.id}
                  onClick={() => setSelected(entry)}
                  className={`w-full text-left px-4 py-3 border-b border-[#111] hover:bg-[#0f0f0f] transition-colors ${selected?.id === entry.id ? 'bg-[#0f0f0f] border-l-2 border-l-[#00ff88]' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-white text-xs font-bold truncate flex-1">
                      {entry.title ?? commandBasename(entry.command) ?? entry.command ?? 'untitled'}
                    </span>
                    {entry.is_public && (
                      <span className="text-[#00ff88] text-[10px] flex-shrink-0">shared</span>
                    )}
                  </div>
                  {entry.tags.length > 0 && (
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {entry.tags.map(tag => (
                        <span key={tag} className="text-[10px] text-[#444] border border-[#1a1a1a] px-1.5 py-0 rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-[#333] text-[10px] mt-1.5">
                    {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                  </p>
                </button>
              ))
            )}
          </div>
        </aside>

        {/* Main panel */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {selected ? (
            <>
              {/* Entry header */}
              <div className="border-b border-[#1a1a1a] px-6 py-4 flex items-start justify-between gap-4 flex-shrink-0">
                <div className="min-w-0">
                  <h1 className="text-white font-bold text-sm truncate">
                    {selected.title ?? commandBasename(selected.command) ?? selected.command ?? 'untitled'}
                  </h1>
                  {selected.command && (
                    <code className="text-[#00ff88] text-xs mt-0.5 block truncate">{selected.command}</code>
                  )}
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    {selected.tags.map(tag => (
                      <span key={tag} className="text-[10px] text-[#00ff88] border border-[#1a3a25] bg-[#0a1f15] px-2 py-0.5 rounded">
                        {tag}
                      </span>
                    ))}
                    {selected.exit_code !== undefined && selected.exit_code !== null && (
                      <span className={`text-[10px] px-2 py-0.5 rounded border ${selected.exit_code === 0 ? 'text-[#00ff88] border-[#1a3a25] bg-[#0a1f15]' : 'text-red-400 border-red-900 bg-red-950/30'}`}>
                        exit {selected.exit_code}
                      </span>
                    )}
                    <span className="text-[#333] text-[10px]">
                      {formatDistanceToNow(new Date(selected.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => copyOutputToClipboard(selected.output)}
                    className="text-xs text-[#444] hover:text-[#00ff88] border border-[#1a1a1a] hover:border-[#00ff88] px-3 py-1.5 rounded transition-colors"
                  >
                    copy output
                  </button>
                  <button
                    type="button"
                    onClick={() => shareEntry(selected)}
                    className="text-xs text-[#444] hover:text-[#00ff88] border border-[#1a1a1a] hover:border-[#00ff88] px-3 py-1.5 rounded transition-colors"
                  >
                    {selected.is_public ? 'copy link' : 'share'}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteEntry(selected.id)}
                    className="text-xs text-[#444] hover:text-red-400 border border-[#1a1a1a] hover:border-red-900 px-3 py-1.5 rounded transition-colors"
                  >
                    delete
                  </button>
                </div>
              </div>

              {/* Output */}
              <div className="flex-1 overflow-auto p-6">
                <pre className="text-[#d4d4d4] text-xs leading-relaxed whitespace-pre-wrap break-all font-mono">
                  {selected.output}
                </pre>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <p className="text-[#222] text-4xl mb-4 font-bold">pipelog</p>
                <p className="text-[#333] text-xs mb-6">select an entry to view its output</p>
                <div className="text-left bg-[#0f0f0f] border border-[#1a1a1a] rounded p-4 max-w-sm">
                  <p className="text-[#444] text-xs mb-3 uppercase tracking-widest">quick start</p>
                  <code className="text-[#00ff88] text-xs block mb-1">$ pipelog auth login</code>
                  <code className="text-[#00ff88] text-xs block mb-1">$ npm run build | pipelog -t deploy</code>
                  <code className="text-[#00ff88] text-xs block">$ kubectl logs pod | pipelog --share</code>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
