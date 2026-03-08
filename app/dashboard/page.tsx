"use client";

import { useState, useEffect, useCallback } from "react";
import AppShell from "@/components/layout/AppShell";
import { BlockTimer } from "@/components/BlockTimer";
import { UnblockChat } from "@/components/unblock-chat";
import { PageTransition, CardGrid, CardTransition } from "@/components/ui/animations";
import { TimeFilter, type TimeRange } from "@/components/ui/time-filter";
import { useLang } from "@/context/language";
import { PageLoader } from "@/components/ui/page-loader";

type Account  = { id: string; broker: string; label: string | null; isBlocked: boolean; blockedUntil: string | null; blockReason: string | null; };
type Limits   = { dailyLossLimit: number; maxDrawdown: number; maxDailyTrades: number | null; maxConsecutiveLosses: number | null; };
type Usage    = { dailyPnl: number; dailyTradesCount: number; weeklyPnl: number; monthlyPnl: number; threeMonthPnl: number; allTimePnl: number; consecutiveLosses: number; };
type Trade    = { id: string; symbol: string; direction: string; status: string; entryPrice: number; exitPrice: number | null; quantity: number; realizedPnl: number | null; openedAt: string; closedAt: string | null; };
type Breach   = { id: string; breachType: string; severity: string; description: string | null; occurredAt: string; isAcknowledged: boolean; };
type StatsData  = { userId: string; accounts: Account[]; limits: Limits | null; hasLimits: boolean; usage: Usage; breachesToday: number; totalBreaches: number; recentBreaches: Breach[]; };
type LiveData   = { balance: number; dailyPnl: number; };

// ── Client-side Bybit balance fetch (bypasses Vercel IP block) ────────────────
async function fetchBybitBalance(accounts: Account[]): Promise<LiveData | null> {
  let totalBalance  = 0;
  let totalDailyPnl = 0;
  let fetched       = false;

  for (const acc of accounts) {
    if ((acc as unknown as { broker: string }).broker !== "BYBIT") continue;
    try {
      // Sign the wallet-balance request on the server (apiSecret stays server-side)
      const qs      = "accountType=UNIFIED";
      const signRes = await fetch("/api/bybit/sign", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ accountId: acc.id, queryString: qs }),
      });
      const sign = await signRes.json() as { ok: boolean; apiKey?: string; timestamp?: string; signature?: string; recvWindow?: string; isTestnet?: boolean };
      if (!sign.ok) continue;

      const baseUrl = sign.isTestnet ? "https://api-demo.bybit.com" : "https://api.bybit.com";
      const balRes  = await fetch(`${baseUrl}/v5/account/wallet-balance?${qs}`, {
        headers: {
          "X-BAPI-API-KEY":     sign.apiKey!,
          "X-BAPI-TIMESTAMP":   sign.timestamp!,
          "X-BAPI-SIGN":        sign.signature!,
          "X-BAPI-RECV-WINDOW": sign.recvWindow!,
        },
      });
      if (!balRes.headers.get("content-type")?.includes("application/json")) continue;
      const balData = await balRes.json() as { retCode: number; result?: { list?: { totalEquity?: string }[] } };
      if (balData.retCode !== 0) continue;

      totalBalance += parseFloat(balData.result?.list?.[0]?.totalEquity ?? "0");
      fetched = true;
    } catch { /* ignore */ }
  }

  return fetched ? { balance: totalBalance, dailyPnl: totalDailyPnl } : null;
}

const limitBar      = (pct: number) => pct >= 100 ? "bg-red-500" : pct >= 70 ? "bg-yellow-400" : "bg-emerald-500";
const severityBadge = (s: string) => s === "CRITICAL" ? "bg-red-500/20 text-red-400 border-red-500/30" : s === "VIOLATION" ? "bg-orange-500/20 text-orange-400 border-orange-500/30" : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
const pnlFmt        = (v: number) => { const a = Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 0 }); return (v >= 0 ? "+" : "-") + "$" + a; };
const fmtTime       = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

function StatSkeleton() {
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

export default function Dashboard() {
  const { lang } = useLang();
  const t = (en: string, ru: string) => lang === "en" ? en : ru;

  const [timeRange,       setTimeRange]       = useState<TimeRange>("today");
  const [showUnblockChat, setShowUnblockChat] = useState(false);
  const [stats,           setStats]           = useState<StatsData | null>(null);
  const [live,            setLive]            = useState<LiveData | null>(null);
  const [trades,          setTrades]          = useState<Trade[]>([]);
  const [loading,         setLoading]         = useState(true);

  // Safety net: если через 15 секунд страница ещё в skeleton — снимаем принудительно
  useEffect(() => {
    const tid = setTimeout(() => setLoading(false), 15_000);
    return () => clearTimeout(tid);
  }, []);

  const loadAll = useCallback(async () => {
    const withTimeout = (p: Promise<Response>, ms: number) =>
      Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

    let statsData: StatsData | null = null;
    let tradesData: Trade[] = [];

    // Fetch stats + trades in parallel
    const doFetch = async () => Promise.all([
      (async () => {
        try {
          const sr = await withTimeout(fetch("/api/stats"), 10_000);
          const sj = await sr.json() as { ok: boolean } & StatsData;
          if (sj.ok) statsData = sj;
          return sr.status;
        } catch (e) { console.error("[Dashboard] stats:", e); return 500; }
      })(),
      (async () => {
        try {
          const tr = await withTimeout(fetch("/api/trades?limit=6"), 8_000);
          const tj = await tr.json() as { ok: boolean; trades: Trade[] };
          if (tj.ok) tradesData = tj.trades;
        } catch (e) { console.error("[Dashboard] trades:", e); }
      })(),
    ]);

    const [statsStatus] = await doFetch();

    // Если 401 — setup + один retry
    if (statsStatus === 401 && !statsData) {
      try { await withTimeout(fetch("/api/setup"), 3000); } catch { /* ignore */ }
      statsData = null; tradesData = [];
      await doFetch();
    }

    setStats(statsData);
    setTrades(tradesData);
    setLoading(false);

    // Fetch live balance client-side — Bybit blocks Vercel IPs so we must call from browser
    const accs = (statsData as StatsData | null)?.accounts;
    if (accs && accs.length > 0) {
      fetchBybitBalance(accs)
        .then(ld => { if (ld) setLive(ld); })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    loadAll();
    const onSynced = () => loadAll();
    window.addEventListener("tradeguard:synced", onSynced);
    const iv = setInterval(loadAll, 120_000);
    return () => { clearInterval(iv); window.removeEventListener("tradeguard:synced", onSynced); };
  }, [loadAll]);

  const u   = stats?.usage;
  const lim = stats?.limits;
  // Live daily PnL: prefer broker data if it's more current than DB
  const effectiveDailyPnl = live !== null
    ? (Math.abs(live.dailyPnl) > Math.abs(u?.dailyPnl ?? 0) ? live.dailyPnl : (u?.dailyPnl ?? 0))
    : (u?.dailyPnl ?? 0);
  const blockedAccount = stats?.accounts.find(a => a.isBlocked) ?? null;
  const blocked = blockedAccount !== null;

  const dailyLossPct  = lim && u ? Math.min(Math.abs(Math.min(u.dailyPnl, 0))  / lim.dailyLossLimit * 100, 100) : 0;
  const weeklyLossPct = lim && u ? Math.min(Math.abs(Math.min(u.weeklyPnl, 0)) / lim.maxDrawdown    * 100, 100) : 0;
  const tradePct      = lim?.maxDailyTrades && u ? Math.min(u.dailyTradesCount / lim.maxDailyTrades * 100, 100) : 0;
  const consecPct     = lim?.maxConsecutiveLosses && u ? Math.min(u.consecutiveLosses / lim.maxConsecutiveLosses * 100, 100) : 0;

  const periodPnl: Record<TimeRange, number> = {
    today: effectiveDailyPnl, week: u?.weeklyPnl ?? 0, month: u?.monthlyPnl ?? 0,
    "3months": u?.threeMonthPnl ?? 0, all: u?.allTimePnl ?? 0,
  };
  const periodLbl: Record<TimeRange, [string, string]> = {
    today: ["today","сегодня"], week: ["this week","за неделю"], month: ["this month","за месяц"],
    "3months": ["3 months","за 3 мес."], all: ["all time","за всё время"],
  };
  const pl = periodLbl[timeRange][lang === "en" ? 0 : 1];
  const pnl = periodPnl[timeRange];
  const sevLabel = (s: string) => s === "CRITICAL" ? t("Critical","Критично") : s === "VIOLATION" ? t("Violation","Нарушение") : t("Warning","Предупреждение");

  // First-load full-screen spinner (stats never loaded yet)
  if (loading && stats === null) {
    return (
      <AppShell>
        <PageLoader />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageTransition>
        <main className="flex-1 overflow-auto p-4 md:p-6 space-y-4 md:space-y-6">

          {/* Only show when stats loaded successfully but accounts array is empty */}
          {!loading && stats !== null && stats.accounts.length === 0 && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-center gap-3">
              <span className="text-blue-400 text-lg">ℹ️</span>
              <p className="text-sm text-blue-400 font-semibold">{t("No connected accounts — ","Нет подключённых аккаунтов — ")}<a href="/connect" className="underline">{t("connect a broker","подключите биржу")}</a></p>
            </div>
          )}
          {!loading && stats !== null && !stats.hasLimits && stats.accounts.length > 0 && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 flex items-center gap-3">
              <span className="text-yellow-400 text-lg">⚠️</span>
              <p className="text-sm text-yellow-400 font-semibold">{t("Limits not set — ","Лимиты не установлены — ")}<a href="/limits" className="underline">{t("set limits","установите лимиты")}</a></p>
            </div>
          )}
          {!loading && blocked && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
              <span className="text-red-400 text-lg mt-0.5">🚨</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-400">🔴 {t("Trading Blocked","Торговля заблокирована")}</p>
                <p className="text-xs text-slate-400 mt-0.5">{blockedAccount?.blockReason ?? t("Trading limit violation","Нарушение торговых лимитов")}</p>
                {blockedAccount?.blockedUntil && <p className="text-xs text-slate-500 mt-1.5">{t("Unblocks in: ","Разблокировка через: ")}<BlockTimer blockedUntil={blockedAccount.blockedUntil} /></p>}
                <button onClick={() => setShowUnblockChat(true)} className="mt-3 text-xs border border-slate-600 text-slate-300 hover:border-slate-400 hover:text-white rounded-lg px-4 py-1.5 transition-colors">
                  {t("Request Early Unblock","Запросить досрочную разблокировку")}
                </button>
              </div>
            </div>
          )}

          {showUnblockChat && stats?.userId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowUnblockChat(false)}>
              <div className="w-full max-w-md bg-[#161b27] border border-white/10 rounded-xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                <UnblockChat userId={stats.userId} blockReason={blockedAccount?.blockReason ?? null} blockedUntil={blockedAccount?.blockedUntil ?? null} onClose={() => setShowUnblockChat(false)} />
              </div>
            </div>
          )}

          {/* Time filter */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">{t("Showing data for:","Данные за:")}</p>
            <TimeFilter value={timeRange} onChange={setTimeRange} lang={lang} />
          </div>

          {/* Stat cards */}
          {loading ? (
            <CardGrid className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {[0,1,2,3].map(i => <StatSkeleton key={i} />)}
            </CardGrid>
          ) : (
            <CardGrid className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {[
                { label: t("Daily P&L","Дневной P&L"),       value: (u || live) ? pnlFmt(effectiveDailyPnl) : "—", sub: lim ? `${t("Limit","Лимит")}: $${lim.dailyLossLimit.toLocaleString()}` : t("No limit","Лимит не задан"), pct: lim ? Math.round(Math.min(Math.abs(Math.min(effectiveDailyPnl, 0)) / lim.dailyLossLimit * 100, 100)) : 0, color: effectiveDailyPnl >= 0 ? "text-emerald-400" : "text-red-400", barCls: limitBar(lim ? Math.min(Math.abs(Math.min(effectiveDailyPnl, 0)) / lim.dailyLossLimit * 100, 100) : 0), icon: "📉" },
                { label: t("Weekly P&L","Недельный P&L"),    value: u ? pnlFmt(u.weeklyPnl) : "—", sub: lim ? `${t("Drawdown","Просадка")}: $${lim.maxDrawdown.toLocaleString()}` : t("No limit","Лимит не задан"), pct: Math.round(weeklyLossPct), color: (u?.weeklyPnl ?? 0) >= 0 ? "text-emerald-400" : "text-yellow-400", barCls: limitBar(weeklyLossPct), icon: "⚠️" },
                { label: t("Trades Today","Сделок сегодня"), value: lim?.maxDailyTrades ? `${u?.dailyTradesCount ?? 0} / ${lim.maxDailyTrades}` : String(u?.dailyTradesCount ?? 0), sub: `${t("Loss streak","Серия убытков")}: ${u?.consecutiveLosses ?? 0}`, pct: Math.round(tradePct), color: "text-blue-400", barCls: limitBar(tradePct), icon: "🔁" },
                { label: t("Balance","Баланс"),               value: live ? `$${live.balance.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : String(stats?.accounts.length ?? 0), sub: blocked ? `⛔ ${t("Trading blocked","Торговля заблокирована")}` : live ? `${stats?.accounts.length ?? 0} ${t("account(s) · Live","акк. · Онлайн")}` : t("Monitoring active","Мониторинг активен"), pct: 100, color: blocked ? "text-red-400" : "text-emerald-400", barCls: blocked ? "bg-red-500" : "bg-emerald-500", icon: "💼" },
              ].map(s => (
                <CardTransition key={s.label}>
                  <div className="bg-[#161b27] border border-white/5 rounded-xl p-4 h-full">
                    <div className="flex items-center justify-between mb-3"><p className="text-xs text-slate-500">{s.label}</p><span className="text-base">{s.icon}</span></div>
                    <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{s.sub}</p>
                    <div className="mt-3 h-1.5 bg-white/5 rounded-full overflow-hidden"><div className={`h-full rounded-full ${s.barCls}`} style={{ width: `${s.pct}%` }} /></div>
                    <p className="text-[10px] text-slate-600 mt-1">{s.pct}% {t("used","использовано")}</p>
                  </div>
                </CardTransition>
              ))}
            </CardGrid>
          )}

          {/* Middle row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-[#161b27] border border-white/5 rounded-xl p-4">
              <h2 className="text-sm font-semibold text-white mb-1">{t("P&L","P&L")} · {pl}</h2>
              <p className="text-xs text-slate-500 mb-4">{t("Cumulative result","Накопленный результат")}</p>
              <div className="h-40 flex items-center justify-center">
                {loading ? (
                  <div className="h-12 w-40 bg-white/5 rounded animate-pulse" />
                ) : (
                  <div className="text-center">
                    <p className={`text-5xl font-bold tabular-nums ${pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>{pnlFmt(pnl)}</p>
                    <p className="text-sm text-slate-500 mt-2">{pl} · {u?.dailyTradesCount ?? 0} {t("trades today","сдел. сегодня")}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-[#161b27] border border-white/5 rounded-xl p-4">
              <h2 className="text-sm font-semibold text-white mb-4">{t("Limit Status","Статус лимитов")}</h2>
              {loading ? (
                <div className="space-y-4">{[0,1,2,3].map(i => <div key={i} className="space-y-1.5"><div className="h-2 bg-white/5 rounded animate-pulse" /><div className="h-1.5 bg-white/5 rounded-full animate-pulse" /></div>)}</div>
              ) : !stats?.hasLimits ? (
                <div className="text-center py-6"><p className="text-xs text-slate-500">{t("Limits not set","Лимиты не установлены")}</p><a href="/limits" className="text-xs text-emerald-400 hover:underline mt-1 block">{t("Set up →","Установить →")}</a></div>
              ) : (
                <div className="space-y-4">
                  {[
                    { label: t("Daily Loss","Дневной убыток"),       pct: dailyLossPct,  val: u ? `$${Math.abs(Math.min(u.dailyPnl,0)).toFixed(0)}`  : "—", lmt: lim ? `$${lim.dailyLossLimit}` : "—" },
                    { label: t("Weekly Drawdown","Просадка (нед.)"), pct: weeklyLossPct, val: u ? `$${Math.abs(Math.min(u.weeklyPnl,0)).toFixed(0)}` : "—", lmt: lim ? `$${lim.maxDrawdown}` : "—" },
                    { label: t("Trade Count","Кол-во сделок"),       pct: tradePct, val: String(u?.dailyTradesCount ?? 0), lmt: lim?.maxDailyTrades ? String(lim.maxDailyTrades) : "—" },
                    { label: t("Loss Streak","Серия убытков"),       pct: consecPct, val: String(u?.consecutiveLosses ?? 0), lmt: lim?.maxConsecutiveLosses ? String(lim.maxConsecutiveLosses) : "—" },
                  ].map(l => (
                    <div key={l.label}>
                      <div className="flex justify-between text-xs mb-1"><span className="text-slate-400">{l.label}</span><span className={`font-medium ${l.pct >= 100 ? "text-red-400" : l.pct >= 70 ? "text-yellow-400" : "text-slate-300"}`}>{l.val} / {l.lmt}</span></div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all ${limitBar(l.pct)}`} style={{ width: `${Math.min(l.pct,100)}%` }} /></div>
                    </div>
                  ))}
                </div>
              )}
              {!loading && blocked && (
                <div className="mt-5 bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-center">
                  <p className="text-xs font-semibold text-red-400">🔒 {t("Trading Blocked","Торговля заблокирована")}</p>
                  {blockedAccount?.blockedUntil && <p className="text-xs text-slate-500 mt-1">{t("Unblocks in:","Разблокировка через:")} <BlockTimer blockedUntil={blockedAccount.blockedUntil} /></p>}
                </div>
              )}
            </div>
          </div>

          {/* Bottom row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-[#161b27] border border-white/5 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">{t("Recent Trades","Последние сделки")}</h2>
                <a href="/journal" className="text-xs text-emerald-400 hover:text-emerald-300">Analytics →</a>
              </div>
              {loading ? (
                <div className="p-4 space-y-2">{[0,1,2].map(i => <div key={i} className="h-10 bg-white/5 rounded animate-pulse" />)}</div>
              ) : trades.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">{t("No trades. Click \"Sync\" to load.","Нет сделок. Нажмите «Синхр.»")}</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b border-white/5">{[t("Instrument","Инструмент"),t("Direction","Направление"),t("Entry","Вход"),t("Exit","Выход"),t("Qty","Объём"),t("P&L","P&L"),t("Status","Статус")].map(h=><th key={h} className="px-4 py-2.5 text-left text-slate-500 font-medium whitespace-nowrap">{h}</th>)}</tr></thead>
                    <tbody>
                      {trades.map((tr, i) => (
                        <tr key={tr.id} className={`border-b border-white/5 hover:bg-white/[0.02] ${i===trades.length-1?"border-0":""}`}>
                          <td className="px-4 py-3 font-semibold text-white whitespace-nowrap">{tr.symbol}</td>
                          <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${tr.direction==="LONG"?"bg-emerald-500/15 text-emerald-400":"bg-red-500/15 text-red-400"}`}>{tr.direction}</span></td>
                          <td className="px-4 py-3 text-slate-300 font-mono whitespace-nowrap">{tr.entryPrice.toLocaleString()}</td>
                          <td className="px-4 py-3 text-slate-300 font-mono whitespace-nowrap">{tr.exitPrice ? tr.exitPrice.toLocaleString() : <span className="text-slate-600">—</span>}</td>
                          <td className="px-4 py-3 text-slate-400">{tr.quantity}</td>
                          <td className={`px-4 py-3 font-semibold font-mono whitespace-nowrap ${(tr.realizedPnl??0)>=0?"text-emerald-400":"text-red-400"}`}>{(tr.realizedPnl??0)>=0?"+":"-"}${Math.abs(tr.realizedPnl??0).toFixed(2)}</td>
                          <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-[10px] font-medium ${tr.status==="OPEN"?"bg-blue-500/15 text-blue-400":"bg-slate-500/15 text-slate-400"}`}>{tr.status==="OPEN"?t("Open","Открыта"):t("Closed","Закрыта")}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="bg-[#161b27] border border-white/5 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">{t("Violations","Нарушения")}</h2>
                <span className="text-[10px] text-slate-500">{stats?.breachesToday ?? 0} {t("today","сегодня")}</span>
              </div>
              <div className="p-3 space-y-2">
                {loading
                  ? [0,1,2].map(i => <div key={i} className="h-16 bg-white/5 rounded animate-pulse" />)
                  : (stats?.recentBreaches??[]).length === 0
                    ? <p className="text-xs text-slate-600 text-center py-4">{t("No violations","Нарушений нет")}</p>
                    : (stats?.recentBreaches??[]).map(b=>(
                        <div key={b.id} className={`rounded-lg border p-3 ${severityBadge(b.severity)}`}>
                          <div className="flex items-center justify-between mb-1"><span className="text-[10px] font-semibold uppercase tracking-wide">{sevLabel(b.severity)}</span><span className="text-[10px] opacity-60">{fmtTime(b.occurredAt)}</span></div>
                          <p className="text-xs leading-snug opacity-90">{b.description??b.breachType}</p>
                        </div>
                      ))
                }
                <div className="text-center pt-2"><a href="/breaches" className="text-[10px] text-emerald-400 hover:text-emerald-300">{t("All violations →","Все нарушения →")}</a></div>
              </div>
            </div>
          </div>

        </main>
      </PageTransition>
    </AppShell>
  );
}
