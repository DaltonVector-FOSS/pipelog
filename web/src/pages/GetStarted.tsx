import { Link } from 'react-router-dom';
import { CopyCommandButton } from '../components/CopyCommandButton';

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
    body:
      'Open the install page and run the one-liner for your operating system, or build from source with Rust.',
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

export function GetStarted() {
  return (
    <div className="min-h-screen bg-[#080808] text-white flex flex-col">
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
              className="text-[#00ff88] text-sm font-mono font-semibold transition-colors"
            >
              get started
            </Link>
            <Link
              to="/install"
              className="text-[#9a9a9a] hover:text-[#00ff88] text-sm font-mono transition-colors"
            >
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

      <main className="mx-auto max-w-6xl w-full px-4 py-12 md:py-20 flex-1">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-[#00ff88] font-mono text-xs uppercase tracking-[0.25em]">setup guide</p>
          <h1 className="mt-3 text-3xl md:text-4xl font-mono font-bold leading-tight">Get started</h1>
          <p className="mt-4 text-sm font-mono text-[#9a9a9a] leading-relaxed">
            From zero to your first captured log in a few steps.
          </p>
        </div>

        <ol className="mt-12 max-w-3xl mx-auto space-y-5 list-none p-0 m-0">
          {getStartedSteps.map((step, index) => (
            <li key={step.title}>
              <article className="rounded border border-[#1e1e1e] bg-[#0d0d0d] p-5">
                <div className="flex flex-wrap items-start gap-3">
                  <span className="flex h-8 min-w-8 shrink-0 items-center justify-center rounded bg-[#00ff88]/15 font-mono text-sm font-bold text-[#00ff88]">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-mono text-base font-semibold text-white">{step.title}</h2>
                    <p className="mt-2 text-sm font-mono text-[#9a9a9a] leading-relaxed">{step.body}</p>
                    {'command' in step && step.command ? (
                      <div className="mt-3 relative rounded border border-[#1a1a1a] bg-[#080808]">
                        <div className="absolute top-2 right-2 z-10">
                          <CopyCommandButton text={step.command} />
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
                        <Link
                          to="/install"
                          className="text-[#00ff88] underline decoration-[#00ff88]/40 underline-offset-2 hover:decoration-[#00ff88]"
                        >
                          Open install page
                        </Link>
                      </p>
                    ) : null}
                  </div>
                </div>
              </article>
            </li>
          ))}
        </ol>

        <p className="mt-12 text-center">
          <Link
            to="/"
            className="text-sm font-mono text-[#9a9a9a] hover:text-[#00ff88] transition-colors"
          >
            ← Back to home
          </Link>
        </p>
      </main>

      <footer className="border-t border-[#1a1a1a] mt-auto">
        <div className="mx-auto max-w-6xl px-4 py-6 text-center text-xs text-[#666] font-mono">
          <span>PipeLog</span>
          <span className="mx-2 text-[#333]">|</span>
          <span>Built for faster incident response</span>
        </div>
      </footer>
    </div>
  );
}
