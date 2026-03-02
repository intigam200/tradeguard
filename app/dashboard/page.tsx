"use client";

import { useState, useEffect, useCallback } from "react";
import AppShell from "@/components/layout/AppShell";
import { BlockTimer } from "@/components/BlockTimer";
import { UnblockChat } from "@/components/unblock-chat";
import { PageTransition, CardGrid, CardTransition } from "@/components/ui/animations";
import { useLang } from "@/context/language";

type Account = { id: string; broker: string; label: string | null; isBlocked: boolean; blockedUntil: string | null; blockReason: string | null; };
type Limits  = { dailyLossLimit: number; maxDrawdown: number; maxDailyTrades: number | null; maxConsecutiveLosses: number | null; };
type Usage   = { dailyPnl: number; dailyTradesCount: number; weeklyPnl: number; monthlyPnl: number; consecutiveLosses: number; };
type Trade   = { id: string; symbol: string; direction: string; status: string; entryPrice: number; exitPrice: number | null; quantity: number; realizedPnl: number | null; openedAt: string; closedAt: string | null; };
type Breach  = { id: string; breachType: string; severity: string; description: string | null; occurredAt: string; isAcknowledged: boolean; };
type StatsData = { userId: string; accounts: Account[]; limits: Limits | null; hasLimits: boolean; usage: Usage; breachesToday: number; totalBreaches: number; recentBreaches: Breach[]; };

const limitBar = (pct: number) => pct >= 100 ? "bg-red-500" : pct >= 70 ? "bg-yellow-400" : "bg-emerald-500";
const severityBadge = (s: string) => s === "CRITICAL" ? "bg-red-500/20 text-red-400 border-red-500/30" : s === "VIOLATION" ? "bg-orange-500/20 text-orange-400 border-orange-500/30" : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
const pnlFmt = (v: number) => { const abs = Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 0 }); return (v >= 0 ? "+" : "-") + "$" + abs; };
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

export default function Dashboard() {
  const { lang, setLang } = useLang();
  const t = (en: string, ru: string) => lang === "en" ? en : ru;

  const [activePeriod, setActivePeriod] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUnblockChat,   setShowUnblockChat]   = useState(false);
  const [stats, setStats]   = useState<StatsData | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    try {
      const [statsRes, tradesRes] = await Promise.all([fetch("/api/stats"), fetch("/api/trades?limit=6")]);
      const sj = await statsRes.json() as { ok: boolean } & StatsData;
      const tj = await tradesRes.json() as { ok: boolean; trades: Trade[] };
      if (sj.ok)  setStats(sj);
      if (tj.ok) setTrades(tj.trades);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await fetch("/api/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      await loadAll();
    } finally { setSyncing(false); }
  };

  const u       = stats?.usage;
  const lim     = stats?.limits;
  const blockedAccount = stats?.accounts.find(a => a.isBlocked) ?? null;
  const blocked = blockedAccount !== null;
  const dailyLossPct  = lim && u ? Math.min(Math.abs(Math.min(u.dailyPnl, 0)) / lim.dailyLossLimit * 100, 100) : 0;
  const weeklyLossPct = lim && u ? Math.min(Math.abs(Math.min(u.weeklyPnl, 0)) / lim.maxDrawdown * 100, 100) : 0;
  const tradePct      = lim?.maxDailyTrades && u ? Math.min(u.dailyTradesCount / lim.maxDailyTrades * 100, 100) : 0;
  const consecPct     = lim?.maxConsecutiveLosses && u ? Math.min(u.consecutiveLosses / lim.maxConsecutiveLosses * 100, 100) : 0;
  const periodPnl     = [u?.dailyPnl, u?.weeklyPnl, u?.monthlyPnl][activePeriod] ?? 0;
  const today = new Date().toLocaleDateString(lang === "en" ? "en-US" : "ru-RU", { day: "numeric", month: "long", year: "numeric", weekday: "long" });
  const riskLevel = dailyLossPct >= 100 ? t("Blocked", "Блокировка") : dailyLossPct >= 80 ? t("Critical Risk", "Критический риск") : dailyLossPct >= 50 ? t("High Risk", "Повышенный риск") : t("Normal", "Норма");
  const riskColor = dailyLossPct >= 80 ? "text-red-400 bg-red-400/10 border-red-400/20" : dailyLossPct >= 50 ? "text-yellow-400 bg-yellow-400/10 border-yellow-400/20" : "text-emerald-400 bg-emerald-400/10 border-emerald-400/20";

  const severityLabel = (s: string) => s === "CRITICAL" ? t("Critical", "Критично") : s === "VIOLATION" ? t("Violation", "Нарушение") : t("Warning", "Предупреждение");

  const periods = [t("Day", "День"), t("Week", "Неделя"), t("Month", "Месяц")];
  const periodLabels = [t("Today", "Сегодня"), t("This week", "За эту неделю"), t("This month", "За этот месяц")];

  return (
    <AppShell>
      <PageTransition>

        <header className="h-14 border-b border-white/5 px-4 md:px-6 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-sm font-semibold text-white">{t("Dashboard", "Дашборд")}</h1>
            <p className="text-xs text-slate-500 capitalize hidden sm:block">{today}</p>
          </div>
          <div className="flex items-center gap-2 md:gap-3 relative">
            <button onClick={handleSync} disabled={syncing}
              className="text-xs px-2 md:px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 transition-colors disabled:opacity-50">
              {syncing ? t("⟳ Syncing...", "⟳ Синхрон...") : t("⟳ Sync", "⟳ Синхронизировать")}
            </button>
            <span className={`hidden sm:flex items-center gap-1.5 text-xs font-medium border px-3 py-1 rounded-full ${riskColor}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />{riskLevel}
            </span>
            {/* Language toggle */}
            <button
              onClick={() => setLang(lang === "en" ? "ru" : "en")}
              className="text-xs px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 transition-colors font-medium"
            >
              {lang === "en" ? "RU" : "EN"}
            </button>
            <button onClick={() => setShowNotifications(!showNotifications)}
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 transition-colors text-sm relative">
              🔔
              {(stats?.breachesToday ?? 0) > 0 && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full text-[8px] text-white flex items-center justify-center">
                  {(stats?.breachesToday ?? 0) > 9 ? "9+" : stats?.breachesToday}
                </span>
              )}
            </button>
            {showNotifications && (
              <div className="absolute right-0 top-10 w-72 bg-[#1e2534] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">{t("Notifications", "Уведомления")}</h3>
                  <button onClick={() => setShowNotifications(false)} className="text-slate-500 hover:text-slate-300 text-xs">✕</button>
                </div>
                <div className="divide-y divide-white/5 max-h-60 overflow-auto">
                  {(stats?.recentBreaches ?? []).length === 0 && <p className="px-4 py-3 text-xs text-slate-500">{t("No violations", "Нарушений нет")}</p>}
                  {(stats?.recentBreaches ?? []).map(b => (
                    <div key={b.id} className="px-4 py-3">
                      <p className="text-xs text-slate-300">{b.description ?? b.breachType}</p>
                      <p className="text-[10px] text-slate-500 mt-1">{fmtTime(b.occurredAt)}</p>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-2 border-t border-white/5">
                  <a href="/breaches" className="text-xs text-emerald-400 hover:text-emerald-300">{t("All violations →", "Все нарушения →")}</a>
                </div>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-6 space-y-4 md:space-y-6">
          {loading ? (
            <div className="text-center py-20 text-slate-600 text-sm">{t("Loading...", "Загрузка...")}</div>
          ) : (
            <>
              {(stats?.accounts ?? []).length === 0 && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-center gap-3">
                  <span className="text-blue-400 text-lg">ℹ️</span>
                  <p className="text-sm text-blue-400 font-semibold">{t("No connected accounts — ", "Нет подключённых аккаунтов — ")}<a href="/connect" className="underline">{t("connect a broker", "подключите биржу")}</a></p>
                </div>
              )}
              {!stats?.hasLimits && (stats?.accounts ?? []).length > 0 && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 flex items-center gap-3">
                  <span className="text-yellow-400 text-lg">⚠️</span>
                  <p className="text-sm text-yellow-400 font-semibold">{t("Limits not set — ", "Лимиты не установлены — ")}<a href="/limits" className="underline">{t("set limits", "установите лимиты")}</a></p>
                </div>
              )}
              {blocked && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
                  <span className="text-red-400 text-lg mt-0.5">🚨</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-red-400">🔴 {t("Trading Blocked", "Торговля заблокирована")}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{blockedAccount?.blockReason ?? t("Trading limit violation", "Нарушение торговых лимитов")}</p>
                    {blockedAccount?.blockedUntil && (
                      <p className="text-xs text-slate-500 mt-1.5">
                        {t("Unblocks in: ", "Разблокировка через: ")}<BlockTimer blockedUntil={blockedAccount.blockedUntil} />
                      </p>
                    )}
                    <button
                      onClick={() => setShowUnblockChat(true)}
                      className="mt-3 text-xs border border-slate-600 text-slate-300 hover:border-slate-400 hover:text-white rounded-lg px-4 py-1.5 transition-colors"
                    >
                      {t("Request Early Unblock", "Запросить досрочную разблокировку")}
                    </button>
                  </div>
                </div>
              )}

              {/* Unblock Chat Modal */}
              {showUnblockChat && stats?.userId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowUnblockChat(false)}>
                  <div className="w-full max-w-md bg-[#161b27] border border-white/10 rounded-xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                    <UnblockChat
                      userId={stats.userId}
                      blockReason={blockedAccount?.blockReason ?? null}
                      blockedUntil={blockedAccount?.blockedUntil ?? null}
                      onClose={() => setShowUnblockChat(false)}
                    />
                  </div>
                </div>
              )}

              {/* Stats cards */}
              <CardGrid className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {[
                  { label: t("Daily P&L", "Дневной P&L"), value: u ? pnlFmt(u.dailyPnl) : "—", sub: lim ? `${t("Limit", "Лимит")}: $${lim.dailyLossLimit.toLocaleString()}` : t("No limit set", "Лимит не задан"), pct: Math.round(dailyLossPct), color: (u?.dailyPnl ?? 0) >= 0 ? "text-emerald-400" : "text-red-400", barCls: limitBar(dailyLossPct), icon: "📉" },
                  { label: t("Weekly P&L", "Недельный P&L"), value: u ? pnlFmt(u.weeklyPnl) : "—", sub: lim ? `${t("Drawdown", "Просадка")}: $${lim.maxDrawdown.toLocaleString()}` : t("No limit set", "Лимит не задан"), pct: Math.round(weeklyLossPct), color: (u?.weeklyPnl ?? 0) >= 0 ? "text-emerald-400" : "text-yellow-400", barCls: limitBar(weeklyLossPct), icon: "⚠️" },
                  { label: t("Trades Today", "Сделок сегодня"), value: lim?.maxDailyTrades ? `${u?.dailyTradesCount ?? 0} / ${lim.maxDailyTrades}` : String(u?.dailyTradesCount ?? 0), sub: `${t("Loss streak", "Серия убытков")}: ${u?.consecutiveLosses ?? 0}`, pct: Math.round(tradePct), color: "text-blue-400", barCls: limitBar(tradePct), icon: "🔁" },
                  { label: t("Accounts", "Аккаунтов"), value: String(stats?.accounts.length ?? 0), sub: blocked ? `⛔ ${t("Trading blocked", "Торговля заблокирована")}` : t("Monitoring active", "Мониторинг активен"), pct: 100, color: blocked ? "text-red-400" : "text-emerald-400", barCls: blocked ? "bg-red-500" : "bg-emerald-500", icon: "💼" },
                ].map(s => (
                  <CardTransition key={s.label}>
                    <div className="bg-[#161b27] border border-white/5 rounded-xl p-4 h-full">
                      <div className="flex items-center justify-between mb-3"><p className="text-xs text-slate-500">{s.label}</p><span className="text-base">{s.icon}</span></div>
                      <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{s.sub}</p>
                      <div className="mt-3 h-1.5 bg-white/5 rounded-full overflow-hidden"><div className={`h-full rounded-full ${s.barCls}`} style={{ width: `${s.pct}%` }} /></div>
                      <p className="text-[10px] text-slate-600 mt-1">{s.pct}% {t("used", "использовано")}</p>
                    </div>
                  </CardTransition>
                ))}
              </CardGrid>

              {/* Middle row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 bg-[#161b27] border border-white/5 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div><h2 className="text-sm font-semibold text-white">{t("P&L for", "P&L за")} {[t("today", "день"), t("week", "неделю"), t("month", "месяц")][activePeriod]}</h2><p className="text-xs text-slate-500">{t("Cumulative result", "Накопленный результат")}</p></div>
                    <div className="flex gap-2">
                      {periods.map((p, i) => (
                        <button key={p} onClick={() => setActivePeriod(i)} className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${activePeriod === i ? "bg-emerald-500/10 text-emerald-400" : "text-slate-500 hover:text-slate-300 hover:bg-white/5"}`}>{p}</button>
                      ))}
                    </div>
                  </div>
                  <div className="h-40 flex items-center justify-center">
                    <div className="text-center">
                      <p className={`text-5xl font-bold tabular-nums ${periodPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>{pnlFmt(periodPnl)}</p>
                      <p className="text-sm text-slate-500 mt-2">{periodLabels[activePeriod]} · {u?.dailyTradesCount ?? 0} {t("trades today", "сдел. сегодня")}</p>
                      <button onClick={handleSync} disabled={syncing} className="mt-3 text-xs text-slate-500 hover:text-slate-300 border border-white/10 hover:border-white/20 px-3 py-1 rounded-lg transition-colors disabled:opacity-50">
                        {syncing ? t("⟳ Syncing...", "⟳ Синхрон...") : t("⟳ Refresh data", "⟳ Обновить данные")}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-[#161b27] border border-white/5 rounded-xl p-4">
                  <h2 className="text-sm font-semibold text-white mb-4">{t("Limit Status", "Статус лимитов")}</h2>
                  {!stats?.hasLimits ? (
                    <div className="text-center py-6"><p className="text-xs text-slate-500">{t("Limits not set", "Лимиты не установлены")}</p><a href="/limits" className="text-xs text-emerald-400 hover:underline mt-1 block">{t("Set up →", "Установить →")}</a></div>
                  ) : (
                    <div className="space-y-4">
                      {[
                        { label: t("Daily Loss", "Дневной убыток"), pct: dailyLossPct, val: u ? `$${Math.abs(Math.min(u.dailyPnl,0)).toFixed(0)}` : "—", lmt: lim ? `$${lim.dailyLossLimit}` : "—" },
                        { label: t("Weekly Drawdown", "Просадка (нед.)"), pct: weeklyLossPct, val: u ? `$${Math.abs(Math.min(u.weeklyPnl,0)).toFixed(0)}` : "—", lmt: lim ? `$${lim.maxDrawdown}` : "—" },
                        { label: t("Trade Count", "Кол-во сделок"), pct: tradePct, val: String(u?.dailyTradesCount ?? 0), lmt: lim?.maxDailyTrades ? String(lim.maxDailyTrades) : "—" },
                        { label: t("Loss Streak", "Серия убытков"), pct: consecPct, val: String(u?.consecutiveLosses ?? 0), lmt: lim?.maxConsecutiveLosses ? String(lim.maxConsecutiveLosses) : "—" },
                      ].map(l => (
                        <div key={l.label}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-400">{l.label}</span>
                            <span className={`font-medium ${l.pct >= 100 ? "text-red-400" : l.pct >= 70 ? "text-yellow-400" : "text-slate-300"}`}>{l.val} / {l.lmt}</span>
                          </div>
                          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all ${limitBar(l.pct)}`} style={{ width: `${Math.min(l.pct, 100)}%` }} /></div>
                        </div>
                      ))}
                    </div>
                  )}
                  {blocked && (
                    <div className="mt-5 bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-center">
                      <p className="text-xs font-semibold text-red-400">🔒 {t("Trading Blocked", "Торговля заблокирована")}</p>
                      {blockedAccount?.blockedUntil && (
                        <p className="text-xs text-slate-500 mt-1">{t("Unblocks in:", "Разблокировка через:")} <BlockTimer blockedUntil={blockedAccount.blockedUntil} /></p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 bg-[#161b27] border border-white/5 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-white">{t("Recent Trades", "Последние сделки")}</h2>
                    <a href="/journal" className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors">Analytics →</a>
                  </div>
                  {trades.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-500">{t("No trades. Click \"Sync\" to load from exchange.", "Нет сделок. Нажмите «Синхронизировать» для загрузки с биржи.")}</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead><tr className="border-b border-white/5">{[t("Instrument","Инструмент"),t("Direction","Направление"),t("Entry","Вход"),t("Exit","Выход"),t("Qty","Объём"),t("P&L","P&L"),t("Status","Статус")].map(h=><th key={h} className="px-4 py-2.5 text-left text-slate-500 font-medium whitespace-nowrap">{h}</th>)}</tr></thead>
                        <tbody>
                          {trades.map((tr, i) => (
                            <tr key={tr.id} className={`border-b border-white/5 hover:bg-white/[0.02] transition-colors ${i===trades.length-1?"border-0":""}`}>
                              <td className="px-4 py-3 font-semibold text-white whitespace-nowrap">{tr.symbol}</td>
                              <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${tr.direction==="LONG"?"bg-emerald-500/15 text-emerald-400":"bg-red-500/15 text-red-400"}`}>{tr.direction}</span></td>
                              <td className="px-4 py-3 text-slate-300 font-mono whitespace-nowrap">{tr.entryPrice.toLocaleString()}</td>
                              <td className="px-4 py-3 text-slate-300 font-mono whitespace-nowrap">{tr.exitPrice?tr.exitPrice.toLocaleString():<span className="text-slate-600">—</span>}</td>
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
                    <h2 className="text-sm font-semibold text-white">{t("Violations", "Нарушения")}</h2>
                    <span className="text-[10px] text-slate-500">{stats?.breachesToday ?? 0} {t("today", "сегодня")}</span>
                  </div>
                  <div className="p-3 space-y-2">
                    {(stats?.recentBreaches??[]).length===0 ? <p className="text-xs text-slate-600 text-center py-4">{t("No violations", "Нарушений нет")}</p> :
                      (stats?.recentBreaches??[]).map(b=>(
                        <div key={b.id} className={`rounded-lg border p-3 ${severityBadge(b.severity)}`}>
                          <div className="flex items-center justify-between mb-1"><span className="text-[10px] font-semibold uppercase tracking-wide">{severityLabel(b.severity)}</span><span className="text-[10px] opacity-60">{fmtTime(b.occurredAt)}</span></div>
                          <p className="text-xs leading-snug opacity-90">{b.description??b.breachType}</p>
                        </div>
                      ))
                    }
                    <div className="text-center pt-2"><a href="/breaches" className="text-[10px] text-emerald-400 hover:text-emerald-300">{t("All violations →", "Все нарушения →")}</a></div>
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </PageTransition>
    </AppShell>
  );
}
