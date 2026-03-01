/**
 * lib/analytics.ts — вычисление торговых метрик из массива сделок.
 * Все функции — чистые, принимают Trade[] и возвращают данные для графиков.
 */

export type ATrade = {
  symbol:      string;
  direction:   string;
  realizedPnl: number | null;
  openedAt:    string;
  closedAt:    string | null;
};

// ─── Equity Curve ─────────────────────────────────────────────────────────────

export type EquityPoint = {
  idx:    number;   // порядковый номер сделки
  date:   string;   // "2024-01-15"
  time:   string;   // "2024-01-15 14:32 UTC" для tooltip
  symbol: string;
  pnl:    number;   // P&L этой сделки
  cumPnl: number;   // накопленный P&L
};

export function calcEquityCurve(trades: ATrade[]): EquityPoint[] {
  const closed = [...trades]
    .filter(t => t.closedAt && t.realizedPnl !== null)
    .sort((a, b) => new Date(a.closedAt!).getTime() - new Date(b.closedAt!).getTime());

  let cum = 0;
  return closed.map((t, idx) => {
    cum += t.realizedPnl!;
    const dt  = new Date(t.closedAt!);
    const hh  = dt.getUTCHours().toString().padStart(2, "0");
    const mm  = dt.getUTCMinutes().toString().padStart(2, "0");
    return {
      idx,
      date:   t.closedAt!.slice(0, 10),
      time:   `${t.closedAt!.slice(0, 10)} ${hh}:${mm} UTC`,
      symbol: t.symbol,
      pnl:    parseFloat(t.realizedPnl!.toFixed(2)),
      cumPnl: parseFloat(cum.toFixed(2)),
    };
  });
}

// ─── Key Metrics ──────────────────────────────────────────────────────────────

export type MetricsResult = {
  netPnl:           number;
  totalTrades:      number;
  winners:          number;
  losers:           number;
  winRate:          number;       // 0–1
  profitFactor:     number;       // sumWins / sumLosses (999 = no losses)
  avgWin:           number;
  avgLoss:          number;
  largestWin:       number;
  largestLoss:      number;
  maxDrawdown:      number;       // $ от пика
  maxDrawdownPct:   number;       // % от пика
  avgHoldTimeHours: number;
  expectancy:       number;       // (WR × avgWin) − (LR × avgLoss)
  sharpeRatio:      number;       // упрощённый аннуализированный
  maxConsecWins:    number;
  maxConsecLosses:  number;
};

const EMPTY_METRICS: MetricsResult = {
  netPnl: 0, totalTrades: 0, winners: 0, losers: 0, winRate: 0,
  profitFactor: 0, avgWin: 0, avgLoss: 0, largestWin: 0, largestLoss: 0,
  maxDrawdown: 0, maxDrawdownPct: 0, avgHoldTimeHours: 0,
  expectancy: 0, sharpeRatio: 0, maxConsecWins: 0, maxConsecLosses: 0,
};

export function calcMetrics(trades: ATrade[]): MetricsResult {
  const closed = trades.filter(t => t.closedAt && t.realizedPnl !== null);
  if (!closed.length) return { ...EMPTY_METRICS };

  const sortedByTime = [...closed].sort(
    (a, b) => new Date(a.closedAt!).getTime() - new Date(b.closedAt!).getTime()
  );
  const pnls    = sortedByTime.map(t => t.realizedPnl!);
  const wins    = pnls.filter(p => p > 0);
  const losses  = pnls.filter(p => p <= 0);

  const netPnl      = pnls.reduce((s, p) => s + p, 0);
  const winRate     = wins.length / pnls.length;
  const sumWins     = wins.reduce((s, p) => s + p, 0);
  const sumLosses   = Math.abs(losses.reduce((s, p) => s + p, 0));
  const profitFactor = sumLosses > 0 ? sumWins / sumLosses : sumWins > 0 ? 999 : 0;
  const avgWin      = wins.length ? sumWins / wins.length : 0;
  const avgLoss     = losses.length ? sumLosses / losses.length : 0;
  const largestWin  = wins.length ? Math.max(...wins) : 0;
  const largestLoss = losses.length ? Math.min(...losses) : 0;

  // Max drawdown from equity curve
  const eq    = calcEquityCurve(closed);
  let peak    = 0, maxDD = 0;
  for (const pt of eq) {
    if (pt.cumPnl > peak) peak = pt.cumPnl;
    const dd = peak - pt.cumPnl;
    if (dd > maxDD) maxDD = dd;
  }
  const maxDrawdownPct = peak > 0 ? (maxDD / peak) * 100 : 0;

  // Avg hold time (hours)
  const holdTimes = closed
    .filter(t => t.openedAt && t.closedAt)
    .map(t => (new Date(t.closedAt!).getTime() - new Date(t.openedAt).getTime()) / 3_600_000);
  const avgHoldTimeHours = holdTimes.length
    ? holdTimes.reduce((s, h) => s + h, 0) / holdTimes.length : 0;

  // Expectancy
  const expectancy = winRate * avgWin - (1 - winRate) * avgLoss;

  // Simplified Sharpe (annualised): avgDailyPnl / stdDev(dailyPnl) × √252
  const byDay = new Map<string, number>();
  for (const t of closed) {
    const d = t.closedAt!.slice(0, 10);
    byDay.set(d, (byDay.get(d) ?? 0) + t.realizedPnl!);
  }
  const dailyPnls = Array.from(byDay.values());
  let sharpeRatio = 0;
  if (dailyPnls.length > 1) {
    const avg = dailyPnls.reduce((s, p) => s + p, 0) / dailyPnls.length;
    const std = Math.sqrt(dailyPnls.reduce((s, p) => s + (p - avg) ** 2, 0) / dailyPnls.length);
    sharpeRatio = std > 0 ? (avg / std) * Math.sqrt(252) : 0;
  }

  // Consecutive wins / losses
  let maxConsecWins = 0, maxConsecLosses = 0, curW = 0, curL = 0;
  for (const p of pnls) {
    if (p > 0) { curW++; curL = 0; if (curW > maxConsecWins) maxConsecWins = curW; }
    else        { curL++; curW = 0; if (curL > maxConsecLosses) maxConsecLosses = curL; }
  }

  return {
    netPnl, totalTrades: pnls.length, winners: wins.length, losers: losses.length,
    winRate, profitFactor, avgWin, avgLoss, largestWin, largestLoss,
    maxDrawdown: maxDD, maxDrawdownPct, avgHoldTimeHours, expectancy, sharpeRatio,
    maxConsecWins, maxConsecLosses,
  };
}

// ─── P&L Distribution ─────────────────────────────────────────────────────────

export type PnLBucket = { range: string; count: number; isProfit: boolean };

export function calcPnLDistribution(trades: ATrade[]): PnLBucket[] {
  const pnls = trades.filter(t => t.realizedPnl !== null).map(t => t.realizedPnl!);
  if (!pnls.length) return [];

  const absMax = Math.max(...pnls.map(Math.abs));
  const range  = Math.max(...pnls) - Math.min(...pnls) || 1;
  const rawStep = range / 12;
  const mag  = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const step = Math.max(Math.ceil(rawStep / mag) * mag, 1);

  const minB = Math.floor(Math.min(...pnls) / step) * step;
  const maxB = Math.floor(Math.max(...pnls) / step) * step;

  const buckets = new Map<number, number>();
  for (let b = minB; b <= maxB; b += step) buckets.set(b, 0);
  for (const p of pnls) {
    const b = Math.floor(p / step) * step;
    buckets.set(b, (buckets.get(b) ?? 0) + 1);
  }

  void absMax;
  return Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([start, count]) => ({
      range:    `${start >= 0 ? "+" : ""}$${start}`,
      count,
      isProfit: start >= 0,
    }));
}

// ─── Time Analysis (avg P&L by UTC hour) ──────────────────────────────────────

export type HourData = { hour: string; avgPnl: number; count: number };

export function calcTimeAnalysis(trades: ATrade[]): HourData[] {
  const byHour = new Map<number, { sum: number; count: number }>();
  for (const t of trades) {
    if (!t.closedAt || t.realizedPnl === null) continue;
    const h   = new Date(t.closedAt).getUTCHours();
    const cur = byHour.get(h) ?? { sum: 0, count: 0 };
    byHour.set(h, { sum: cur.sum + t.realizedPnl, count: cur.count + 1 });
  }
  return Array.from({ length: 24 }, (_, h) => {
    const d = byHour.get(h);
    return { hour: `${String(h).padStart(2, "0")}:00`, avgPnl: d ? parseFloat((d.sum / d.count).toFixed(2)) : 0, count: d?.count ?? 0 };
  }).filter(d => d.count > 0);
}

// ─── Symbol Breakdown ─────────────────────────────────────────────────────────

export type SymbolRow = {
  symbol: string; count: number; winRate: number;
  avgPnl: number; totalPnl: number; bestTrade: number; worstTrade: number;
};

export function calcSymbolBreakdown(trades: ATrade[]): SymbolRow[] {
  const bySymbol = new Map<string, ATrade[]>();
  for (const t of trades) {
    if (t.realizedPnl === null) continue;
    if (!bySymbol.has(t.symbol)) bySymbol.set(t.symbol, []);
    bySymbol.get(t.symbol)!.push(t);
  }
  return Array.from(bySymbol.entries())
    .map(([symbol, ts]) => {
      const pnls = ts.map(t => t.realizedPnl!);
      const wins = pnls.filter(p => p > 0).length;
      const total = pnls.reduce((s, p) => s + p, 0);
      return {
        symbol, count: ts.length,
        winRate:    ts.length ? wins / ts.length : 0,
        avgPnl:     parseFloat((total / pnls.length).toFixed(2)),
        totalPnl:   parseFloat(total.toFixed(2)),
        bestTrade:  Math.max(...pnls),
        worstTrade: Math.min(...pnls),
      };
    })
    .sort((a, b) => Math.abs(b.totalPnl) - Math.abs(a.totalPnl));
}

// ─── Weekday Stats (avg P&L by day of week) ───────────────────────────────────

export type WeekdayData = { day: string; avgPnl: number; count: number };
const WEEKDAYS_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export function calcWeekdayStats(trades: ATrade[]): WeekdayData[] {
  const byDay = new Map<number, { sum: number; count: number }>();
  for (const t of trades) {
    if (!t.closedAt || t.realizedPnl === null) continue;
    let dow = new Date(t.closedAt).getUTCDay();
    dow = dow === 0 ? 6 : dow - 1; // Mon=0
    const cur = byDay.get(dow) ?? { sum: 0, count: 0 };
    byDay.set(dow, { sum: cur.sum + t.realizedPnl, count: cur.count + 1 });
  }
  return WEEKDAYS_RU.map((day, i) => {
    const d = byDay.get(i);
    return { day, avgPnl: d ? parseFloat((d.sum / d.count).toFixed(2)) : 0, count: d?.count ?? 0 };
  });
}
