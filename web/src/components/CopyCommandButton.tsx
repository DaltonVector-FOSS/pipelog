import { useEffect, useRef, useState } from 'react';

export function CopyCommandButton({ text }: { text: string }) {
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
      aria-label={status === 'copied' ? 'Copied to clipboard' : 'Copy to clipboard'}
    >
      {label}
    </button>
  );
}
