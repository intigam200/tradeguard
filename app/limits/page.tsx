"use client";

import { useState, useEffect, useCallback } from "react";
import AppShell from "@/components/layout/AppShell";
import { PageTransition } from "@/components/ui/animations";
import { useLang } from "@/context/language";

// ─── Types ────────────────────────────────────────────────────────────────────
type LimitConfig = {
  dailyLoss:       string;
  maxDrawdown:     string;
  maxTrades:       string;
  maxConsecLosses: string;
  maxPositionSize: string;
  riskPerTrade:    string;
};

type BlockConfig = {
  blockDuration: string; // hours as string, "0" = until midnight UTC
  autoUnblock:   boolean;
};

type Usage = {
  dailyPnl:          number;
  dailyTradesCount:  number;
  weeklyPnl:         number;
  monthlyPnl:        number;
  consecutiveLosses: number;
};

const defaultLimits: LimitConfig = {
  dailyLoss:       "2000",
  maxDrawdown:     "8000",
  maxTrades:       "10",
  maxConsecLosses: "3",
  maxPositionSize: "2.0",
  riskPerTrade:    "100",
};

const defaultBlock: BlockConfig = {
  blockDuration: "24",
  autoUnblock:   true,
};

function getBarColor(pct: number) {
  if (pct >= 100) return "bg-red-500";
  if (pct >= 70)  return "bg-yellow-400";
  return "bg-emerald-500";
}

function getStatusPct(pct: number, lang: string) {
  if (pct >= 100) return { text: lang === "en" ? "Exceeded" : "Превышен",       cls: "text-red-400 bg-red-500/10 border-red-500/20"            };
  if (pct >= 70)  return { text: lang === "en" ? "Warning"  : "Предупреждение",  cls: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20"  };
  return           { text: lang === "en" ? "Normal"   : "В норме",              cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" };
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function LimitsPage() {
  const { lang } = useLang();
  const t = (en: string, ru: string) => lang === "en" ? en : ru;

  const [limits, setLimits]   = useState<LimitConfig>(defaultLimits);
  const [block, setBlock]     = useState<BlockConfig>(defaultBlock);
  const [usage, setUsage]     = useState<Usage | null>(null);
  const [tab, setTab]         = useState<"current" | "settings">("current");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);

  const BLOCK_DURATION_OPTIONS = [
    { value: "1",  label: t("1 hour",             "1 час")                        },
    { value: "2",  label: t("2 hours",            "2 часа")                       },
    { value: "4",  label: t("4 hours",            "4 часа")                       },
    { value: "8",  label: t("8 hours",            "8 часов")                      },
    { value: "24", label: t("24 hours",           "24 часа")                      },
    { value: "48", label: t("48 hours",           "48 часов")                     },
    { value: "0",  label: t("Until midnight UTC", "До конца торгового дня (UTC)") },
  ];

  // ── Load data ──────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    try {
      const [limitsRes, statsRes] = await Promise.all([
        fetch("/api/limits"),
        fetch("/api/stats"),
      ]);
      const limitsJson = await limitsRes.json() as {
        ok: boolean;
        limits: {
          dailyLossLimit:       number;
          maxDrawdown:          number;
          maxDailyTrades:       number | null;
          maxConsecutiveLosses: number | null;
          maxPositionSize:      number | null;
          maxRiskPerTrade:      number | null;
          blockDurationHours:   number;
          autoUnblock:          boolean;
        } | null;
      };
      const statsJson  = await statsRes.json() as {
        ok: boolean;
        usage: Usage | null;
      };

      if (limitsJson.ok && limitsJson.limits) {
        const l = limitsJson.limits;
        setLimits({
          dailyLoss:       String(l.dailyLossLimit),
          maxDrawdown:     String(l.maxDrawdown),
          maxTrades:       String(l.maxDailyTrades       ?? 10),
          maxConsecLosses: String(l.maxConsecutiveLosses  ?? 3),
          maxPositionSize: String(l.maxPositionSize       ?? 2.0),
          riskPerTrade:    String(l.maxRiskPerTrade       ?? 100),
        });
        setBlock({
          blockDuration: String(l.blockDurationHours),
          autoUnblock:   l.autoUnblock,
        });
      }

      if (statsJson.ok && statsJson.usage) {
        setUsage(statsJson.usage);
      }
    } catch (err) {
      console.error("Failed to load limits:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Save ───────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true);
    try {
      const blockDurationHours = block.blockDuration === "0" ? 0 : (parseInt(block.blockDuration) || 24);
      const res = await fetch("/api/limits", {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dailyLossLimit:       parseFloat(limits.dailyLoss)      || 2000,
          maxDrawdown:          parseFloat(limits.maxDrawdown)     || 8000,
          maxDailyTrades:       parseInt(limits.maxTrades)         || 10,
          maxConsecutiveLosses: parseInt(limits.maxConsecLosses)   || 3,
          maxPositionSize:      parseFloat(limits.maxPositionSize) || 2.0,
          maxRiskPerTrade:      parseFloat(limits.riskPerTrade)    || 100,
          blockDurationHours,
          autoUnblock:          block.autoUnblock,
          warningThresholdPct:  80,
        }),
      });
      const json = await res.json() as { ok: boolean };
      if (json.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (err) {
      console.error("Failed to save limits:", err);
    } finally {
      setSaving(false);
    }
  };

  // ── Usage bars ─────────────────────────────────────────────────────────────

  const numLimits = {
    dailyLoss:       parseFloat(limits.dailyLoss)      || 0,
    maxDrawdown:     parseFloat(limits.maxDrawdown)     || 0,
    maxTrades:       parseInt(limits.maxTrades)         || 0,
    maxConsecLosses: parseInt(limits.maxConsecLosses)   || 0,
    riskPerTrade:    parseFloat(limits.riskPerTrade)    || 0,
  };

  const usageBars = [
    { label: t("Daily Loss", "Дневной убыток"),                                  icon: "📉", current: usage ? Math.abs(Math.min(usage.dailyPnl, 0)) : 0,  limit: numLimits.dailyLoss,       format: (v: number) => "$" + v.toLocaleString("en-US", { maximumFractionDigits: 0 }) },
    { label: t("Max Drawdown", "Максимальная просадка"),                         icon: "⚠️", current: usage ? Math.abs(Math.min(usage.weeklyPnl, 0)) : 0, limit: numLimits.maxDrawdown,     format: (v: number) => "$" + v.toLocaleString("en-US", { maximumFractionDigits: 0 }) },
    { label: t("Trade Count", "Количество сделок"),                              icon: "🔁", current: usage ? usage.dailyTradesCount : 0,                 limit: numLimits.maxTrades,       format: (v: number) => String(v) },
    { label: t("Consecutive Losses", "Подряд убыточных сделок"),                 icon: "🔴", current: usage ? usage.consecutiveLosses : 0,                limit: numLimits.maxConsecLosses, format: (v: number) => String(v) },
    { label: t("Max Risk per Trade ($)", "Максимальный риск на сделку ($)"),     icon: "🎯", current: 0, limit: numLimits.riskPerTrade, format: (v: number) => "$" + v },
  ];

  const inputCls = "w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50 transition-colors";

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <AppShell>
      <PageTransition>
        <header className="h-14 border-b border-white/5 px-4 md:px-6 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-sm font-semibold text-white">{t("Limits & Blocking", "Лимиты и блокировка")}</h1>
            <p className="text-xs text-slate-500">{t("Set trading rules and blocking conditions", "Установите правила торговли и условия блокировки")}</p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className={`text-xs font-semibold px-4 py-1.5 rounded-lg transition-colors ${
              saved
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/20"
                : saving
                ? "bg-white/5 text-slate-500 cursor-not-allowed"
                : "bg-emerald-500 hover:bg-emerald-400 text-black"
            }`}
          >
            {saved ? t("✓ Saved", "✓ Сохранено") : saving ? t("Saving...", "Сохраняю...") : t("Save", "Сохранить")}
          </button>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-6 space-y-5">

          {/* Tabs */}
          <div className="flex gap-1 bg-[#161b27] border border-white/5 rounded-xl p-1 w-fit">
            {([["current", t("Current Usage", "Текущее использование")], ["settings", t("Limit Settings", "Настройка лимитов")]] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  tab === key ? "bg-white/10 text-white" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "current" && (
            <>
              {/* Overview */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: t("Active Limits", "Активных лимитов"), value: usageBars.length.toString(), icon: "🛡" },
                  { label: t("Exceeded",       "Превышено"),        value: usageBars.filter(u => u.limit > 0 && (u.current / u.limit) >= 1).length.toString(), icon: "🔴", color: "text-red-400" },
                  { label: t("Warnings",       "Предупреждений"),   value: usageBars.filter(u => { const p = u.limit > 0 ? u.current / u.limit : 0; return p >= 0.7 && p < 1; }).length.toString(), icon: "⚠️", color: "text-yellow-400" },
                ].map(s => (
                  <div key={s.label} className="bg-[#161b27] border border-white/5 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2"><span>{s.icon}</span><p className="text-xs text-slate-500">{s.label}</p></div>
                    <p className={`text-2xl font-bold ${s.color ?? "text-white"}`}>{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Usage bars */}
              {loading ? (
                <div className="text-center py-10 text-slate-600 text-sm">{t("Loading...", "Загрузка...")}</div>
              ) : (
                <div className="space-y-3">
                  {usageBars.map(u => {
                    const pct    = u.limit > 0 ? Math.min((u.current / u.limit) * 100, 100) : 0;
                    const status = getStatusPct(pct, lang);
                    return (
                      <div key={u.label} className="bg-[#161b27] border border-white/5 rounded-xl p-5">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span>{u.icon}</span>
                            <p className="text-sm font-semibold text-white">{u.label}</p>
                          </div>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${status.cls}`}>{status.text}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex-1">
                            <div className="flex justify-between text-xs mb-1.5">
                              <span className="text-slate-500">{t("Usage", "Использование")}</span>
                              <span className="text-slate-300 font-medium">{u.format(u.current)} / {u.format(u.limit)}</span>
                            </div>
                            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${getBarColor(pct)}`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                          <p className={`text-lg font-bold min-w-[46px] text-right ${pct >= 100 ? "text-red-400" : pct >= 70 ? "text-yellow-400" : "text-emerald-400"}`}>
                            {Math.round(pct)}%
                          </p>
                        </div>
                      </div>
                    );
                  })}

                  {!usage && (
                    <div className="bg-[#161b27] border border-white/5 rounded-xl p-4 text-center">
                      <p className="text-xs text-slate-500">
                        {t("No trade data. ", "Нет данных о сделках. ")}
                        <a href="/connect" className="text-emerald-400 hover:underline">{t("Connect an account", "Подключите аккаунт")}</a>
                        {t(" and click Sync.", " и нажмите «Синхронизировать».")}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {tab === "settings" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

              {/* ── Limits form ── */}
              <div className="bg-[#161b27] border border-white/5 rounded-xl p-6">
                <h2 className="text-sm font-semibold text-white mb-1">{t("Risk Limits", "Лимиты риска")}</h2>
                <p className="text-xs text-slate-500 mb-5">{t("Set these calmly, before trading begins", "Установите на спокойную голову, до начала торгов")}</p>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-slate-400 mb-1.5 flex items-center gap-1.5"><span>📉</span> {t("Max Daily Loss ($)", "Максимальный дневной убыток ($)")}</label>
                    <input type="number" value={limits.dailyLoss}
                      onChange={e => setLimits(l => ({ ...l, dailyLoss: e.target.value }))}
                      onFocus={e => e.target.select()}
                      className={inputCls} />
                    <p className="text-[10px] text-slate-600 mt-1">{t("Trading is blocked when this value is reached", "Торговля блокируется при достижении этого значения")}</p>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 mb-1.5 flex items-center gap-1.5"><span>⚠️</span> {t("Max Drawdown ($)", "Максимальная просадка ($)")}</label>
                    <input type="number" value={limits.maxDrawdown}
                      onChange={e => setLimits(l => ({ ...l, maxDrawdown: e.target.value }))}
                      onFocus={e => e.target.select()}
                      className={inputCls} />
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 mb-1.5 flex items-center gap-1.5"><span>🔁</span> {t("Max Trades per Day", "Максимум сделок в день")}</label>
                    <input type="number" value={limits.maxTrades}
                      onChange={e => setLimits(l => ({ ...l, maxTrades: e.target.value }))}
                      onFocus={e => e.target.select()}
                      className={inputCls} />
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 mb-1.5 flex items-center gap-1.5"><span>🔴</span> {t("Max Consecutive Losses", "Максимум убыточных сделок подряд")}</label>
                    <input type="number" min={1} max={10} value={limits.maxConsecLosses}
                      onChange={e => setLimits(l => ({ ...l, maxConsecLosses: e.target.value }))}
                      onFocus={e => e.target.select()}
                      className={inputCls} />
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 mb-1.5 flex items-center gap-1.5"><span>📊</span> {t("Max Position Size (lot)", "Максимальный размер позиции (lot)")}</label>
                    <input type="number" step={0.1} min={0.01} value={limits.maxPositionSize}
                      onChange={e => setLimits(l => ({ ...l, maxPositionSize: e.target.value }))}
                      onFocus={e => e.target.select()}
                      className={inputCls} />
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 mb-1.5 flex items-center gap-1.5"><span>🎯</span> {t("Max Risk per Trade ($)", "Максимальный риск на сделку ($)")}</label>
                    <input type="number" value={limits.riskPerTrade}
                      onChange={e => setLimits(l => ({ ...l, riskPerTrade: e.target.value }))}
                      onFocus={e => e.target.select()}
                      className={inputCls} />
                  </div>
                </div>
              </div>

              {/* ── Block settings ── */}
              <div className="space-y-4">
                <div className="bg-[#161b27] border border-white/5 rounded-xl p-6">
                  <h2 className="text-sm font-semibold text-white mb-1">{t("Blocking Conditions", "Условия блокировки")}</h2>
                  <p className="text-xs text-slate-500 mb-5">{t("When TradeGuard should block trading", "Когда TradeGuard должен заблокировать торговлю")}</p>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between py-3 border-b border-white/5">
                      <div>
                        <p className="text-sm text-slate-200">{t("On daily limit reached", "При достижении дневного лимита")}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{t("Block at loss ≥", "Блокировать при убытке ≥")} ${(parseFloat(limits.dailyLoss) || 0).toLocaleString()}</p>
                      </div>
                      <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">{t("Always", "Всегда")}</span>
                    </div>

                    <div className="flex items-center justify-between py-3 border-b border-white/5">
                      <div>
                        <p className="text-sm text-slate-200">{t("On consecutive loss streak", "При серии убыточных сделок")}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{t("Block after", "Блокировать после")} {limits.maxConsecLosses} {t("consecutive losses", "убытков подряд")}</p>
                      </div>
                      <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">{t("Always", "Всегда")}</span>
                    </div>

                    <div className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-sm text-slate-200">{t("Auto-unblock", "Автоматическая разблокировка")}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{t("Unblock automatically after the set duration", "Разблокировать автоматически через заданное время")}</p>
                      </div>
                      <button
                        onClick={() => setBlock(b => ({ ...b, autoUnblock: !b.autoUnblock }))}
                        className={`w-11 h-6 rounded-full transition-colors relative ${block.autoUnblock ? "bg-emerald-500" : "bg-white/10"}`}
                      >
                        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${block.autoUnblock ? "left-6" : "left-1"}`} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Block duration */}
                <div className="bg-[#161b27] border border-white/5 rounded-xl p-6">
                  <h2 className="text-sm font-semibold text-white mb-1">{t("Block Duration", "Длительность блокировки")}</h2>
                  <p className="text-xs text-slate-500 mb-5">{t("How long to block the account on violation", "На сколько времени блокировать аккаунт при нарушении")}</p>

                  <div className="grid grid-cols-2 gap-2">
                    {BLOCK_DURATION_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setBlock(b => ({ ...b, blockDuration: opt.value }))}
                        className={`py-2.5 px-3 rounded-lg text-xs font-medium text-left transition-all border ${
                          block.blockDuration === opt.value
                            ? "bg-red-500/10 border-red-500/30 text-red-400"
                            : "bg-white/[0.02] border-white/5 text-slate-400 hover:border-white/10 hover:text-slate-200"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  <div className="mt-4 bg-red-500/5 border border-red-500/15 rounded-lg p-3">
                    <p className="text-[10px] text-slate-500">
                      {t("On limit breach, the account will be blocked for", "При нарушении лимита аккаунт будет заблокирован на")}{" "}
                      <strong className="text-red-400">{BLOCK_DURATION_OPTIONS.find(o => o.value === block.blockDuration)?.label.toLowerCase()}</strong>.
                      {" "}{block.autoUnblock ? t("Auto-unblocks.", "Разблокируется автоматически.") : t("Manual unblock required.", "Требуется ручная разблокировка.")}
                    </p>
                  </div>
                </div>

                {/* Tip */}
                <div className="bg-[#161b27] border border-white/5 rounded-xl p-4 flex items-start gap-3">
                  <span className="text-lg">💡</span>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {t(
                      "Blocking is automatic: all orders are cancelled and all positions are closed at market price. Click ",
                      "Блокировка выполняется автоматически: отменяются все ордера и закрываются все позиции маркет-ордером. Нажмите "
                    )}
                    <strong className="text-slate-400">{t("Save", "Сохранить")}</strong>
                    {t(" for limits to take effect.", ", чтобы лимиты вступили в силу.")}
                  </p>
                </div>
              </div>
            </div>
          )}
        </main>
      </PageTransition>
    </AppShell>
  );
}
