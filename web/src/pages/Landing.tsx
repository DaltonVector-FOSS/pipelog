import { useState } from 'react';
import { Link } from 'react-router-dom';

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

export function Landing() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="min-h-screen bg-transparent relative overflow-hidden text-white font-sans">
      {/* Background radial glow */}
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-brand/10 rounded-full blur-[120px] -z-10 pointer-events-none opacity-50" />

      <header className="border-b border-border/50 bg-background/50 backdrop-blur-md sticky top-0 z-50">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between gap-4">
          <Link to="/" className="inline-flex items-center gap-1 hover:opacity-80 transition-opacity">
            <span className="text-brand font-mono text-2xl font-bold text-glow">pipe</span>
            <span className="text-white font-mono text-2xl font-bold">log</span>
            <span className="text-brand font-mono text-2xl animate-pulse-slow">_</span>
          </Link>
          <div className="flex items-center gap-4 sm:gap-6">
            <Link
              to="/get-started"
              className="text-textMuted hover:text-brand text-sm font-medium transition-colors"
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
              className="bg-brand text-background font-bold text-sm px-5 py-2 rounded-md hover:bg-brand-hover hover:box-glow transition-all"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-20 md:py-32 relative z-10">
        <section className="text-center max-w-3xl mx-auto animate-fade-in-up">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-brand/30 bg-brand/5 text-brand font-mono text-[10px] sm:text-xs uppercase tracking-widest mb-8 box-glow">
            <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
            Capture. Share. Replay.
          </div>
          <h1 className="text-5xl md:text-7xl font-bold leading-tight tracking-tight">
            Logs that move as fast as <br className="hidden md:block" />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand to-brand/50">your incident response</span>
          </h1>
          <p className="mt-6 text-textMuted text-lg leading-relaxed max-w-2xl mx-auto">
            PipeLog helps teams collect, inspect, and share operational logs without context loss.
            Stay focused on fixing issues, not hunting through scattered output.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              to="/get-started"
              className="w-full sm:w-auto bg-brand text-background font-bold text-base px-8 py-3.5 rounded-md hover:bg-brand-hover hover:box-glow transition-all"
            >
              Get Started for Free
            </Link>
            <Link
              to="/install"
              className="w-full sm:w-auto glass-panel text-white font-medium text-base px-8 py-3.5 rounded-md hover:text-brand hover:border-brand/50 transition-all flex items-center justify-center gap-2"
            >
              <span className="font-mono text-brand/70">$</span> Install CLI
            </Link>
          </div>
        </section>

        <section className="mt-32">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight">Feature Highlights</h2>
            <p className="text-textMuted mt-3">Everything you need to debug faster.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <article
                key={feature.title}
                className="glass-panel p-8 rounded-xl hover:-translate-y-1 hover:box-glow transition-all duration-300 animate-fade-in-up"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="w-10 h-10 rounded-lg bg-brand/10 flex items-center justify-center mb-5 border border-brand/20">
                   <div className="w-4 h-4 bg-brand rounded-sm shadow-[0_0_10px_#00ff88]" />
                </div>
                <h3 className="text-xl font-semibold">{feature.title}</h3>
                <p className="mt-3 text-textMuted leading-relaxed">
                  {feature.description}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-32 relative">
          {/* Subtle background element */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-[400px] bg-gradient-to-b from-transparent via-brand/5 to-transparent -z-10" />
          
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight">How It Works</h2>
            <p className="text-textMuted mt-3">From chaotic output to shared context in minutes.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {steps.map((step, i) => (
              <article key={step.title} className="glass-panel p-8 rounded-xl relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand/0 via-brand/50 to-brand/0 opacity-0 group-hover:opacity-100 transition-opacity" />
                <h3 className="font-mono text-lg font-semibold text-brand mb-3">{step.title}</h3>
                <p className="text-textMuted leading-relaxed">
                  {step.description}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-32 max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight">Frequently Asked Questions</h2>
          </div>
          <div className="space-y-4">
            {faqs.map((faq, index) => {
              const isOpen = openFaq === index;
              return (
                <article key={faq.question} className="glass-panel rounded-xl overflow-hidden transition-all duration-300">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    className="w-full px-6 py-5 text-left flex items-center justify-between font-medium hover:bg-white/5 transition-colors"
                  >
                    <span className={isOpen ? 'text-brand' : 'text-white'}>{faq.question}</span>
                    <span className={`w-6 h-6 flex items-center justify-center rounded-full border transition-all duration-300 ${isOpen ? 'border-brand text-brand rotate-180' : 'border-border text-textMuted'}`}>
                      ↓
                    </span>
                  </button>
                  <div
                    className={`transition-all duration-300 ease-in-out ${
                      isOpen ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'
                    }`}
                  >
                    <p className="px-6 pb-6 text-textMuted leading-relaxed border-t border-border/50 pt-4">
                      {faq.answer}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mt-32 rounded-2xl glass-panel p-10 md:p-16 text-center relative overflow-hidden border-brand/20 box-glow">
          {/* Inner glow */}
          <div className="absolute inset-0 bg-gradient-to-tr from-brand/10 to-transparent pointer-events-none" />
          
          <div className="relative z-10">
            <p className="text-brand font-mono text-xs uppercase tracking-[0.2em] mb-4">Ready to ship fixes faster?</p>
            <h2 className="text-4xl font-bold tracking-tight mb-4">Bring your logs into one focused stream.</h2>
            <p className="text-textMuted max-w-xl mx-auto mb-10 text-lg">
              Create your account and start with your first pipeline in minutes. No credit card required.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/register"
                className="bg-brand text-background font-bold text-base px-8 py-3.5 rounded-md hover:bg-brand-hover hover:box-glow transition-all shadow-[0_0_20px_rgba(0,255,136,0.3)]"
              >
                Create Free Account
              </Link>
              <Link
                to="/install"
                className="glass-panel text-white font-medium text-base px-8 py-3.5 rounded-md hover:text-brand hover:border-brand/50 transition-all"
              >
                Install CLI
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/50 bg-surface/30 mt-20 relative z-10">
        <div className="mx-auto max-w-6xl px-4 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-1 opacity-70">
            <span className="text-brand font-mono font-bold">pipe</span>
            <span className="text-white font-mono font-bold">log</span>
            <span className="text-brand font-mono">_</span>
          </div>
          <div className="text-sm text-textMuted font-medium">
            Built for faster incident response
          </div>
          <div className="text-xs text-textMuted font-mono">
            © {new Date().getFullYear()} PipeLog
          </div>
        </div>
      </footer>
    </div>
  );
}
