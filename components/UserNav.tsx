'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface UserNavProps {
  user: {
    id: string;
    email: string;
    name: string;
  };
}

export default function UserNav({ user }: UserNavProps) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <div className="hidden sm:flex flex-col text-right">
        <span className="text-xs font-bold text-zinc-900 leading-tight">{user.name}</span>
        <span className="text-[10px] font-mono text-zinc-500 leading-tight truncate max-w-[150px]">{user.email}</span>
      </div>
      <button
        type="button"
        onClick={handleLogout}
        disabled={isLoggingOut}
        className="text-xs font-bold px-3 py-1.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-100 text-zinc-700 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
      >
        {isLoggingOut ? 'Signing out...' : 'Sign Out'}
      </button>
    </div>
  );
}

