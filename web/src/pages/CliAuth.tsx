import { useEffect, useState } from 'react';
import { useAuthStore } from '../api';
import { Link } from 'react-router-dom';

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
      <div className="min-h-screen bg-transparent relative flex flex-col items-center justify-center p-4 font-sans text-white overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-red-500/5 rounded-full blur-[100px] -z-10 pointer-events-none" />
        <div className="glass-panel p-8 rounded-2xl text-center max-w-sm animate-fade-in-up">
          <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4 border border-red-500/20">
            <span className="text-red-500 text-xl font-bold">!</span>
          </div>
          <h2 className="text-xl font-bold mb-2">Authentication Required</h2>
          <p className="text-textMuted text-sm mb-6 leading-relaxed">You must be logged in to access the CLI authentication token.</p>
          <Link to="/login" className="inline-flex items-center justify-center w-full bg-brand text-background font-bold text-sm py-3 rounded-lg hover:bg-brand-hover transition-colors">
            Log In Now
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent relative flex flex-col items-center justify-center p-4 font-sans text-white overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-brand/5 rounded-full blur-[100px] -z-10 pointer-events-none" />

      <div className="w-full max-w-md text-center relative z-10 animate-fade-in-up">
        <div className="inline-flex items-center gap-1 mb-6">
          <span className="text-brand font-mono text-2xl font-bold text-glow">pipe</span>
          <span className="text-white font-mono text-2xl font-bold">log</span>
          <span className="text-brand font-mono text-2xl animate-pulse-slow">_</span>
        </div>

        <div className="glass-panel p-8 rounded-2xl border-brand/20 box-glow relative overflow-hidden">
          {/* Inner glow effect */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-brand to-transparent opacity-50" />
          
          <h1 className="text-white text-xl font-bold mb-2">CLI Authentication</h1>
          <p className="text-textMuted text-sm mb-8">Copy this token and paste it in your terminal to complete the sign-in process.</p>

          <div className="bg-[#0a0a0a] border border-border rounded-xl p-5 mb-6 text-left relative group">
            <p className="text-textMuted text-[10px] font-semibold uppercase tracking-widest mb-3">Your Auth Token</p>
            <code className="block text-brand text-sm break-all font-mono leading-relaxed select-all">
              {token}
            </code>
          </div>

          <button
            onClick={copy}
            className={`w-full font-bold text-sm py-3.5 rounded-lg transition-all flex justify-center items-center gap-2 ${
              copied 
                ? 'bg-surface text-brand border border-brand/50 shadow-[0_0_15px_rgba(0,255,136,0.2)]' 
                : 'bg-brand text-background hover:bg-brand-hover hover:box-glow'
            }`}
          >
            {copied ? (
              <>
                <span className="text-lg">✓</span> Copied to clipboard
              </>
            ) : (
              'Copy Token'
            )}
          </button>
        </div>

        <p className="text-textMuted text-xs mt-8 font-medium">
          Paste in your terminal when prompted by <code className="bg-surface border border-border px-1.5 py-0.5 rounded text-brand font-mono ml-1">pipelog auth login</code>
        </p>
      </div>
    </div>
  );
}
