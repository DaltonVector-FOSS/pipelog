import { useEffect, useState } from 'react';
import { useAuthStore } from '../api';

export function CliAuth() {
  const token = useAuthStore(s => s.token);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!token) return;
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center p-4" style={{ fontFamily: 'monospace' }}>
        <div className="text-center max-w-sm">
          <p className="text-white text-sm mb-4">You need to log in first.</p>
          <a href="/login" className="text-[#00ff88] text-sm hover:underline">→ Go to login</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center p-4" style={{ fontFamily: 'monospace' }}>
      <div className="w-full max-w-md text-center">
        <div className="inline-flex items-center gap-1 mb-8">
          <span className="text-[#00ff88] font-bold text-xl">pipe</span>
          <span className="text-white font-bold text-xl">log</span>
          <span className="text-[#00ff88] font-bold text-xl">_</span>
        </div>

        <h1 className="text-white text-sm font-bold mb-2">CLI Authentication</h1>
        <p className="text-[#444] text-xs mb-6">Copy this token and paste it in your terminal</p>

        <div className="bg-[#0f0f0f] border border-[#222] rounded p-4 mb-4 text-left">
          <p className="text-[#333] text-[10px] uppercase tracking-widest mb-2">your auth token</p>
          <code className="text-[#00ff88] text-xs break-all">{token}</code>
        </div>

        <button
          onClick={copy}
          className="w-full bg-[#00ff88] text-black font-bold text-sm py-3 rounded hover:bg-[#00e87a] transition-colors"
        >
          {copied ? '✓ Copied!' : 'Copy Token'}
        </button>

        <p className="text-[#222] text-xs mt-6">
          Paste in your terminal when prompted by <code className="text-[#333]">pipelog auth login</code>
        </p>
      </div>
    </div>
  );
}
