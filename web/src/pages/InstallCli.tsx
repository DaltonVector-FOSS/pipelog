import { Link } from 'react-router-dom';
import { CopyCommandButton } from '../components/CopyCommandButton';

const INSTALL_UNIX =
  'curl -fsSL https://raw.githubusercontent.com/DaltonVector-FOSS/pipelog/main/scripts/install.sh | bash';

const INSTALL_WINDOWS_PS51 = `powershell -NoProfile -ExecutionPolicy Bypass -Command "iex ((Invoke-WebRequest -UseBasicParsing 'https://raw.githubusercontent.com/DaltonVector-FOSS/pipelog/main/scripts/install.ps1').Content)"`;

const INSTALL_WINDOWS_PS7 =
  'irm https://raw.githubusercontent.com/DaltonVector-FOSS/pipelog/main/scripts/install.ps1 | iex';

function MarketingHeader() {
  return (
    <header className="border-b border-border/50 bg-background/50 backdrop-blur-md sticky top-0 z-50">
      <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between gap-4">
        <Link to="/" className="inline-flex items-center gap-1 hover:opacity-80 transition-opacity">
          <span className="text-brand font-mono text-2xl font-bold text-glow">pipe</span>
          <span className="text-white font-mono text-2xl font-bold">log</span>
          <span className="text-brand font-mono text-2xl">_</span>
        </Link>
        <div className="flex items-center gap-4 sm:gap-6 flex-wrap justify-end">
          <Link
            to="/get-started"
            className="text-textMuted hover:text-brand text-sm font-medium transition-colors"
          >
            Get Started
          </Link>
          <Link to="/install" className="text-brand text-sm font-medium transition-colors">
            Install
          </Link>
          <Link
            to="/login"
            className="text-textMuted hover:text-white text-sm font-medium transition-colors"
          >
            Log In
          </Link>
          <Link
            to="/register"
            className="bg-brand text-background font-bold text-sm px-5 py-2 rounded-md hover:bg-brand-hover transition-all"
          >
            Sign Up
          </Link>
        </div>
      </div>
    </header>
  );
}

function MarketingFooter() {
  return (
    <footer className="border-t border-border/50 bg-surface/30 mt-auto relative z-10">
      <div className="mx-auto max-w-6xl px-4 py-6 flex items-center justify-between text-xs text-textMuted font-medium">
        <div>PipeLog</div>
        <div>Built for faster incident response</div>
      </div>
    </footer>
  );
}

function TerminalBlock({ title, subtitle, command }: { title: string, subtitle: string, command: string }) {
  return (
    <div className="glass-panel p-6 rounded-xl hover:border-brand/30 transition-colors animate-fade-in-up">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-white tracking-wide">
          {title}
        </h2>
        <p className="mt-1 text-sm text-textMuted leading-relaxed">
          {subtitle}
        </p>
      </div>
      <div className="relative rounded-lg border border-border bg-surface/80 overflow-hidden group">
        <div className="absolute top-0 left-0 w-full h-8 bg-[#1a1a1a] flex items-center px-3 border-b border-border/50">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/80"></div>
          </div>
          <div className="absolute right-2 top-1.5 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
            <CopyCommandButton text={command} />
          </div>
        </div>
        <pre className="p-4 pt-12 text-brand text-sm font-mono whitespace-pre-wrap break-all overflow-x-auto">
          <span className="text-textMuted mr-2">$</span>{command}
        </pre>
      </div>
    </div>
  );
}

export function InstallCli() {
  return (
    <div className="min-h-screen bg-transparent relative flex flex-col text-white font-sans">
      <div className="absolute top-1/4 left-0 w-[500px] h-[500px] bg-brand/5 rounded-full blur-[100px] -z-10 pointer-events-none" />

      <MarketingHeader />

      <main className="mx-auto max-w-4xl w-full px-4 py-16 md:py-24 flex-1 relative z-10 animate-fade-in">
        <div className="text-center mb-16">
          <div className="inline-block px-3 py-1 rounded-full border border-brand/30 bg-brand/5 text-brand font-mono text-xs uppercase tracking-widest mb-4">
            CLI
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Install PipeLog</h1>
          <p className="mt-4 text-textMuted text-lg leading-relaxed max-w-2xl mx-auto">
            macOS, Linux, or Windows: run the command for your OS, then{' '}
            <code className="bg-surface px-1.5 py-0.5 rounded text-brand font-mono text-sm border border-border">pipelog auth login</code>. 
            Need the full walkthrough? See the{' '}
            <Link
              to="/get-started"
              className="text-brand hover:text-brand-hover hover:underline underline-offset-4 font-medium transition-colors"
            >
              setup guide
            </Link>.
          </p>
        </div>

        <div className="max-w-3xl mx-auto space-y-8">
          <TerminalBlock 
            title="macOS & Linux" 
            subtitle="bash · zsh · any POSIX shell with curl and tar" 
            command={INSTALL_UNIX} 
          />

          <TerminalBlock 
            title="Windows (PowerShell 5.1+)" 
            subtitle="CMD, Run dialog, or Windows PowerShell 5.1+ (no WSL required)." 
            command={INSTALL_WINDOWS_PS51} 
          />
          
          <div className="glass-panel p-6 rounded-xl border-border/50">
             <h3 className="text-sm font-medium text-textMuted mb-3">PowerShell 7+ (Optional):</h3>
             <div className="flex flex-col sm:flex-row items-center gap-3">
               <code className="flex-1 bg-surface/80 p-3 rounded-md border border-border font-mono text-brand text-xs break-all block w-full">
                 {INSTALL_WINDOWS_PS7}
               </code>
               <div className="w-full sm:w-auto flex justify-end">
                 <CopyCommandButton text={INSTALL_WINDOWS_PS7} />
               </div>
             </div>
          </div>
        </div>

        <div className="mt-16 text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-textMuted hover:text-white transition-colors border border-border/50 bg-surface/30 px-5 py-2.5 rounded-full hover:bg-surface"
          >
            ← Back to Home
          </Link>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
