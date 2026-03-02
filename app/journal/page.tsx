"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import AppShell from "@/components/layout/AppShell";
import { PageTransition, CardGrid, CardTransition } from "@/components/ui/animations";
import {
  AreaChart, Area, BarChart, Bar,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";
import {
  calcEquityCurve, calcMetrics, calcPnLDistribution,
  calcTimeAnalysis, calcSymbolBreakdown,
  type ATrade, type EquityPoint,
} from "@/lib/analytics";

// ─── Types ────────────────────────────────────────────────────────────────────
type Trade = ATrade & {
  id: string; status: string; entryPrice: number;
  exitPrice: number | null; quantity: number;
};
type DayData = { pnl: number; trades: Trade[] };
type Period = "1w" | "1m" | "3m" | "all";

// ─── Constants ────────────────────────────────────────────────────────────────
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const PERIODS: { key: Period; label: string }[] = [
  { key: "1w", label: "1W" }, { key: "1m", label: "1M" },
  { key: "3m", label: "3M" }, { key: "all", label: "All" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const $ = (v: number, dec = 2) =>
  (v >= 0 ? "+" : "") + "$" + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
const pct = (v: number) => (v * 100).toFixed(1) + "%";
const pnlCls = (v: number) => v > 0 ? "text-emerald-400" : v < 0 ? "text-red-400" : "text-slate-400";
const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
const getFirstDay = (y: number, m: number) => { const d = new Date(y, m, 1).getDay(); return d === 0 ? 6 : d - 1; };
const dateKey = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

function getPeriodRange(p: Period) {
  const now = new Date(), today = now.toISOString().slice(0, 10);
  if (p === "all") return { closedSince: null, closedUntil: null };
  if (p === "1w") { const d = new Date(now); d.setDate(d.getDate() - 7); return { closedSince: d.toISOString().slice(0, 10), closedUntil: today }; }
  if (p === "1m") return { closedSince: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`, closedUntil: today };
  const d = new Date(now); d.setMonth(d.getMonth() - 3);
  return { closedSince: d.toISOString().slice(0, 10), closedUntil: today };
}

function computePerformanceScore(m: ReturnType<typeof calcMetrics>) {
  return [
    { axis: "Profit Factor", value: Math.round(Math.min(100, (m.profitFactor / 3) * 100)) },
    { axis: "Win Rate",      value: Math.round(m.winRate * 100) },
    { axis: "Risk/Reward",   value: Math.round(m.avgLoss > 0 ? Math.min(100, (m.avgWin / m.avgLoss) * 33.3) : 0) },
    { axis: "Consistency",   value: Math.round(Math.max(0, Math.min(100, (m.sharpeRatio / 2) * 100))) },
    { axis: "Discipline",    value: Math.round(Math.max(0, Math.min(100, 100 - m.maxConsecLosses * 15))) },
  ];
}

// ─── Custom Tooltips ──────────────────────────────────────────────────────────
const EqTooltip = ({ active, payload }: { active?: boolean; payload?: { payload: EquityPoint }[] }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-[#1e2534] border border-white/10 rounded-lg p-3 text-xs shadow-2xl">
      <p className="text-slate-400 mb-0.5">{d.time}</p>
      <p className="text-white font-semibold">{d.symbol}</p>
      <p className={pnlCls(d.pnl)}>Trade: {$(d.pnl)}</p>
      <p className={`font-semibold ${pnlCls(d.cumPnl)}`}>Total: {$(d.cumPnl)}</p>
    </div>
  );
};

const SimpleTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1e2534] border border-white/10 rounded-lg p-2.5 text-xs shadow-2xl">
      <p className="text-slate-400 mb-0.5">{label}</p>
      <p className={pnlCls(payload[0].value)}>{$(payload[0].value)}</p>
    </div>
  );
};

// ─── ExpandModal ──────────────────────────────────────────────────────────────
function ExpandModal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#161b27] border border-white/10 rounded-2xl w-[90vw] max-w-5xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-lg leading-none">✕</button>
        </div>
        <div className="flex-1 overflow-auto p-5">{children}</div>
      </div>
    </div>
  );
}

// ─── TradeModal ───────────────────────────────────────────────────────────────
function TradeModal({ trade, onClose }: { trade: Trade; onClose: () => void }) {
  const pnl = trade.realizedPnl ?? 0;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#161b27] border border-white/10 rounded-2xl w-[460px] flex flex-col overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div>
            <h2 className="text-sm font-semibold text-white">{trade.symbol}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{trade.direction} · {trade.closedAt?.slice(0,10) ?? "—"}</p>
          </div>
          <div className="flex items-center gap-3">
            <p className={`text-lg font-bold ${pnlCls(pnl)}`}>{$(pnl)}</p>
            <button onClick={onClose} className="text-slate-400 hover:text-white text-lg leading-none">✕</button>
          </div>
        </div>
        <div className="p-5 grid grid-cols-2 gap-3">
          {[
            { label: "Direction",   value: trade.direction, cls: trade.direction === "LONG" ? "text-emerald-400" : "text-red-400" },
            { label: "Quantity",    value: String(trade.quantity), cls: "text-white" },
            { label: "Entry Price", value: trade.entryPrice ? `$${trade.entryPrice}` : "—", cls: "text-white" },
            { label: "Exit Price",  value: trade.exitPrice  ? `$${trade.exitPrice}`  : "—", cls: "text-white" },
            { label: "Opened",      value: trade.openedAt?.slice(0,16).replace("T"," ") ?? "—", cls: "text-slate-300" },
            { label: "Closed",      value: trade.closedAt?.slice(0,16).replace("T"," ") ?? "—", cls: "text-slate-300" },
          ].map(f => (
            <div key={f.label} className="bg-white/[0.03] rounded-lg p-3">
              <p className="text-[10px] text-slate-500 mb-1">{f.label}</p>
              <p className={`text-sm font-semibold ${f.cls}`}>{f.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── WidgetCard ───────────────────────────────────────────────────────────────
function WidgetCard({ title, subtitle, expandContent, headerRight, children }: {
  title: string; subtitle?: string;
  expandContent?: React.ReactNode;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <div className="bg-[#161b27] border border-white/5 rounded-xl p-5 relative"
        onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-white">{title}</h2>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2">
            {headerRight}
            {expandContent && hovered && (
              <button onClick={() => setExpanded(true)}
                className="text-slate-500 hover:text-slate-300 transition-colors text-sm p-1 rounded hover:bg-white/5"
                title="Expand">⛶</button>
            )}
          </div>
        </div>
        {children}
      </div>
      {expanded && expandContent && (
        <ExpandModal title={title} onClose={() => setExpanded(false)}>
          {expandContent}
        </ExpandModal>
      )}
    </>
  );
}

// ─── TradingHeatmap ───────────────────────────────────────────────────────────
function TradingHeatmap({ trades }: { trades: Trade[] }) {
  const today = new Date();
  const dayMap = new Map<string, { pnl: number; count: number }>();
  for (const t of trades) {
    if (!t.closedAt || t.realizedPnl === null) continue;
    const k = t.closedAt.slice(0, 10);
    const cur = dayMap.get(k) ?? { pnl: 0, count: 0 };
    dayMap.set(k, { pnl: cur.pnl + t.realizedPnl, count: cur.count + 1 });
  }

  // Build 13 weeks (Mon-aligned)
  const start = new Date(today);
  start.setDate(today.getDate() - 90);
  const dow = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - dow);

  const weeks: { date: string; pnl: number; count: number; future: boolean }[][] = [];
  const cur = new Date(start);
  while (weeks.length < 13) {
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

  const DLABELS = ["M","T","W","T","F","S","S"];
  return (
    <div>
      <div className="flex gap-1">
        <div className="flex flex-col gap-1 mr-1 pt-0.5">
          {DLABELS.map((d, i) => (
            <div key={i} className="w-3 h-3 flex items-center justify-center text-[8px] text-slate-700">{d}</div>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((day, di) => (
              <div key={di}
                title={day.count > 0 ? `${day.date}: ${$(day.pnl)} · ${day.count} trades` : day.date}
                className={`w-3 h-3 rounded-[2px] cursor-default transition-opacity hover:opacity-80 ${cellColor(day.pnl, day.count, day.future)}`} />
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-2.5">
        <span className="text-[9px] text-slate-600">Less</span>
        {["bg-white/[0.04]","bg-emerald-500/30","bg-emerald-500/60","bg-emerald-500"].map((c,i) => (
          <div key={i} className={`w-3 h-3 rounded-[2px] ${c}`} />
        ))}
        <span className="text-[9px] text-slate-600">More</span>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function JournalPage() {
  const today = new Date();

  // Analytics state
  const [period, setPeriod]     = useState<Period>("1m");
  const [symFilter, setSymFilter] = useState("");
  const [dirFilter, setDirFilter] = useState<"ALL"|"LONG"|"SHORT">("ALL");
  const [aTrades, setATrades]   = useState<Trade[]>([]);
  const [aLoading, setALoading] = useState(true);
  const [mounted, setMounted]   = useState(false);

  // Calendar state
  const [year, setYear]     = useState(today.getFullYear());
  const [month, setMonth]   = useState(today.getMonth());
  const [calData, setCalData] = useState<Record<string, DayData>>({});
  const [calLoading, setCalLoading] = useState(true);
  const [selDay, setSelDay] = useState<string | null>(null);

  // UI state
  const [page, setPage]               = useState(0);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);

  useEffect(() => { setMounted(true); }, []);

  // Load analytics trades
  const loadAnalytics = useCallback(async (p: Period) => {
    setALoading(true);
    try {
      const { closedSince, closedUntil } = getPeriodRange(p);
      let url = "/api/trades?status=CLOSED&limit=1000";
      if (closedSince) url += `&closedSince=${closedSince}`;
      if (closedUntil) url += `&closedUntil=${closedUntil}`;
      const res  = await fetch(url);
      const json = await res.json() as { ok: boolean; trades: Trade[] };
      if (json.ok) setATrades(json.trades);
    } finally { setALoading(false); }
  }, []);

  useEffect(() => { loadAnalytics(period); }, [loadAnalytics, period]);

  // Load calendar
  const loadCalendar = useCallback(async (y: number, m: number) => {
    setCalLoading(true); setCalData({}); setSelDay(null);
    try {
      const since = `${y}-${String(m+1).padStart(2,"0")}-01`;
      const until = `${y}-${String(m+1).padStart(2,"0")}-${getDaysInMonth(y,m)}`;
      const res  = await fetch(`/api/trades?limit=500&status=CLOSED&since=${since}&until=${until}`);
      const json = await res.json() as { ok: boolean; trades: Trade[] };
      if (!json.ok) return;
      const grouped: Record<string, DayData> = {};
      for (const t of json.trades) {
        const k = (t.closedAt ?? t.openedAt).slice(0, 10);
        if (!grouped[k]) grouped[k] = { pnl: 0, trades: [] };
        grouped[k].pnl += t.realizedPnl ?? 0;
        grouped[k].trades.push(t);
      }
      setCalData(grouped);
    } finally { setCalLoading(false); }
  }, []);

  useEffect(() => { loadCalendar(year, month); }, [loadCalendar, year, month]);

  // Filtered trades
  const filtered = useMemo(() =>
    aTrades
      .filter(t => !symFilter || t.symbol.includes(symFilter.toUpperCase()))
      .filter(t => dirFilter === "ALL" || t.direction === dirFilter),
    [aTrades, symFilter, dirFilter]
  );

  // Analytics
  const metrics     = useMemo(() => calcMetrics(filtered), [filtered]);
  const equityCurve = useMemo(() => calcEquityCurve(filtered), [filtered]);
  const pnlDist     = useMemo(() => calcPnLDistribution(filtered), [filtered]);
  const timeAnalysis = useMemo(() => calcTimeAnalysis(filtered), [filtered]);
  const symbolBdown = useMemo(() => calcSymbolBreakdown(filtered), [filtered]);
  const perfScore   = useMemo(() => computePerformanceScore(metrics), [metrics]);

  const noData = filtered.length === 0;

  // Equity gradient
  const maxCum = equityCurve.length ? Math.max(0, ...equityCurve.map(p => p.cumPnl)) : 0;
  const minCum = equityCurve.length ? Math.min(0, ...equityCurve.map(p => p.cumPnl)) : 0;
  const cumRange = maxCum - minCum;
  const zeroOffset = cumRange > 0 ? `${((maxCum / cumRange) * 100).toFixed(0)}%` : "100%";
  const eqColor = metrics.netPnl >= 0 ? "#10b981" : "#ef4444";

  // Calendar
  const DAYS_HEADER = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay    = getFirstDay(year, month);
  const monthEntries  = Object.entries(calData);
  const allCalTrades  = monthEntries.flatMap(([, v]) => v.trades);
  const selData = selDay ? calData[selDay] : null;
  const prevMonth = () => { if (month===0){setMonth(11);setYear(y=>y-1);}else setMonth(m=>m-1); };
  const nextMonth = () => { if (month===11){setMonth(0);setYear(y=>y+1);}else setMonth(m=>m+1); };

  // Trades table
  const PAGE_SIZE = 20;
  const sortedForTable = useMemo(() =>
    [...filtered].sort((a,b) => new Date(b.closedAt ?? b.openedAt).getTime() - new Date(a.closedAt ?? a.openedAt).getTime()),
    [filtered]
  );
  const totalPages  = Math.max(1, Math.ceil(sortedForTable.length / PAGE_SIZE));
  const pagedTrades = sortedForTable.slice(page * PAGE_SIZE, (page+1) * PAGE_SIZE);

  // Equity chart shared content
  const EqChart = ({ h }: { h: number }) => (
    <ResponsiveContainer width="100%" height={h}>
      <AreaChart data={equityCurve} margin={{ top:5, right:5, bottom:0, left:5 }}>
        <defs>
          <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"         stopColor="#10b981" stopOpacity={0.25} />
            <stop offset={zeroOffset} stopColor="#10b981" stopOpacity={0.05} />
            <stop offset={zeroOffset} stopColor="#ef4444" stopOpacity={0.05} />
            <stop offset="100%"       stopColor="#ef4444" stopOpacity={0.20} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
        <XAxis dataKey="date" tick={false} axisLine={{ stroke:"rgba(255,255,255,0.08)" }} tickLine={false} />
        <YAxis tick={{ fontSize:10, fill:"#64748b" }} tickFormatter={v=>`$${v}`} axisLine={false} tickLine={false} width={56} />
        <Tooltip content={<EqTooltip />} />
        <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4" />
        <Area type="monotone" dataKey="cumPnl" stroke={eqColor} strokeWidth={2} fill="url(#eqGrad)" dot={false} activeDot={{ r:4, fill:eqColor }} />
      </AreaChart>
    </ResponsiveContainer>
  );

  return (
    <AppShell>
      <PageTransition>

        {/* ── Header ── */}
        <header className="h-14 border-b border-white/5 px-6 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-sm font-semibold text-white">Analytics</h1>
            <p className="text-xs text-slate-500">Performance & Statistics</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-[#1e2534] border border-white/5 rounded-lg p-0.5 gap-0.5">
              {PERIODS.map(p => (
                <button key={p.key} onClick={() => { setPeriod(p.key); setPage(0); }}
                  className={`text-xs px-2.5 py-1 rounded-md transition-colors ${period===p.key?"bg-emerald-500/10 text-emerald-400 font-medium":"text-slate-500 hover:text-slate-300"}`}>
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex bg-[#1e2534] border border-white/5 rounded-lg p-0.5 gap-0.5">
              {(["ALL","LONG","SHORT"] as const).map(d => (
                <button key={d} onClick={() => setDirFilter(d)}
                  className={`text-xs px-2.5 py-1 rounded-md transition-colors ${dirFilter===d?"bg-emerald-500/10 text-emerald-400 font-medium":"text-slate-500 hover:text-slate-300"}`}>
                  {d==="ALL"?"All":d}
                </button>
              ))}
            </div>
            <input value={symFilter} onChange={e => setSymFilter(e.target.value)}
              placeholder="Symbol..."
              className="bg-[#1e2534] border border-white/5 rounded-lg px-3 py-1 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/30 w-28" />
            {aLoading && <span className="text-[10px] text-slate-600">Loading...</span>}
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6 space-y-5">

          {/* ── 4 KPI Cards ── */}
          <CardGrid className="grid grid-cols-4 gap-4">
            {[
              { label:"Net P&L",       value: noData?"—":$(metrics.netPnl),    sub:`${metrics.totalTrades} trades`,  cls: pnlCls(metrics.netPnl) },
              { label:"Expectancy",    value: noData?"—":$(metrics.expectancy), sub:"per trade",                      cls: pnlCls(metrics.expectancy) },
              { label:"Profit Factor", value: noData?"—":metrics.profitFactor===999?"∞":metrics.profitFactor.toFixed(2), sub:"wins / losses ratio", cls: metrics.profitFactor>=1.5?"text-emerald-400":metrics.profitFactor>=1?"text-yellow-400":"text-red-400" },
              { label:"Win Rate",      value: noData?"—":pct(metrics.winRate),  sub:`${metrics.winners}W · ${metrics.losers}L`, cls: metrics.winRate>=0.5?"text-emerald-400":"text-red-400" },
            ].map(card => (
              <CardTransition key={card.label}>
                <div className="bg-[#161b27] border border-white/5 rounded-xl p-4 h-full">
                  <p className="text-xs text-slate-500 mb-2">{card.label}</p>
                  <p className={`text-2xl font-bold tracking-tight ${card.cls}`}>{card.value}</p>
                  <p className="text-[10px] text-slate-600 mt-1">{card.sub}</p>
                </div>
              </CardTransition>
            ))}
          </CardGrid>

          {/* ── Performance Score + Heatmap ── */}
          <div className="grid grid-cols-2 gap-4">

            <WidgetCard title="Performance Score" subtitle="Multi-factor trading quality">
              {!mounted || noData ? (
                <div className="h-52 flex items-center justify-center text-xs text-slate-600">
                  {aLoading ? "Loading..." : "No data for period"}
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <RadarChart data={perfScore} outerRadius={70} margin={{ top:10, right:20, bottom:10, left:20 }}>
                      <PolarGrid stroke="rgba(255,255,255,0.07)" />
                      <PolarAngleAxis dataKey="axis" tick={{ fontSize:10, fill:"#64748b" }} />
                      <Radar name="Score" dataKey="value" stroke="#10b981" fill="#10b981" fillOpacity={0.15} dot />
                    </RadarChart>
                  </ResponsiveContainer>
                  <div className="grid grid-cols-5 gap-1 mt-1">
                    {perfScore.map(s => (
                      <div key={s.axis} className="text-center">
                        <p className="text-[11px] font-bold text-emerald-400">{s.value}</p>
                        <p className="text-[9px] text-slate-600 truncate">{s.axis}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </WidgetCard>

            <WidgetCard title="Activity Heatmap" subtitle="90-day P&L density (hover for details)">
              {!mounted ? (
                <div className="h-52 flex items-center justify-center text-xs text-slate-600">Loading...</div>
              ) : (
                <TradingHeatmap trades={filtered} />
              )}
            </WidgetCard>
          </div>

          {/* ── Equity Curve ── */}
          <WidgetCard title="Equity Curve"
            subtitle={`${equityCurve.length} trades · cumulative P&L`}
            headerRight={<p className={`text-lg font-bold ${pnlCls(metrics.netPnl)}`}>{noData?"—":$(metrics.netPnl)}</p>}
            expandContent={!noData ? <EqChart h={400} /> : undefined}>
            {!mounted || noData ? (
              <div className="h-48 flex items-center justify-center text-xs text-slate-600">
                {aLoading ? "Loading..." : "No data for period"}
              </div>
            ) : (
              <EqChart h={200} />
            )}
          </WidgetCard>

          {/* ── Calendar + Detail Panel ── */}
          <div className="flex gap-5">
            {/* Calendar */}
            <div className="flex-1 min-w-0 bg-[#161b27] border border-white/5 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-white">{MONTHS[month]} {year}</h2>
                <div className="flex gap-1">
                  <button onClick={prevMonth} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white text-sm">‹</button>
                  <button onClick={nextMonth} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white text-sm">›</button>
                </div>
              </div>
              <div className="grid grid-cols-7 mb-2">
                {DAYS_HEADER.map(d => <div key={d} className="text-center text-[10px] text-slate-600 font-medium py-1">{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: firstDay }).map((_,i) => <div key={`e-${i}`} />)}
                {Array.from({ length: daysInMonth }).map((_,i) => {
                  const d = i+1, k = dateKey(year,month,d), day = calData[k];
                  const isToday    = k === dateKey(today.getFullYear(), today.getMonth(), today.getDate());
                  const isSelected = selDay === k;
                  const isWeekend  = [0,6].includes(new Date(year,month,d).getDay());
                  return (
                    <button key={d} onClick={() => day ? setSelDay(isSelected ? null : k) : undefined}
                      className={`relative rounded-lg p-2 text-left transition-all min-h-[56px]
                        ${isWeekend && !day ? "opacity-30" : ""}
                        ${day ? "cursor-pointer hover:ring-1 hover:ring-white/20" : "cursor-default"}
                        ${isSelected ? "ring-2 ring-emerald-500/60" : ""}
                        ${day && day.pnl>0 ? "bg-emerald-500/10 border border-emerald-500/20"
                          : day && day.pnl<0 ? "bg-red-500/10 border border-red-500/20"
                          : day ? "bg-slate-500/10 border border-slate-500/20"
                          : "bg-white/[0.02] border border-white/5"}`}>
                      <span className={`text-[11px] font-semibold ${isToday ? "bg-emerald-500 text-black rounded px-1" : day ? pnlCls(day.pnl) : "text-slate-600"}`}>{d}</span>
                      {day && (
                        <>
                          <p className={`text-[10px] font-bold mt-1 ${pnlCls(day.pnl)}`}>{day.pnl>=0?"+":"-"}${Math.abs(day.pnl).toLocaleString("en-US",{maximumFractionDigits:0})}</p>
                          <p className="text-[9px] text-slate-600 mt-0.5">{day.trades.length} tr</p>
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
              {calLoading && <p className="text-center text-xs text-slate-600 mt-4">Loading...</p>}
              {!calLoading && allCalTrades.length === 0 && (
                <p className="text-center text-xs text-slate-600 mt-4">No trades. Sync on <a href="/dashboard" className="text-emerald-400 hover:underline">Dashboard</a>.</p>
              )}
              <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/5">
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500/30"/><span className="text-[10px] text-slate-500">Profit day</span></div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-red-500/20 border border-red-500/30"/><span className="text-[10px] text-slate-500">Loss day</span></div>
              </div>
            </div>

            {/* Detail Panel */}
            <div className="w-64 shrink-0 space-y-3">
              {selData ? (
                <div className="bg-[#161b27] border border-white/5 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-white">
                      {selDay && new Date(selDay+"T12:00:00").toLocaleDateString("en-US", { day:"numeric", month:"short" })}
                    </p>
                    <p className={`text-sm font-bold ${pnlCls(selData.pnl)}`}>{selData.pnl>=0?"+":"-"}${Math.abs(selData.pnl).toFixed(2)}</p>
                  </div>
                  <div className="space-y-2 max-h-52 overflow-auto">
                    {selData.trades.map(t => (
                      <button key={t.id} onClick={() => setSelectedTrade(t)}
                        className={`w-full text-left rounded-lg p-2.5 border transition-colors hover:ring-1 hover:ring-white/20
                          ${(t.realizedPnl??0)>0?"bg-emerald-500/10 border-emerald-500/20":(t.realizedPnl??0)<0?"bg-red-500/10 border-red-500/20":"bg-slate-500/10 border-slate-500/20"}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-white">{t.symbol}</span>
                          <span className={`text-xs font-bold ${pnlCls(t.realizedPnl??0)}`}>{(t.realizedPnl??0)>=0?"+":"-"}${Math.abs(t.realizedPnl??0).toFixed(2)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500">
                          <span className={t.direction==="LONG"?"text-emerald-400":"text-red-400"}>{t.direction}</span>
                          <span>·</span><span>{t.quantity}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-[#161b27] border border-white/5 rounded-xl p-4 text-center">
                  <p className="text-xs text-slate-600">Click a trading day<br />to see trade details</p>
                </div>
              )}

              {/* Month summary */}
              <div className="bg-[#161b27] border border-white/5 rounded-xl p-4">
                <p className="text-xs font-semibold text-white mb-3">Month Summary</p>
                {(() => {
                  const totalPnl  = monthEntries.reduce((s,[,v])=>s+v.pnl,0);
                  const tradeDays = monthEntries.length;
                  const winDays   = monthEntries.filter(([,v])=>v.pnl>0).length;
                  const winT      = allCalTrades.filter(t=>(t.realizedPnl??0)>0).length;
                  return (
                    <div className="space-y-2">
                      {[
                        { label:"Net P&L",    value: calLoading?"...":`${totalPnl>=0?"+":"-"}$${Math.abs(totalPnl).toFixed(0)}`, cls: pnlCls(totalPnl) },
                        { label:"Trade Days", value: calLoading?"...":String(tradeDays), cls:"text-white" },
                        { label:"Win Days",   value: calLoading?"...":`${winDays}/${tradeDays}`, cls:"text-emerald-400" },
                        { label:"Win Rate",   value: calLoading?"...":(allCalTrades.length?`${Math.round(winT/allCalTrades.length*100)}%`:"—"), cls: allCalTrades.length&&winT/allCalTrades.length>=0.5?"text-emerald-400":"text-red-400" },
                      ].map(row => (
                        <div key={row.label} className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-500">{row.label}</span>
                          <span className={`text-[10px] font-bold ${row.cls}`}>{row.value}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* ── P&L Distribution + By Hour ── */}
          <div className="grid grid-cols-2 gap-4">
            <WidgetCard title="P&L Distribution" subtitle="Trades by return bucket"
              expandContent={pnlDist.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={pnlDist} margin={{ top:5, right:5, bottom:40, left:5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="range" tick={{ fontSize:10, fill:"#64748b" }} axisLine={false} tickLine={false} angle={-30} textAnchor="end" />
                    <YAxis tick={{ fontSize:10, fill:"#64748b" }} axisLine={false} tickLine={false} width={24} />
                    <Tooltip content={<SimpleTooltip />} />
                    <Bar dataKey="count" radius={[3,3,0,0]}>
                      {pnlDist.map((b,i) => <Cell key={i} fill={b.isProfit?"#10b981":"#ef4444"} fillOpacity={0.75} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : undefined}>
              {!mounted || pnlDist.length === 0 ? (
                <div className="h-36 flex items-center justify-center text-xs text-slate-600">
                  {aLoading ? "Loading..." : "No data for period"}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={pnlDist} margin={{ top:5, right:5, bottom:20, left:5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="range" tick={{ fontSize:9, fill:"#64748b" }} axisLine={false} tickLine={false} angle={-30} textAnchor="end" />
                    <YAxis tick={{ fontSize:10, fill:"#64748b" }} axisLine={false} tickLine={false} width={24} />
                    <Tooltip content={<SimpleTooltip />} />
                    <Bar dataKey="count" radius={[2,2,0,0]}>
                      {pnlDist.map((b,i) => <Cell key={i} fill={b.isProfit?"#10b981":"#ef4444"} fillOpacity={0.75} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </WidgetCard>

            <WidgetCard title="By Hour" subtitle="Average P&L per UTC hour">
              {!mounted || timeAnalysis.length === 0 ? (
                <div className="h-36 flex items-center justify-center text-xs text-slate-600">
                  {aLoading ? "Loading..." : "No data for period"}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={timeAnalysis} margin={{ top:5, right:5, bottom:20, left:5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="hour" tick={{ fontSize:9, fill:"#64748b" }} axisLine={false} tickLine={false} angle={-45} textAnchor="end" />
                    <YAxis tick={{ fontSize:10, fill:"#64748b" }} tickFormatter={v=>`$${v}`} axisLine={false} tickLine={false} width={44} />
                    <Tooltip content={<SimpleTooltip />} />
                    <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" />
                    <Bar dataKey="avgPnl" radius={[2,2,0,0]}>
                      {timeAnalysis.map((h,i) => <Cell key={i} fill={h.avgPnl>=0?"#10b981":"#ef4444"} fillOpacity={0.75} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </WidgetCard>
          </div>

          {/* ── By Symbol ── */}
          <div className="bg-[#161b27] border border-white/5 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">By Symbol</h2>
              <span className="text-xs text-slate-500">{symbolBdown.length} symbols</span>
            </div>
            {symbolBdown.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-600">
                {aLoading ? "Loading..." : "No data for period"}
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/5">
                    {["Symbol","Trades","Win Rate","Avg P&L","Total P&L","Best","Worst"].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-slate-500 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {symbolBdown.map((row,i) => (
                    <tr key={row.symbol} className={`border-b border-white/5 hover:bg-white/[0.02] transition-colors ${i===symbolBdown.length-1?"border-0":""}`}>
                      <td className="px-4 py-3 font-semibold text-white">{row.symbol}</td>
                      <td className="px-4 py-3 text-slate-300">{row.count}</td>
                      <td className={`px-4 py-3 font-medium ${row.winRate>=0.5?"text-emerald-400":"text-red-400"}`}>{pct(row.winRate)}</td>
                      <td className={`px-4 py-3 font-mono ${pnlCls(row.avgPnl)}`}>{$(row.avgPnl)}</td>
                      <td className={`px-4 py-3 font-semibold font-mono ${pnlCls(row.totalPnl)}`}>{$(row.totalPnl)}</td>
                      <td className="px-4 py-3 text-emerald-400 font-mono">+${row.bestTrade.toFixed(2)}</td>
                      <td className="px-4 py-3 text-red-400 font-mono">-${Math.abs(row.worstTrade).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* ── Trade History Table ── */}
          <div className="bg-[#161b27] border border-white/5 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Trade History</h2>
              <span className="text-xs text-slate-500">{filtered.length} trades · page {page+1}/{totalPages}</span>
            </div>
            {pagedTrades.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-600">
                {aLoading ? "Loading..." : "No data for period"}
              </div>
            ) : (
              <>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/5">
                      {["Symbol","Dir","Qty","P&L","Entry","Exit","Closed"].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-slate-500 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pagedTrades.map((t,i) => (
                      <tr key={t.id} onClick={() => setSelectedTrade(t)}
                        className={`border-b border-white/5 hover:bg-white/[0.03] cursor-pointer transition-colors ${i===pagedTrades.length-1?"border-0":""}`}>
                        <td className="px-4 py-3 font-semibold text-white">{t.symbol}</td>
                        <td className={`px-4 py-3 font-medium ${t.direction==="LONG"?"text-emerald-400":"text-red-400"}`}>{t.direction}</td>
                        <td className="px-4 py-3 text-slate-300">{t.quantity}</td>
                        <td className={`px-4 py-3 font-mono font-semibold ${pnlCls(t.realizedPnl??0)}`}>{$(t.realizedPnl??0)}</td>
                        <td className="px-4 py-3 text-slate-400">{t.entryPrice?`$${t.entryPrice}`:"—"}</td>
                        <td className="px-4 py-3 text-slate-400">{t.exitPrice?`$${t.exitPrice}`:"—"}</td>
                        <td className="px-4 py-3 text-slate-500">{t.closedAt?.slice(0,16).replace("T"," ") ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 px-5 py-3 border-t border-white/5">
                    <button disabled={page===0} onClick={() => setPage(p=>p-1)}
                      className="px-3 py-1 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">← Prev</button>
                    <div className="flex gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_,i) => {
                        const p = Math.max(0, Math.min(totalPages-5, page-2)) + i;
                        return (
                          <button key={p} onClick={() => setPage(p)}
                            className={`w-7 h-7 rounded-lg text-xs transition-colors ${p===page?"bg-emerald-500/10 text-emerald-400 font-medium":"text-slate-500 hover:text-slate-300 hover:bg-white/5"}`}>
                            {p+1}
                          </button>
                        );
                      })}
                    </div>
                    <button disabled={page>=totalPages-1} onClick={() => setPage(p=>p+1)}
                      className="px-3 py-1 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">Next →</button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── Extra Metrics ── */}
          <div className="grid grid-cols-5 gap-3">
            {[
              { label:"Sharpe Ratio",  value: noData?"—":metrics.sharpeRatio.toFixed(2), cls: metrics.sharpeRatio>=1?"text-emerald-400":metrics.sharpeRatio>=0?"text-yellow-400":"text-red-400" },
              { label:"Max Drawdown",  value: noData?"—":`-$${metrics.maxDrawdown.toFixed(2)} (${metrics.maxDrawdownPct.toFixed(1)}%)`, cls: metrics.maxDrawdown>0?"text-red-400":"text-slate-400" },
              { label:"Avg Hold Time", value: noData?"—":metrics.avgHoldTimeHours<1?`${Math.round(metrics.avgHoldTimeHours*60)}m`:`${metrics.avgHoldTimeHours.toFixed(1)}h`, cls:"text-blue-400" },
              { label:"Best Trade",    value: noData?"—":`+$${metrics.largestWin.toFixed(2)}`, cls:"text-emerald-400" },
              { label:"Worst Trade",   value: noData?"—":`-$${Math.abs(metrics.largestLoss).toFixed(2)}`, cls:"text-red-400" },
              { label:"Avg Win",       value: noData?"—":`+$${metrics.avgWin.toFixed(2)}`, cls:"text-emerald-400" },
              { label:"Avg Loss",      value: noData?"—":`-$${metrics.avgLoss.toFixed(2)}`, cls:"text-red-400" },
              { label:"Win Streak",    value: noData?"—":String(metrics.maxConsecWins), cls:"text-emerald-400" },
              { label:"Loss Streak",   value: noData?"—":String(metrics.maxConsecLosses), cls:"text-red-400" },
              { label:"Total Trades",  value: noData?"—":String(metrics.totalTrades), cls:"text-white" },
            ].map(m => (
              <div key={m.label} className="bg-[#161b27] border border-white/5 rounded-xl p-3">
                <p className="text-[10px] text-slate-500 mb-1">{m.label}</p>
                <p className={`text-sm font-bold leading-tight ${m.cls}`}>{m.value}</p>
              </div>
            ))}
          </div>

        </main>
      </PageTransition>

      {/* Trade Detail Modal */}
      {selectedTrade && <TradeModal trade={selectedTrade} onClose={() => setSelectedTrade(null)} />}
    </AppShell>
  );
}
