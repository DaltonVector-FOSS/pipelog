import { Link } from 'react-router-dom';
import { CopyCommandButton } from '../components/CopyCommandButton';

const INSTALL_UNIX =
  'curl -fsSL https://raw.githubusercontent.com/DaltonVector-FOSS/pipelog/main/scripts/install.sh | bash';

const INSTALL_WINDOWS_PS51 = `powershell -NoProfile -ExecutionPolicy Bypass -Command "iex ((Invoke-WebRequest -UseBasicParsing 'https://raw.githubusercontent.com/DaltonVector-FOSS/pipelog/main/scripts/install.ps1').Content)"`;

const INSTALL_WINDOWS_PS7 =
  'irm https://raw.githubusercontent.com/DaltonVector-FOSS/pipelog/main/scripts/install.ps1 | iex';

function MarketingHeader() {
  return (
    <header className="border-b border-[#1a1a1a]">
      <div className="mx-auto max-w-6xl px-4 py-5 flex items-center justify-between gap-4">
        <Link to="/" className="inline-flex items-center gap-2 hover:opacity-90 transition-opacity">
          <span className="text-[#00ff88] font-mono text-2xl font-bold">pipe</span>
          <span className="text-white font-mono text-2xl font-bold">log</span>
          <span className="text-[#00ff88] font-mono text-2xl">_</span>
        </Link>
        <div className="flex items-center gap-3 sm:gap-4 flex-wrap justify-end">
          <Link
            to="/get-started"
            className="text-[#9a9a9a] hover:text-[#00ff88] text-sm font-mono transition-colors"
          >
            get started
          </Link>
          <Link to="/install" className="text-[#00ff88] text-sm font-mono font-semibold">
            install
          </Link>
          <Link
            to="/login"
            className="text-[#9a9a9a] hover:text-white text-sm font-mono transition-colors"
          >
            login
          </Link>
          <Link
            to="/register"
            className="bg-[#00ff88] text-black font-mono font-bold text-sm px-4 py-2 rounded hover:bg-[#00e87a] transition-colors"
          >
            create account
          </Link>
        </div>
      </div>
    </header>
  );
}

function MarketingFooter() {
  return (
    <footer className="border-t border-[#1a1a1a] mt-auto">
      <div className="mx-auto max-w-6xl px-4 py-6 text-center text-xs text-[#666] font-mono">
        <span>PipeLog</span>
        <span className="mx-2 text-[#333]">|</span>
        <span>Built for faster incident response</span>
      </div>
    </footer>
  );
}

export function InstallCli() {
  return (
    <div className="min-h-screen bg-[#080808] text-white flex flex-col">
      <MarketingHeader />

      <main className="mx-auto max-w-6xl w-full px-4 py-12 md:py-20 flex-1">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-[#00ff88] font-mono text-xs uppercase tracking-[0.25em]">cli</p>
          <h1 className="mt-3 text-3xl md:text-4xl font-mono font-bold leading-tight">Install the CLI</h1>
          <p className="mt-4 text-sm font-mono text-[#9a9a9a] leading-relaxed">
            macOS, Linux, or Windows: run the command for your OS, then{' '}
            <code className="text-[#00ff88]">pipelog auth login</code>. Need the full walkthrough? See the{' '}
            <Link
              to="/get-started"
              className="text-[#00ff88] underline decoration-[#00ff88]/40 underline-offset-2 hover:decoration-[#00ff88]"
            >
              setup guide
            </Link>
            .
          </p>
        </div>

        <div className="mt-12 max-w-3xl mx-auto space-y-6">
          <div className="rounded border border-[#1e1e1e] bg-[#0d0d0d] p-4">
            <h2 className="text-center text-xs font-mono font-semibold text-[#9a9a9a] uppercase tracking-wide">
              macOS &amp; Linux
            </h2>
            <p className="mt-2 text-center text-[10px] font-mono text-[#666]">
              bash · zsh · any POSIX shell with curl and tar
            </p>
            <div className="mt-3 relative rounded border border-[#1a1a1a] bg-[#080808]">
              <div className="absolute top-2 right-2 z-10">
                <CopyCommandButton text={INSTALL_UNIX} />
              </div>
              <pre className="overflow-x-auto p-3 pr-24 text-[#00ff88] text-xs font-mono whitespace-pre-wrap break-all leading-relaxed">
                {INSTALL_UNIX}
              </pre>
            </div>
          </div>

          <div className="rounded border border-[#1e1e1e] bg-[#0d0d0d] p-4">
            <h2 className="text-center text-xs font-mono font-semibold text-[#9a9a9a] uppercase tracking-wide">
              Windows
            </h2>
            <p className="mt-2 text-center text-[10px] font-mono text-[#666]">
              CMD, Run dialog, or Windows PowerShell 5.1+ (no WSL required). Downloads the MinGW{' '}
              <code className="text-[#9a9a9a]">x86_64-pc-windows-gnu</code> zip from GitHub Releases.
            </p>
            <div className="mt-3 relative rounded border border-[#1a1a1a] bg-[#080808]">
              <div className="absolute top-2 right-2 z-10">
                <CopyCommandButton text={INSTALL_WINDOWS_PS51} />
              </div>
              <pre className="overflow-x-auto p-3 pr-24 text-[#00ff88] text-xs font-mono whitespace-pre-wrap break-all leading-relaxed">
                {INSTALL_WINDOWS_PS51}
              </pre>
            </div>
            <div className="mt-3 flex flex-col items-center gap-2 text-center text-[10px] font-mono text-[#666] leading-relaxed sm:flex-row sm:justify-center sm:gap-3">
              <span>
                PowerShell 7+ (optional):{' '}
                <code className="text-[#9a9a9a] break-all">{INSTALL_WINDOWS_PS7}</code>
              </span>
              <CopyCommandButton text={INSTALL_WINDOWS_PS7} />
            </div>
          </div>
        </div>

        <p className="mt-12 text-center">
          <Link
            to="/"
            className="text-sm font-mono text-[#9a9a9a] hover:text-[#00ff88] transition-colors"
          >
            ← Back to home
          </Link>
        </p>
      </main>

      <MarketingFooter />
    </div>
  );
}
