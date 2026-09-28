import Link from 'next/link';

export default function LeadNotFound() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md space-y-4">
        <div className="h-12 w-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-500">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-white">Lead Record Not Found</h1>
        <p className="text-sm text-zinc-400">
          The requested lead record could not be found. It may have been removed or the ID in the URL is invalid.
        </p>
        <div className="pt-2">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sm font-medium text-zinc-200 border border-zinc-700/60 transition-colors"
          >
            &larr; Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
