export function PageLoader() {
  return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
          <span className="text-emerald-400 font-bold text-xl">TG</span>
        </div>
        <div className="w-8 h-8 border-2 border-white/10 border-t-emerald-400 rounded-full animate-spin" />
        <p className="text-slate-500 text-sm">Loading your data...</p>
      </div>
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="bg-[#161b27] border border-white/5 rounded-xl p-4 animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="h-3 bg-white/5 rounded w-24" />
        <div className="h-5 w-5 bg-white/5 rounded" />
      </div>
      <div className="h-8 bg-white/5 rounded w-28 mb-2" />
      <div className="h-2.5 bg-white/5 rounded w-full mb-3" />
      <div className="h-1.5 bg-white/5 rounded-full w-full" />
    </div>
  );
}
