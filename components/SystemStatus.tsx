'use client';

import { useEffect, useState } from 'react';
import type { HealthCheckResponse } from '@/types';

export default function SystemStatus() {
  const [health, setHealth] = useState<HealthCheckResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState<string | null>(null);

  const fetchHealth = async () => {
    try {
      const res = await fetch('/api/health', { cache: 'no-store' });
      const data: HealthCheckResponse = await res.json();
      setHealth(data);
      setLastChecked(new Date().toLocaleTimeString());
    } catch {
      setHealth({
        status: 'error',
        database: 'disconnected',
        message: 'Unable to reach health endpoint',
      });
      setLastChecked(new Date().toLocaleTimeString());
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setLoading(true);
    void fetchHealth();
  };

  useEffect(() => {
    let ignore = false;

    fetch('/api/health', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data: HealthCheckResponse) => {
        if (!ignore) {
          setHealth(data);
          setLastChecked(new Date().toLocaleTimeString());
          setLoading(false);
        }
      })
      .catch(() => {
        if (!ignore) {
          setHealth({
            status: 'error',
            database: 'disconnected',
            message: 'Unable to reach health endpoint',
          });
          setLastChecked(new Date().toLocaleTimeString());
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  const isDbConnected = health?.database === 'connected';

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 backdrop-blur-sm">
      <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
            System Infrastructure Status
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Real-time server &amp; database health monitoring
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-750 hover:text-white rounded-lg border border-zinc-700/60 transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          title="Refresh database connectivity check"
        >
          <svg
            className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          {loading ? 'Checking...' : 'Re-check'}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
        {/* Application Status */}
        <div className="flex items-center justify-between p-3.5 rounded-lg bg-zinc-950/70 border border-zinc-800/70">
          <div className="flex items-center gap-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <div>
              <p className="text-xs font-medium text-zinc-400">Application Core</p>
              <p className="text-sm font-semibold text-zinc-100">Online</p>
            </div>
          </div>
          <span className="text-xs px-2 py-0.5 rounded font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/40">
            HTTP 200
          </span>
        </div>

        {/* Database Status */}
        <div className="flex items-center justify-between p-3.5 rounded-lg bg-zinc-950/70 border border-zinc-800/70">
          <div className="flex items-center gap-3">
            <span className="relative flex h-2.5 w-2.5">
              {isDbConnected ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </>
              ) : (
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
              )}
            </span>
            <div>
              <p className="text-xs font-medium text-zinc-400">PostgreSQL Database</p>
              <p className="text-sm font-semibold text-zinc-100">
                {loading ? 'Verifying...' : isDbConnected ? 'Connected' : 'Disconnected'}
              </p>
            </div>
          </div>
          <span
            className={`text-xs px-2 py-0.5 rounded font-mono ${
              isDbConnected
                ? 'text-emerald-400 bg-emerald-950/60 border border-emerald-800/40'
                : 'text-rose-400 bg-rose-950/60 border border-rose-800/40'
            }`}
          >
            {isDbConnected ? 'Prisma Ping OK' : 'Check DATABASE_URL'}
          </span>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-zinc-800/50 flex flex-wrap items-center justify-between text-xs text-zinc-500 font-mono">
        <span>Endpoint: /api/health</span>
        {lastChecked && <span>Last verified: {lastChecked}</span>}
      </div>
    </div>
  );
}
