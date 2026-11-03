'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get('next') || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Invalid email or password');
        setIsLoading(false);
        return;
      }

      router.push(nextUrl);
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setError(null);
    setIsLoading(true);
    const demoEmail = 'sales.agent@leadpilot.ai';
    const demoPass = 'LeadPilotSecure2026!';
    const demoName = 'Sales Agent';

    try {
      let res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: demoEmail, password: demoPass }),
      });

      if (!res.ok) {
        await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: demoName, email: demoEmail, password: demoPass }),
        });

        res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: demoEmail, password: demoPass }),
        });
      }

      if (res.ok) {
        router.push(nextUrl);
        router.refresh();
      } else {
        setError('Demo authentication failed.');
        setIsLoading(false);
      }
    } catch {
      setError('Network error during demo login.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBFBFA] flex flex-col justify-center items-center px-4">
      <div className="w-full max-w-sm bg-white border border-zinc-200/80 rounded-2xl p-7 shadow-xs space-y-6">
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-[#C84B45]/10 text-[#C84B45] font-bold text-lg mb-1">
            LP
          </div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900">Sign in to LeadPilot</h1>
          <p className="text-xs text-zinc-500 font-medium">Sales Command Center for Real Estate</p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium leading-relaxed">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleDemoLogin}
          disabled={isLoading}
          className="w-full py-2.5 px-4 rounded-xl border border-zinc-300 bg-zinc-50 hover:bg-zinc-100 text-zinc-800 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <span>⚡ One-Click Demo Sign-In</span>
        </button>

        <div className="relative flex py-1 items-center">
          <div className="flex-grow border-t border-zinc-200"></div>
          <span className="flex-shrink mx-3 text-zinc-400 text-[10px] uppercase font-bold tracking-wider">
            or password
          </span>
          <div className="flex-grow border-t border-zinc-200"></div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-zinc-600 uppercase tracking-wider">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="agent@agency.com"
              className="w-full rounded-xl bg-zinc-50 border border-zinc-200 px-3.5 py-2.5 text-sm text-zinc-900 focus:outline-none focus:bg-white focus:ring-1 focus:ring-zinc-400 transition-colors"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-zinc-600 uppercase tracking-wider">Password</label>
            <input
              type="password"
              required
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
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="text-center pt-2 text-xs text-zinc-500 font-medium">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="font-bold text-[#C84B45] hover:underline">
            Register here
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FBFBFA] flex items-center justify-center text-xs text-zinc-500">Loading sign-in...</div>}>
      <LoginForm />
    </Suspense>
  );
}
