'use client';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg rounded-lg border border-red-200 bg-white p-6">
      <h1 className="text-lg font-semibold text-ink-950">This page could not load</h1>
      <p className="mt-2 text-sm text-ink-600">
        {error.message || 'The control center could not read platform data.'}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-md bg-ink-900 px-3 py-2 text-sm font-medium text-white"
      >
        Try again
      </button>
    </div>
  );
}
