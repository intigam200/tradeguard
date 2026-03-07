"use client";

import { useState, useEffect, useCallback } from "react";
import AppShell from "@/components/layout/AppShell";
import { PageTransition } from "@/components/ui/animations";
import { TimeFilter, getDateRange, type TimeRange } from "@/components/ui/time-filter";
import { useLang } from "@/context/language";
import { PageLoader } from "@/components/ui/page-loader";

type Breach = { id: string; breachType: string; severity: "WARNING" | "VIOLATION" | "CRITICAL"; description: string | null; limitValue: number; actualValue: number; occurredAt: string; isAcknowledged: boolean; acknowledgedAt: string | null; };

const severityBadge = (s: string) => s === "CRITICAL" ? "bg-red-500/20 text-red-400 border-red-500/30" : s === "VIOLATION" ? "bg-orange-500/20 text-orange-400 border-orange-500/30" : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-US");
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

export default function BreachesPage() {
  const { lang } = useLang();
  const t = (en: string, ru: string) => lang === "en" ? en : ru;

  const sevLabel  = (s: string) => s === "CRITICAL" ? t("Critical","Критично") : s === "VIOLATION" ? t("Violation","Нарушение") : t("Warning","Предупреждение");
  const typeLabel = (tp: string) => ({
    CONSECUTIVE_LOSSES: t("Loss Streak","Серия убытков"), DAILY_LOSS_LIMIT: t("Daily Limit","Дневной лимит"),
    WEEKLY_LOSS_LIMIT:  t("Weekly Limit","Недельный лимит"), MONTHLY_LOSS_LIMIT: t("Monthly Limit","Месячный лимит"),
    MAX_DRAWDOWN:       t("Drawdown","Просадка"), POSITION_SIZE: t("Position Size","Размер позиции"),
    DAILY_TRADE_COUNT:  t("Trade Count","Кол-во сделок"), RISK_PER_TRADE: t("Risk per Trade","Риск на сделку"),
    TRADING_HOURS:      t("Trading Hours","Время торговли"),
  }[tp] ?? tp);

  const [breaches,        setBreaches]        = useState<Breach[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [clearing,        setClearing]        = useState(false);
  const [filterSeverity,  setFilterSeverity]  = useState<"ALL" | "WARNING" | "VIOLATION" | "CRITICAL">("ALL");
  const [timeRange,       setTimeRange]       = useState<TimeRange>("all");
  const [acknowledging,   setAcknowledging]   = useState<string | null>(null);

  const load = useCallback(async (range?: TimeRange) => {
    try {
      const r = range ?? timeRange;
      const { from, to } = getDateRange(r);
      const url = r === "all"
        ? "/api/breaches"
        : `/api/breaches?from=${from.toISOString()}&to=${to.toISOString()}`;
      const res  = await fetch(url);
      const json = await res.json() as { ok: boolean; breaches: Breach[] };
      if (json.ok) setBreaches(json.breaches);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [timeRange]);

  useEffect(() => { load(); }, [load]);

  const handleTimeRange = (r: TimeRange) => { setTimeRange(r); load(r); };

  const acknowledge = async (id: string) => {
    setAcknowledging(id);
    try {
      const res  = await fetch(`/api/breaches/${id}`, { method: "PATCH" });
      const json = await res.json() as { ok: boolean };
      if (json.ok) setBreaches(prev => prev.map(b => b.id === id ? { ...b, isAcknowledged: true, acknowledgedAt: new Date().toISOString() } : b));
    } finally { setAcknowledging(null); }
  };

  const clearAcknowledged = async () => {
    setClearing(true);
    try {
      const res  = await fetch("/api/breaches/clear", { method: "DELETE" });
      const json = await res.json() as { ok: boolean };
      if (json.ok) setBreaches(prev => prev.filter(b => !b.isAcknowledged));
    } finally { setClearing(false); }
  };

  const filtered = breaches.filter(b => filterSeverity === "ALL" || b.severity === filterSeverity);
  const pending   = breaches.filter(b => !b.isAcknowledged).length;
  const acknowledged = breaches.filter(b => b.isAcknowledged).length;

  if (loading && breaches.length === 0) return <AppShell><PageLoader /></AppShell>;

  return (
    <AppShell>
      <PageTransition>
        <main className="flex-1 overflow-auto p-4 md:p-6 space-y-5">

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: t("Total","Всего"), value: breaches.length.toString(), icon: "📋", color: "" },
              { label: t("Critical","Критичных"), value: breaches.filter(b => b.severity === "CRITICAL").length.toString(), icon: "🔴", color: "text-red-400" },
              { label: t("Violations","Нарушений"), value: breaches.filter(b => b.severity === "VIOLATION").length.toString(), icon: "🟠", color: "text-orange-400" },
              { label: t("Warnings","Предупреждений"), value: breaches.filter(b => b.severity === "WARNING").length.toString(), icon: "🟡", color: "text-yellow-400" },
            ].map(s => (
              <div key={s.label} className="bg-[#161b27] border border-white/5 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2"><span>{s.icon}</span><p className="text-xs text-slate-500">{s.label}</p></div>
                <p className={`text-2xl font-bold ${s.color || "text-white"}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Filters row */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap gap-2">
              {(["ALL", "CRITICAL", "VIOLATION", "WARNING"] as const).map(s => (
                <button key={s} onClick={() => setFilterSeverity(s)}
                  className={`text-xs px-3 py-1.5 rounded-lg transition-colors border ${filterSeverity === s
                    ? s === "ALL" ? "bg-white/10 text-white border-white/20"
                    : s === "CRITICAL" ? "bg-red-500/10 text-red-400 border-red-500/20"
                    : s === "VIOLATION" ? "bg-orange-500/10 text-orange-400 border-orange-500/20"
                    : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                    : "text-slate-500 border-white/5 hover:text-slate-300"}`}>
                  {s === "ALL" ? t("All","Все") : sevLabel(s)}
                </button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <TimeFilter value={timeRange} onChange={handleTimeRange} lang={lang} />
              {acknowledged > 0 && (
                <button onClick={clearAcknowledged} disabled={clearing}
                  className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-slate-400 hover:text-white hover:border-white/20 transition-colors disabled:opacity-50">
                  {clearing ? "..." : t(`Clear ${acknowledged} acknowledged`, `Удалить ${acknowledged} подтверждённых`)}
                </button>
              )}
            </div>
          </div>

          {pending > 0 && (
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl px-4 py-2 flex items-center justify-between">
              <span className="text-xs text-orange-400">{pending} {t("require acknowledgement","требует подтверждения")}</span>
              <span className="text-[10px] text-slate-500">{filtered.length} {t("entries","записей")}</span>
            </div>
          )}

          {/* Breach list */}
          {loading ? (
            <div className="space-y-3">{[0,1,2].map(i => <div key={i} className="h-20 bg-[#161b27] border border-white/5 rounded-xl animate-pulse" />)}</div>
          ) : (
            <div className="space-y-3">
              {filtered.map(b => (
                <div key={b.id} className={`bg-[#161b27] border rounded-xl p-4 ${b.isAcknowledged ? "border-white/5 opacity-60" : "border-white/10"}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <span className={`text-[10px] font-semibold px-2 py-1 rounded border shrink-0 mt-0.5 ${severityBadge(b.severity)}`}>{sevLabel(b.severity)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-xs font-semibold text-slate-300">{typeLabel(b.breachType)}</span>
                          {b.limitValue > 0 && <><span className="text-[10px] text-slate-600">•</span><span className="text-[10px] text-slate-500">{t("Limit","Лимит")}: {b.limitValue.toFixed(2)} / {t("Actual","Факт")}: {b.actualValue.toFixed(2)}</span></>}
                        </div>
                        <p className="text-xs text-slate-400 leading-snug">{b.description ?? b.breachType}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right hidden sm:block">
                        <p className="text-[10px] text-slate-500">{fmtDate(b.occurredAt)}</p>
                        <p className="text-[10px] text-slate-600">{fmtTime(b.occurredAt)}</p>
                      </div>
                      {b.isAcknowledged
                        ? <span className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-lg">✓ {t("Acknowledged","Подтверждено")}</span>
                        : <button onClick={() => acknowledge(b.id)} disabled={acknowledging === b.id}
                            className="text-xs text-slate-300 hover:text-white border border-white/10 hover:border-white/30 px-3 py-1 rounded-lg transition-colors disabled:opacity-50">
                            {acknowledging === b.id ? "..." : t("Acknowledge","Подтвердить")}
                          </button>
                      }
                    </div>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && !loading && (
                <div className="text-center py-16 text-slate-600 text-sm">{t("No violations found","Нарушений не найдено")}</div>
              )}
            </div>
          )}
        </main>
      </PageTransition>
    </AppShell>
  );
}
