import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

const INSTALL_UNIX =
  'curl -fsSL https://raw.githubusercontent.com/DaltonVector-FOSS/pipelog/main/scripts/install.sh | bash';

const INSTALL_WINDOWS_PS51 = `powershell -NoProfile -ExecutionPolicy Bypass -Command "iex ((Invoke-WebRequest -UseBasicParsing 'https://raw.githubusercontent.com/DaltonVector-FOSS/pipelog/main/scripts/install.ps1').Content)"`;

const INSTALL_WINDOWS_PS7 =
  'irm https://raw.githubusercontent.com/DaltonVector-FOSS/pipelog/main/scripts/install.ps1 | iex';

const CMD_AUTH_LOGIN = 'pipelog auth login';

const CMD_FIRST_CAPTURE = 'echo "hello world" | pipelog --title "First run" -t demo';

const CMD_DASHBOARD = 'pipelog dashboard';

const getStartedSteps = [
  {
    title: 'Create an account',
    body: 'Use the web app to register. You will use the same account when you sign in from the CLI.',
    href: '/register' as const,
    cta: 'Register',
  },
  {
    title: 'Install the CLI',
    body: 'Choose your OS in the next section and run the installer one-liner, or build from source with Rust.',
  },
  {
    title: 'Sign in from your terminal',
    body: 'This opens a browser flow to connect the CLI to your account.',
    command: CMD_AUTH_LOGIN,
  },
  {
    title: 'Capture command output',
    body: 'Pipe stdout/stderr into pipelog. Add a title and tags so you can search later.',
    command: CMD_FIRST_CAPTURE,
  },
  {
    title: 'Open your dashboard',
    body: 'View entries in the browser or list them with pipelog list.',
    command: CMD_DASHBOARD,
  },
];

const features = [
  {
    title: 'Capture Instantly',
    description: 'Collect logs in one place without wrestling with scattered terminals.',
  },
  {
    title: 'Search Faster',
    description: 'Filter and find the exact event stream when incidents are still hot.',
  },
  {
    title: 'Share Securely',
    description: 'Create time-scoped shared views so teammates can replay context quickly.',
  },
];

const steps = [
  {
    title: '1. Connect Sources',
    description: 'Point your app or CLI output to PipeLog in minutes.',
  },
  {
    title: '2. Trace the Signal',
    description: 'Follow event flow with a terminal-native, low-noise interface.',
  },
  {
    title: '3. Resolve Together',
    description: 'Share focused slices of logs with your team and close incidents faster.',
  },
];

const faqs = [
  {
    question: 'Who is PipeLog built for?',
    answer: 'PipeLog is built for engineering teams who need fast, reliable debugging context.',
  },
  {
    question: 'Do I need to change my whole logging stack?',
    answer: 'No. Start by piping selected streams and expand gradually as your team adopts it.',
  },
  {
    question: 'Can I share logs outside my team?',
    answer: 'Yes, with controlled shared links so recipients can replay the relevant context.',
  },
  {
    question: 'Is this suitable for local development?',
    answer: 'Yes. PipeLog works for local workflows and production debugging handoffs.',
  },
];

function CopyInstallButton({ text }: { text: string }) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    },
    [],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus('copied');
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setStatus('idle'), 2000);
    } catch {
      setStatus('error');
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setStatus('idle'), 2500);
    }
  };

  const label =
    status === 'copied' ? 'Copied' : status === 'error' ? 'Failed' : 'Copy';

  return (
    <button
      type="button"
      onClick={copy}
      className="shrink-0 rounded border border-[#2a2a2a] bg-[#141414] px-2.5 py-1 text-[10px] font-mono font-semibold uppercase tracking-wide text-[#9a9a9a] hover:border-[#00ff88] hover:text-[#00ff88] transition-colors"
      aria-label={
        status === 'copied' ? 'Copied to clipboard' : 'Copy install command to clipboard'
      }
    >
      {label}
    </button>
  );
}

export function Landing() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <header className="border-b border-[#1a1a1a]">
        <div className="mx-auto max-w-6xl px-4 py-5 flex items-center justify-between">
          <div className="inline-flex items-center gap-2">
            <span className="text-[#00ff88] font-mono text-2xl font-bold">pipe</span>
            <span className="text-white font-mono text-2xl font-bold">log</span>
            <span className="text-[#00ff88] font-mono text-2xl">_</span>
          </div>
          <div className="flex items-center gap-3">
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

      <main className="mx-auto max-w-6xl px-4 py-16 md:py-24">
        <section className="text-center max-w-3xl mx-auto">
          <p className="text-[#00ff88] font-mono text-xs uppercase tracking-[0.25em] mb-4">
            capture. share. replay.
          </p>
          <h1 className="text-4xl md:text-6xl font-mono font-bold leading-tight">
            Logs that move as fast as your incident response
          </h1>
          <p className="mt-6 text-[#a0a0a0] font-mono text-sm md:text-base leading-relaxed">
            PipeLog helps teams collect, inspect, and share operational logs without context loss.
            Stay focused on fixing issues, not hunting through scattered output.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="#get-started"
              className="bg-[#00ff88] text-black font-mono font-bold text-sm px-6 py-3 rounded hover:bg-[#00e87a] transition-colors text-center"
            >
              get started
            </a>
            <Link
              to="/login"
              className="border border-[#2a2a2a] text-white font-mono font-semibold text-sm px-6 py-3 rounded hover:border-[#00ff88] hover:text-[#00ff88] transition-colors"
            >
              sign in
            </Link>
          </div>
        </section>

        <section id="get-started" className="mt-16 max-w-3xl mx-auto scroll-mt-20">
          <h2 className="text-xl font-mono font-bold text-center">Get started</h2>
          <p className="mt-4 text-center text-sm font-mono text-[#9a9a9a] leading-relaxed">
            From zero to your first captured log in a few steps.
          </p>
          <ol className="mt-10 space-y-5 list-none p-0 m-0">
            {getStartedSteps.map((step, index) => (
              <li key={step.title}>
                <article className="rounded border border-[#1e1e1e] bg-[#0d0d0d] p-5">
                  <div className="flex flex-wrap items-start gap-3">
                    <span className="flex h-8 min-w-8 shrink-0 items-center justify-center rounded bg-[#00ff88]/15 font-mono text-sm font-bold text-[#00ff88]">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-mono text-base font-semibold text-white">{step.title}</h3>
                      <p className="mt-2 text-sm font-mono text-[#9a9a9a] leading-relaxed">{step.body}</p>
                      {'command' in step && step.command ? (
                        <div className="mt-3 relative rounded border border-[#1a1a1a] bg-[#080808]">
                          <div className="absolute top-2 right-2 z-10">
                            <CopyInstallButton text={step.command} />
                          </div>
                          <pre className="overflow-x-auto p-3 pr-24 text-[#00ff88] text-xs font-mono whitespace-pre-wrap break-all leading-relaxed">
                            {step.command}
                          </pre>
                        </div>
                      ) : null}
                      {'href' in step && step.href ? (
                        <div className="mt-4">
                          <Link
                            to={step.href}
                            className="inline-flex rounded border border-[#00ff88] bg-[#00ff88]/10 px-3 py-1.5 text-xs font-mono font-semibold text-[#00ff88] hover:bg-[#00ff88]/20 transition-colors"
                          >
                            {step.cta}
                          </Link>
                        </div>
                      ) : null}
                      {step.title === 'Install the CLI' ? (
                        <p className="mt-4 text-xs font-mono text-[#666]">
                          <a
                            href="#install-cli"
                            className="text-[#00ff88] underline decoration-[#00ff88]/40 underline-offset-2 hover:decoration-[#00ff88]"
                          >
                            Jump to install commands
                          </a>
                        </p>
                      ) : null}
                    </div>
                  </div>
                </article>
              </li>
            ))}
          </ol>
        </section>

        <section id="install-cli" className="mt-20 max-w-3xl mx-auto scroll-mt-20">
          <h2 className="text-xl font-mono font-bold text-center">Install the CLI</h2>
          <p className="mt-4 text-center text-sm font-mono text-[#9a9a9a] leading-relaxed">
            macOS, Linux, or Windows: run the command for your OS, then{' '}
            <code className="text-[#00ff88]">pipelog auth login</code>.
          </p>
          <div className="mt-8 space-y-6">
            <div className="rounded border border-[#1e1e1e] bg-[#0d0d0d] p-4">
              <h3 className="text-center text-xs font-mono font-semibold text-[#9a9a9a] uppercase tracking-wide">
                macOS &amp; Linux
              </h3>
              <p className="mt-2 text-center text-[10px] font-mono text-[#666]">bash · zsh · any POSIX shell with curl and tar</p>
              <div className="mt-3 relative rounded border border-[#1a1a1a] bg-[#080808]">
                <div className="absolute top-2 right-2 z-10">
                  <CopyInstallButton text={INSTALL_UNIX} />
                </div>
                <pre className="overflow-x-auto p-3 pr-24 text-[#00ff88] text-xs font-mono whitespace-pre-wrap break-all leading-relaxed">
                  {INSTALL_UNIX}
                </pre>
              </div>
            </div>

            <div className="rounded border border-[#1e1e1e] bg-[#0d0d0d] p-4">
              <h3 className="text-center text-xs font-mono font-semibold text-[#9a9a9a] uppercase tracking-wide">
                Windows
              </h3>
              <p className="mt-2 text-center text-[10px] font-mono text-[#666]">
                CMD, Run dialog, or Windows PowerShell 5.1+ (no WSL required). Downloads the MinGW{' '}
                <code className="text-[#9a9a9a]">x86_64-pc-windows-gnu</code> zip from GitHub Releases.
              </p>
              <div className="mt-3 relative rounded border border-[#1a1a1a] bg-[#080808]">
                <div className="absolute top-2 right-2 z-10">
                  <CopyInstallButton text={INSTALL_WINDOWS_PS51} />
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
                <CopyInstallButton text={INSTALL_WINDOWS_PS7} />
              </div>
            </div>
          </div>
        </section>

        <section className="mt-20">
          <h2 className="text-2xl font-mono font-bold text-center">Feature Highlights</h2>
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            {features.map((feature) => (
              <article
                key={feature.title}
                className="rounded border border-[#1e1e1e] bg-[#0d0d0d] p-6 hover:border-[#00ff88] transition-colors"
              >
                <h3 className="font-mono text-lg font-semibold">{feature.title}</h3>
                <p className="mt-3 text-sm font-mono text-[#9a9a9a] leading-relaxed">
                  {feature.description}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-20">
          <h2 className="text-2xl font-mono font-bold text-center">How It Works</h2>
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            {steps.map((step) => (
              <article key={step.title} className="rounded border border-[#1e1e1e] bg-[#0f0f0f] p-6">
                <h3 className="font-mono text-base font-semibold text-[#00ff88]">{step.title}</h3>
                <p className="mt-3 text-sm font-mono text-[#9a9a9a] leading-relaxed">
                  {step.description}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-20 max-w-3xl mx-auto">
          <h2 className="text-2xl font-mono font-bold text-center">FAQ</h2>
          <div className="mt-8 space-y-3">
            {faqs.map((faq, index) => {
              const isOpen = openFaq === index;
              return (
                <article key={faq.question} className="rounded border border-[#1f1f1f] bg-[#0d0d0d]">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    className="w-full px-5 py-4 text-left flex items-center justify-between font-mono text-sm"
                  >
                    <span>{faq.question}</span>
                    <span className="text-[#00ff88]">{isOpen ? '-' : '+'}</span>
                  </button>
                  {isOpen && (
                    <p className="px-5 pb-4 text-sm font-mono text-[#9a9a9a] leading-relaxed">
                      {faq.answer}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        </section>

        <section className="mt-20 rounded border border-[#1f1f1f] bg-[#0d0d0d] p-8 text-center">
          <p className="text-[#00ff88] font-mono text-xs uppercase tracking-[0.25em]">Ready to ship fixes faster?</p>
          <h2 className="mt-4 text-3xl font-mono font-bold">Bring your logs into one focused stream.</h2>
          <p className="mt-4 text-sm font-mono text-[#9a9a9a]">
            Create your account and start with your first pipeline in minutes.
          </p>
          <div className="mt-8 flex justify-center">
            <Link
              to="/register"
              className="bg-[#00ff88] text-black font-mono font-bold text-sm px-6 py-3 rounded hover:bg-[#00e87a] transition-colors"
            >
              create account
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#1a1a1a]">
        <div className="mx-auto max-w-6xl px-4 py-6 text-center text-xs text-[#666] font-mono">
          <span>PipeLog</span>
          <span className="mx-2 text-[#333]">|</span>
          <span>Built for faster incident response</span>
        </div>
      </footer>
    </div>
  );
}
