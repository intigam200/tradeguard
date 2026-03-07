"use client";

import { useEffect } from "react";

export default function ConnectError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Connect page error]:", error);
  }, [error]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-4">
      <div className="text-4xl">⚠️</div>
      <h2 className="text-white text-lg font-semibold">Page failed to load</h2>
      <p className="text-slate-500 text-sm max-w-xs">{error.message}</p>
      <button
        onClick={reset}
        className="mt-2 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold px-6 py-2.5 rounded-xl text-sm transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
