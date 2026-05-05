import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api, useAuthStore } from '../api';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      setAuth(data.user, data.token);
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <div className="inline-flex items-center gap-2 mb-6">
            <span className="text-[#00ff88] font-mono text-2xl font-bold">pipe</span>
            <span className="text-white font-mono text-2xl font-bold">log</span>
            <span className="text-[#00ff88] font-mono text-2xl">_</span>
          </div>
          <p className="text-[#666] text-sm font-mono">capture. share. replay.</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-[#666] mb-1.5 uppercase tracking-widest">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-[#111] border border-[#222] text-white font-mono text-sm px-4 py-3 rounded focus:outline-none focus:border-[#00ff88] transition-colors"
              placeholder="you@company.com"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-mono text-[#666] mb-1.5 uppercase tracking-widest">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-[#111] border border-[#222] text-white font-mono text-sm px-4 py-3 rounded focus:outline-none focus:border-[#00ff88] transition-colors"
              placeholder="••••••••"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#00ff88] text-black font-mono font-bold text-sm py-3 rounded hover:bg-[#00e87a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? 'Authenticating...' : '$ login'}
          </button>
        </form>

        <p className="text-center text-[#444] font-mono text-xs mt-6">
          No account?{' '}
          <Link to="/register" className="text-[#00ff88] hover:underline">
            register
          </Link>
        </p>
      </div>
    </div>
  );
}
