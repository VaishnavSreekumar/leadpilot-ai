'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.details) {
          const firstErr = Object.values(data.details).flat()[0];
          setError(String(firstErr) || 'Registration failed');
        } else {
          setError(data.error || 'Registration failed');
        }
        setIsLoading(false);
        return;
      }

      router.push('/');
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F1E4DC] text-zinc-900 flex flex-col items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md bg-white rounded-3xl border border-zinc-200/80 p-8 sm:p-10 shadow-xs space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="h-11 w-11 rounded-2xl bg-[#C84B45]/10 border border-[#C84B45]/20 flex items-center justify-center mx-auto mb-3">
            <div className="h-4 w-4 rounded-full bg-[#C84B45]"></div>
          </div>
          <h1 className="text-2xl font-extrabold text-zinc-900 tracking-tight">Create Agent Account</h1>
          <p className="text-xs font-bold uppercase tracking-wider text-[#C84B45] font-mono">
            LeadPilot AI Workspace
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700">
            {error}
          </div>
        )}

        {/* Register Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 mb-1.5" htmlFor="name">
              Full Name
            </label>
            <input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Priya Nair"
              className="w-full rounded-xl bg-zinc-50 border border-zinc-200 px-3.5 py-2.5 text-sm text-zinc-900 focus:outline-none focus:bg-white focus:ring-1 focus:ring-zinc-400 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 mb-1.5" htmlFor="email">
              Work Email Address
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="priya@realty.com"
              className="w-full rounded-xl bg-zinc-50 border border-zinc-200 px-3.5 py-2.5 text-sm text-zinc-900 focus:outline-none focus:bg-white focus:ring-1 focus:ring-zinc-400 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 mb-1.5" htmlFor="password">
              Password (min. 8 characters)
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl bg-zinc-50 border border-zinc-200 px-3.5 py-2.5 text-sm text-zinc-900 focus:outline-none focus:bg-white focus:ring-1 focus:ring-zinc-400 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 rounded-xl bg-[#C84B45] hover:bg-[#b03e39] text-white text-xs font-bold transition-all shadow-xs active:scale-98 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? 'Creating Account...' : 'Register'}
          </button>
        </form>

        <div className="text-center pt-2 text-xs text-zinc-500 font-medium">
          Already have an account?{' '}
          <Link href="/login" className="font-bold text-[#C84B45] hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

