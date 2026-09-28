'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function LeadsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log safe error summary internally without leaking database credentials
    console.error('[Leads Boundary Error]:', error.name, error.message);
  }, [error]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md space-y-4">
        <div className="h-12 w-12 rounded-xl bg-rose-950/40 border border-rose-800/60 flex items-center justify-center mx-auto text-rose-400">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-white">Something Went Wrong</h1>
        <p className="text-sm text-zinc-400">
          An error occurred while loading lead information. The error has been logged safely.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => reset()}
            className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sm font-medium text-zinc-200 border border-zinc-700/60 transition-colors cursor-pointer"
          >
            Try Again
          </button>
          <Link
            href="/"
            className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sm font-medium text-zinc-300 border border-zinc-800 transition-colors"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
