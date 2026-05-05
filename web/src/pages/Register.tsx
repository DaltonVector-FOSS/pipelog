import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api, useAuthStore } from '../api';

export function Register() {
  const [form, setForm] = useState({ email: '', password: '', name: '' });
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/auth/register', form);
      setAuth(data.user, data.token);
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Registration failed');
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
          <p className="text-[#666] text-sm font-mono">create your account</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-[#666] mb-1.5 uppercase tracking-widest">Name</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full bg-[#111] border border-[#222] text-white font-mono text-sm px-4 py-3 rounded focus:outline-none focus:border-[#00ff88] transition-colors"
              placeholder="Ada Lovelace"
            />
          </div>
          <div>
            <label className="block text-xs font-mono text-[#666] mb-1.5 uppercase tracking-widest">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="w-full bg-[#111] border border-[#222] text-white font-mono text-sm px-4 py-3 rounded focus:outline-none focus:border-[#00ff88] transition-colors"
              placeholder="you@company.com"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-mono text-[#666] mb-1.5 uppercase tracking-widest">Password</label>
            <input
              type="password"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              className="w-full bg-[#111] border border-[#222] text-white font-mono text-sm px-4 py-3 rounded focus:outline-none focus:border-[#00ff88] transition-colors"
              placeholder="min. 8 characters"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#00ff88] text-black font-mono font-bold text-sm py-3 rounded hover:bg-[#00e87a] transition-colors disabled:opacity-50 mt-2"
          >
            {loading ? 'Creating account...' : '$ register'}
          </button>
        </form>

        <p className="text-center text-[#444] font-mono text-xs mt-6">
          Have an account?{' '}
          <Link to="/login" className="text-[#00ff88] hover:underline">login</Link>
        </p>
      </div>
    </div>
  );
}
