"use client";

import { useState, useEffect, useCallback } from "react";
import AppShell from "@/components/layout/AppShell";
import { PageTransition } from "@/components/ui/animations";
import { useLang } from "@/context/language";

type Breach = {
  id: string;
  breachType: string;
  severity: "WARNING" | "VIOLATION" | "CRITICAL";
  description: string | null;
  limitValue: number;
  actualValue: number;
  occurredAt: string;
  isAcknowledged: boolean;
  acknowledgedAt: string | null;
};

const severityBadge = (s: string) => {
  if (s === "CRITICAL")  return "bg-red-500/20 text-red-400 border-red-500/30";
  if (s === "VIOLATION") return "bg-orange-500/20 text-orange-400 border-orange-500/30";
  return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
};

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-US");
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

export default function BreachesPage() {
  const { lang } = useLang();
  const t = (en: string, ru: string) => lang === "en" ? en : ru;

  const severityLabel = (s: string) => {
    if (s === "CRITICAL")  return t("Critical",  "Критично");
    if (s === "VIOLATION") return t("Violation", "Нарушение");
    return t("Warning", "Предупреждение");
  };

  const typeLabel = (tp: string) => {
    const map: Record<string, [string, string]> = {
      CONSECUTIVE_LOSSES: [t("Loss Streak",    "Серия убытков"),    ""],
      DAILY_LOSS_LIMIT:   [t("Daily Limit",    "Дневной лимит"),    ""],
      WEEKLY_LOSS_LIMIT:  [t("Weekly Limit",   "Недельный лимит"),  ""],
      MONTHLY_LOSS_LIMIT: [t("Monthly Limit",  "Месячный лимит"),   ""],
      MAX_DRAWDOWN:       [t("Drawdown",       "Просадка"),         ""],
      POSITION_SIZE:      [t("Position Size",  "Размер позиции"),   ""],
      DAILY_TRADE_COUNT:  [t("Trade Count",    "Кол-во сделок"),    ""],
      RISK_PER_TRADE:     [t("Risk per Trade", "Риск на сделку"),   ""],
      TRADING_HOURS:      [t("Trading Hours",  "Время торговли"),   ""],
    };
    return map[tp]?.[0] ?? tp;
  };

  const [breaches, setBreaches] = useState<Breach[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filterSeverity, setFilterSeverity] = useState<"ALL" | "WARNING" | "VIOLATION" | "CRITICAL">("ALL");
  const [acknowledging, setAcknowledging]   = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res  = await fetch("/api/breaches");
      const json = await res.json() as { ok: boolean; breaches: Breach[] };
      if (json.ok) setBreaches(json.breaches);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const acknowledge = async (id: string) => {
    setAcknowledging(id);
    try {
      const res  = await fetch(`/api/breaches/${id}`, { method: "PATCH" });
      const json = await res.json() as { ok: boolean };
      if (json.ok) {
        setBreaches(prev => prev.map(b => b.id === id ? { ...b, isAcknowledged: true, acknowledgedAt: new Date().toISOString() } : b));
      }
    } finally { setAcknowledging(null); }
  };

  const filtered = breaches.filter(b => filterSeverity === "ALL" || b.severity === filterSeverity);
  const pending  = breaches.filter(b => !b.isAcknowledged).length;

  return (
    <AppShell>
      <PageTransition>
        <header className="h-14 border-b border-white/5 px-4 md:px-6 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-sm font-semibold text-white">{t("Violations", "Нарушения")}</h1>
            <p className="text-xs text-slate-500">{t("Trading discipline violation log", "Журнал нарушений торговой дисциплины")}</p>
          </div>
          {pending > 0 && (
            <span className="text-xs text-orange-400 bg-orange-500/10 border border-orange-500/20 px-3 py-1 rounded-full font-medium">
              {pending} {t("require acknowledgement", "требует подтверждения")}
            </span>
          )}
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-6 space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: t("Total",    "Всего нарушений"), value: breaches.length.toString(), icon: "📋", color: "" },
              { label: t("Critical", "Критичных"),       value: breaches.filter(b => b.severity === "CRITICAL").length.toString(),  icon: "🔴", color: "text-red-400" },
              { label: t("Violations","Нарушений"),      value: breaches.filter(b => b.severity === "VIOLATION").length.toString(), icon: "🟠", color: "text-orange-400" },
              { label: t("Warnings", "Предупреждений"),  value: breaches.filter(b => b.severity === "WARNING").length.toString(),   icon: "🟡", color: "text-yellow-400" },
            ].map(s => (
              <div key={s.label} className="bg-[#161b27] border border-white/5 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2"><span>{s.icon}</span><p className="text-xs text-slate-500">{s.label}</p></div>
                <p className={`text-2xl font-bold ${s.color || "text-white"}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            {(["ALL", "CRITICAL", "VIOLATION", "WARNING"] as const).map(s => (
              <button key={s} onClick={() => setFilterSeverity(s)}
                className={`text-xs px-3 py-1.5 rounded-lg transition-colors border ${
                  filterSeverity === s
                    ? s === "ALL" ? "bg-white/10 text-white border-white/20"
                    : s === "CRITICAL" ? "bg-red-500/10 text-red-400 border-red-500/20"
                    : s === "VIOLATION" ? "bg-orange-500/10 text-orange-400 border-orange-500/20"
                    : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                    : "text-slate-500 border-white/5 hover:text-slate-300"
                }`}>
                {s === "ALL" ? t("All", "Все") : severityLabel(s)}
              </button>
            ))}
            <span className="ml-auto text-xs text-slate-500">{filtered.length} {t("entries", "записей")}</span>
          </div>

          {/* Breach list */}
          {loading ? (
            <div className="text-center py-16 text-slate-600 text-sm">{t("Loading...", "Загрузка...")}</div>
          ) : (
            <div className="space-y-3">
              {filtered.map(b => (
                <div key={b.id} className={`bg-[#161b27] border rounded-xl p-4 ${b.isAcknowledged ? "border-white/5 opacity-60" : "border-white/10"}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <span className={`text-[10px] font-semibold px-2 py-1 rounded border shrink-0 mt-0.5 ${severityBadge(b.severity)}`}>
                        {severityLabel(b.severity)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-xs font-semibold text-slate-300">{typeLabel(b.breachType)}</span>
                          {b.limitValue > 0 && (
                            <>
                              <span className="text-[10px] text-slate-600">•</span>
                              <span className="text-[10px] text-slate-500">
                                {t("Limit", "Лимит")}: {b.limitValue.toFixed(2)} / {t("Actual", "Факт")}: {b.actualValue.toFixed(2)}
                              </span>
                            </>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 leading-snug">{b.description ?? b.breachType}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right hidden sm:block">
                        <p className="text-[10px] text-slate-500">{fmtDate(b.occurredAt)}</p>
                        <p className="text-[10px] text-slate-600">{fmtTime(b.occurredAt)}</p>
                      </div>
                      {b.isAcknowledged ? (
                        <span className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-lg">✓ {t("Acknowledged", "Подтверждено")}</span>
                      ) : (
                        <button onClick={() => acknowledge(b.id)} disabled={acknowledging === b.id}
                          className="text-xs text-slate-300 hover:text-white border border-white/10 hover:border-white/30 px-3 py-1 rounded-lg transition-colors disabled:opacity-50">
                          {acknowledging === b.id ? "..." : t("Acknowledge", "Подтвердить")}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && !loading && (
                <div className="text-center py-16 text-slate-600 text-sm">{t("No violations found", "Нарушений не найдено")}</div>
              )}
            </div>
          )}
        </main>
      </PageTransition>
    </AppShell>
  );
}
