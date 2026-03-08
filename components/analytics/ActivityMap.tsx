"use client";

interface DayData {
  date: string;
  pnl: number | null;
  trades: number;
}

interface HeatTrade {
  closedAt: string | null;
  realizedPnl: number | null;
}

const WEEKS    = 16;
const MONTHS   = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAY_LBLS = ["M","","W","","F","","S"];

export function ActivityMap({ trades }: { trades: HeatTrade[] }) {
  // Build date→{pnl,trades} map
  const map: Record<string, { pnl: number; trades: number }> = {};
  for (const t of trades) {
    if (!t.closedAt) continue;
    const key = new Date(t.closedAt).toISOString().slice(0, 10);
    if (!map[key]) map[key] = { pnl: 0, trades: 0 };
    map[key].pnl    += t.realizedPnl ?? 0;
    map[key].trades += 1;
  }

  // Build last WEEKS*7 days aligned to Mon
  const days: DayData[] = [];
  for (let i = WEEKS * 7 - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({ date: key, pnl: map[key]?.pnl ?? null, trades: map[key]?.trades ?? 0 });
  }

  const weeks: DayData[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  const getColor = (pnl: number | null): string => {
    if (pnl === null)  return "bg-white/[0.04]";
    if (pnl === 0)     return "bg-white/[0.04]";
    if (pnl > 200)     return "bg-emerald-400";
    if (pnl > 50)      return "bg-emerald-500";
    if (pnl > 0)       return "bg-emerald-500/40";
    if (pnl < -200)    return "bg-red-400";
    if (pnl < -50)     return "bg-red-500";
    return "bg-red-500/40";
  };

  if (trades.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center text-xs text-slate-600">
        No trades yet — activity will appear after syncing
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden">
      <div className="flex gap-[2px] w-full">
        {/* Day-of-week labels */}
        <div className="flex flex-col gap-[2px] justify-around shrink-0 pt-5 mr-0.5">
          {DAY_LBLS.map((d, i) => (
            <div key={i} className="h-[10px] flex items-center text-[8px] text-slate-700 leading-none">{d}</div>
          ))}
        </div>

        {/* Grid */}
        <div className="flex-1 min-w-0 flex flex-col gap-[2px]">
          {/* Month labels */}
          <div className="flex gap-[2px]">
            {weeks.map((week, i) => {
              const d = new Date(week[0].date);
              return (
                <div key={i} className="flex-1 min-w-0 text-center overflow-hidden">
                  {d.getDate() <= 7 && (
                    <span className="text-[8px] text-slate-700 truncate block leading-tight">
                      {MONTHS[d.getMonth()]}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Cells — one row per day of week */}
          {[0,1,2,3,4,5,6].map(dow => (
            <div key={dow} className="flex gap-[2px]">
              {weeks.map((week, wi) => {
                const day = week[dow];
                return (
                  <div
                    key={wi}
                    title={
                      day.trades > 0
                        ? `${day.date}: ${(day.pnl ?? 0) >= 0 ? "+" : ""}$${(day.pnl ?? 0).toFixed(0)} · ${day.trades} trade${day.trades !== 1 ? "s" : ""}`
                        : `${day.date}: No trades`
                    }
                    className={`flex-1 rounded-[2px] cursor-default hover:opacity-70 transition-opacity ${getColor(day.pnl)}`}
                    style={{ aspectRatio: "1/1" }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between mt-2">
        <span className="text-[9px] text-slate-600">{trades.length} trades total</span>
        <div className="flex items-center gap-1">
          <span className="text-[9px] text-slate-600">Loss</span>
          {["bg-red-400","bg-red-500/40","bg-white/[0.04]","bg-emerald-500/40","bg-emerald-400"].map((c, i) => (
            <div key={i} className={`w-2.5 h-2.5 rounded-[2px] ${c}`} />
          ))}
          <span className="text-[9px] text-slate-600">Profit</span>
        </div>
      </div>
    </div>
  );
}
