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
            <Link
              to="/register"
              className="bg-[#00ff88] text-black font-mono font-bold text-sm px-6 py-3 rounded hover:bg-[#00e87a] transition-colors"
            >
              get started
            </Link>
            <Link
              to="/login"
              className="border border-[#2a2a2a] text-white font-mono font-semibold text-sm px-6 py-3 rounded hover:border-[#00ff88] hover:text-[#00ff88] transition-colors"
            >
              sign in
            </Link>
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
