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
    <div className="min-h-screen bg-transparent relative flex flex-col text-white font-sans">
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-brand/5 rounded-full blur-[100px] -z-10 pointer-events-none" />

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
              className="text-brand text-sm font-medium transition-colors"
            >
              Get Started
            </Link>
            <Link
              to="/install"
              className="text-textMuted hover:text-brand text-sm font-medium transition-colors"
            >
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

      <main className="mx-auto max-w-4xl w-full px-4 py-16 md:py-24 flex-1 relative z-10 animate-fade-in">
        <div className="text-center mb-16">
          <div className="inline-block px-3 py-1 rounded-full border border-brand/30 bg-brand/5 text-brand font-mono text-xs uppercase tracking-widest mb-4">
            Setup Guide
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">From zero to logs</h1>
          <p className="mt-4 text-textMuted text-lg">
            Follow these steps to start capturing your operational data.
          </p>
        </div>

        <div className="relative border-l border-border/50 ml-4 md:ml-8 pl-8 md:pl-12 space-y-12 pb-8">
          {getStartedSteps.map((step, index) => (
            <div key={step.title} className="relative">
              {/* Step Marker */}
              <div className="absolute -left-[45px] md:-left-[61px] top-0 w-8 h-8 rounded-full bg-surface border border-brand text-brand font-mono flex items-center justify-center font-bold text-sm box-glow z-10">
                {index + 1}
              </div>

              <article className="glass-panel p-6 rounded-xl hover:border-brand/30 transition-colors">
                <h2 className="text-xl font-semibold mb-2">{step.title}</h2>
                <p className="text-textMuted mb-4 leading-relaxed">{step.body}</p>
                
                {'command' in step && step.command ? (
                  <div className="relative rounded-lg border border-border bg-surface/80 overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-8 bg-[#1a1a1a] flex items-center px-3 border-b border-border/50">
                      <div className="flex gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500/80"></div>
                      </div>
                      <div className="absolute right-2 top-1.5 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                        <CopyCommandButton text={step.command} />
                      </div>
                    </div>
                    <pre className="p-4 pt-12 text-brand text-sm font-mono whitespace-pre-wrap break-all overflow-x-auto">
                      <span className="text-textMuted mr-2">$</span>{step.command}
                    </pre>
                  </div>
                ) : null}

                {'href' in step && step.href ? (
                  <Link
                    to={step.href}
                    className="inline-flex items-center gap-2 rounded-md bg-brand text-background px-4 py-2 text-sm font-bold hover:bg-brand-hover hover:box-glow transition-all"
                  >
                    {step.cta} →
                  </Link>
                ) : null}

                {step.title === 'Install the CLI' ? (
                  <Link
                    to="/install"
                    className="inline-block mt-2 text-brand hover:text-brand-hover hover:underline underline-offset-4 text-sm font-medium transition-colors"
                  >
                    View detailed install instructions →
                  </Link>
                ) : null}
              </article>
            </div>
          ))}
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

      <footer className="border-t border-border/50 bg-surface/30 mt-auto relative z-10">
        <div className="mx-auto max-w-6xl px-4 py-6 flex items-center justify-between text-xs text-textMuted font-medium">
          <div>PipeLog</div>
          <div>Built for faster incident response</div>
        </div>
      </footer>
    </div>
  );
}
