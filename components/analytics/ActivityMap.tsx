"use client";

interface HeatTrade {
  closedAt: string | null;
  realizedPnl: number | null;
}

interface ActivityMapProps {
  trades: HeatTrade[];
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DLABELS = ["M","T","W","T","F","S","S"];

export function ActivityMap({ trades }: ActivityMapProps) {
  // Build day map from trades
  const dayMap = new Map<string, { pnl: number; count: number }>();
  for (const t of trades) {
    if (!t.closedAt || t.realizedPnl === null) continue;
    const k = t.closedAt.slice(0, 10);
    const cur = dayMap.get(k) ?? { pnl: 0, count: 0 };
    dayMap.set(k, { pnl: cur.pnl + t.realizedPnl, count: cur.count + 1 });
  }

  // Build 52 weeks (364 days) ending today, Mon-aligned
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - 363);
  const dow = (start.getDay() + 6) % 7; // Mon=0
  start.setDate(start.getDate() - dow);

  const weeks: { date: string; pnl: number; count: number; future: boolean }[][] = [];
  const cur = new Date(start);
  while (weeks.length < 53) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const k = cur.toISOString().slice(0, 10);
      const data = dayMap.get(k);
      week.push({ date: k, pnl: data?.pnl ?? 0, count: data?.count ?? 0, future: cur > today });
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(week);
  }

  const maxAbs = Math.max(1, ...Array.from(dayMap.values()).map(d => Math.abs(d.pnl)));
  const cellColor = (pnl: number, count: number, future: boolean) => {
    if (future || count === 0) return "bg-white/[0.04]";
    const i = Math.min(1, Math.abs(pnl) / maxAbs);
    if (pnl > 0) return i > 0.7 ? "bg-emerald-500" : i > 0.4 ? "bg-emerald-500/60" : "bg-emerald-500/30";
    return i > 0.7 ? "bg-red-500" : i > 0.4 ? "bg-red-500/60" : "bg-red-500/30";
  };

  const fmt = (date: string) => {
    const d = new Date(date);
    return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  };

  return (
    <div>
      {trades.length === 0 ? (
        <div className="h-32 flex items-center justify-center text-xs text-slate-600">
          No trades yet — activity will appear after syncing
        </div>
      ) : (
        <>
          {/* Month labels */}
          <div className="flex gap-1 mb-1 ml-4">
            {weeks.map((week, i) => {
              const d = new Date(week[0].date);
              const show = d.getDate() <= 7;
              return (
                <div key={i} className="w-3 text-center">
                  {show && <span className="text-[8px] text-slate-700">{MONTHS[d.getMonth()]}</span>}
                </div>
              );
            })}
          </div>

          {/* Grid */}
          <div className="flex gap-1">
            {/* Day labels */}
            <div className="flex flex-col gap-1 mr-1 pt-0.5">
              {DLABELS.map((d, i) => (
                <div key={i} className="w-3 h-3 flex items-center justify-center text-[8px] text-slate-700">{d}</div>
              ))}
            </div>

            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-1">
                {week.map((day, di) => (
                  <div
                    key={di}
                    title={day.count > 0
                      ? `${fmt(day.date)}: ${day.pnl >= 0 ? "+" : ""}$${day.pnl.toFixed(0)} · ${day.count} trade${day.count !== 1 ? "s" : ""}`
                      : `${fmt(day.date)}: No trades`}
                    className={`w-3 h-3 rounded-[2px] cursor-default transition-opacity hover:opacity-80 ${cellColor(day.pnl, day.count, day.future)}`}
                  />
                ))}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-2 mt-2.5">
            <span className="text-[9px] text-slate-600">Loss</span>
            {["bg-red-500","bg-red-500/60","bg-red-500/30","bg-white/[0.04]","bg-emerald-500/30","bg-emerald-500/60","bg-emerald-500"].map((c, i) => (
              <div key={i} className={`w-3 h-3 rounded-[2px] ${c}`} />
            ))}
            <span className="text-[9px] text-slate-600">Profit</span>
          </div>
        </>
      )}
    </div>
  );
}
