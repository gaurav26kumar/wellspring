import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await register(email, password);
      navigate('/journal');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] text-[var(--paper)] font-ui px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm flex flex-col gap-4">
        <div className="font-display italic font-semibold text-2xl mb-2">Wellspring</div>
        {error && <div className="text-sm text-[var(--glow-amber)]">{error}</div>}
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="bg-[var(--surface-active)] text-[var(--paper)] rounded-xl px-4 py-3 outline-none placeholder:text-[var(--mist)]"
        />
        <input
          type="password"
          required
          minLength={8}
          placeholder="Password (min. 8 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="bg-[var(--surface-active)] text-[var(--paper)] rounded-xl px-4 py-3 outline-none placeholder:text-[var(--mist)]"
        />
        <button
          disabled={loading}
          className="bg-[var(--glow-amber)] text-[var(--bg)] font-label text-xs font-semibold uppercase tracking-wider rounded-full py-3 disabled:opacity-60"
        >
          {loading ? 'Creating account…' : 'Create account'}
        </button>
        <div className="text-sm text-[var(--mist)] text-center">
          Already have one?{' '}
          <Link to="/login" className="underline underline-offset-2">
            Sign in
          </Link>
        </div>
      </form>
    </div>
  );
}
