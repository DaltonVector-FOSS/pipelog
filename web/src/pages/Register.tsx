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
    <div className="min-h-screen bg-transparent relative flex flex-col items-center justify-center p-4 font-sans text-white overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand/5 rounded-full blur-[120px] -z-10 pointer-events-none" />

      <div className="w-full max-w-sm relative z-10 animate-fade-in-up">
        <div className="mb-8 text-center">
          <Link to="/" className="inline-flex items-center gap-1 mb-4 hover:opacity-80 transition-opacity">
            <span className="text-brand font-mono text-3xl font-bold text-glow">pipe</span>
            <span className="text-white font-mono text-3xl font-bold">log</span>
            <span className="text-brand font-mono text-3xl animate-pulse-slow">_</span>
          </Link>
          <p className="text-textMuted text-sm font-medium tracking-wide">Create your free account.</p>
        </div>

        <div className="glass-panel p-8 rounded-2xl">
          <form onSubmit={submit} className="space-y-5">
            <div>
              <label className="block text-[11px] font-semibold text-textMuted mb-1.5 uppercase tracking-widest">Name</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full bg-background border border-border text-white font-mono text-sm px-4 py-3 rounded-lg focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/50 transition-all placeholder:text-[#333]"
                placeholder="Ada Lovelace"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-textMuted mb-1.5 uppercase tracking-widest">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full bg-background border border-border text-white font-mono text-sm px-4 py-3 rounded-lg focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/50 transition-all placeholder:text-[#333]"
                placeholder="you@company.com"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-textMuted mb-1.5 uppercase tracking-widest">Password</label>
              <input
                type="password"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                className="w-full bg-background border border-border text-white font-mono text-sm px-4 py-3 rounded-lg focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/50 transition-all placeholder:text-[#333]"
                placeholder="min. 8 characters"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand text-background font-bold text-sm py-3.5 rounded-lg hover:bg-brand-hover hover:box-glow transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-4 shadow-[0_0_15px_rgba(0,255,136,0.15)] flex items-center justify-center gap-2"
            >
              {loading ? (
                 <>
                   <span className="w-4 h-4 rounded-full border-2 border-background border-t-transparent animate-spin"></span>
                   Creating account...
                 </>
              ) : (
                <><span className="font-mono text-background/70">$</span> register</>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-textMuted text-sm mt-8 font-medium">
          Have an account?{' '}
          <Link to="/login" className="text-brand hover:text-brand-hover hover:underline underline-offset-4 transition-colors">
            Log in here
          </Link>
        </p>
      </div>
    </div>
  );
}
