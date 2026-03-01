"use client";

import { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/layout/Sidebar";
import { PageTransition } from "@/components/ui/animations";

// ─── Types ────────────────────────────────────────────────────────────────────
type LimitConfig = {
  dailyLoss:       number;
  maxDrawdown:     number;
  maxTrades:       number;
  maxConsecLosses: number;
  maxPositionSize: number;
  riskPerTrade:    number;
};

type BlockConfig = {
  blockDuration: string; // часов или "day"
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
  dailyLoss:       2000,
  maxDrawdown:     8000,
  maxTrades:       10,
  maxConsecLosses: 3,
  maxPositionSize: 2.0,
  riskPerTrade:    100,
};

const defaultBlock: BlockConfig = {
  blockDuration: "24",
  autoUnblock:   true,
};

const BLOCK_DURATION_OPTIONS = [
  { value: "1",   label: "1 час" },
  { value: "2",   label: "2 часа" },
  { value: "4",   label: "4 часа" },
  { value: "8",   label: "8 часов" },
  { value: "24",  label: "24 часа" },
  { value: "48",  label: "48 часов" },
  { value: "day", label: "До конца торгового дня" },
];

function getBarColor(pct: number) {
  if (pct >= 100) return "bg-red-500";
  if (pct >= 70)  return "bg-yellow-400";
  return "bg-emerald-500";
}

function getStatusBadge(pct: number) {
  if (pct >= 100) return { text: "Превышен",       cls: "text-red-400 bg-red-500/10 border-red-500/20"          };
  if (pct >= 70)  return { text: "Предупреждение",  cls: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20" };
  return           { text: "В норме",              cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" };
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function LimitsPage() {
  const [limits, setLimits]   = useState<LimitConfig>(defaultLimits);
  const [block, setBlock]     = useState<BlockConfig>(defaultBlock);
  const [usage, setUsage]     = useState<Usage | null>(null);
  const [tab, setTab]         = useState<"current" | "settings">("current");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);

  // ── Загрузка данных ──────────────────────────────────────────────────────────

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
          dailyLoss:       l.dailyLossLimit,
          maxDrawdown:     l.maxDrawdown,
          maxTrades:       l.maxDailyTrades       ?? 10,
          maxConsecLosses: l.maxConsecutiveLosses  ?? 3,
          maxPositionSize: l.maxPositionSize       ?? 2.0,
          riskPerTrade:    l.maxRiskPerTrade       ?? 100,
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

  // ── Сохранение ────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/limits", {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dailyLossLimit:       limits.dailyLoss,
          maxDrawdown:          limits.maxDrawdown,
          maxDailyTrades:       limits.maxTrades,
          maxConsecutiveLosses: limits.maxConsecLosses,
          maxPositionSize:      limits.maxPositionSize,
          maxRiskPerTrade:      limits.riskPerTrade,
          blockDurationHours:   parseInt(block.blockDuration) || 24,
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

  // ── Данные для баров текущего использования ────────────────────────────────

  const usageBars = [
    {
      label:   "Дневной убыток",
      icon:    "📉",
      current: usage ? Math.abs(Math.min(usage.dailyPnl, 0)) : 0,
      limit:   limits.dailyLoss,
      format:  (v: number) => "$" + v.toLocaleString("ru-RU", { maximumFractionDigits: 0 }),
    },
    {
      label:   "Максимальная просадка",
      icon:    "⚠️",
      current: usage ? Math.abs(Math.min(usage.weeklyPnl, 0)) : 0,
      limit:   limits.maxDrawdown,
      format:  (v: number) => "$" + v.toLocaleString("ru-RU", { maximumFractionDigits: 0 }),
    },
    {
      label:   "Количество сделок",
      icon:    "🔁",
      current: usage ? usage.dailyTradesCount : 0,
      limit:   limits.maxTrades,
      format:  (v: number) => String(v),
    },
    {
      label:   "Подряд убыточных сделок",
      icon:    "🔴",
      current: usage ? usage.consecutiveLosses : 0,
      limit:   limits.maxConsecLosses,
      format:  (v: number) => String(v),
    },
    {
      label:   "Максимальный риск на сделку ($)",
      icon:    "🎯",
      current: 0,
      limit:   limits.riskPerTrade,
      format:  (v: number) => "$" + v,
    },
  ];

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen bg-[#0f1117] text-slate-200 font-[family-name:var(--font-geist-sans)]">
      <Sidebar />

      <PageTransition>
        <header className="h-14 border-b border-white/5 px-6 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-sm font-semibold text-white">Лимиты и блокировка</h1>
            <p className="text-xs text-slate-500">Установите правила торговли и условия блокировки</p>
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
            {saved ? "✓ Сохранено" : saving ? "Сохраняю..." : "Сохранить"}
          </button>
        </header>

        <main className="flex-1 overflow-auto p-6 space-y-5">

          {/* Tabs */}
          <div className="flex gap-1 bg-[#161b27] border border-white/5 rounded-xl p-1 w-fit">
            {([["current", "Текущее использование"], ["settings", "Настройка лимитов"]] as const).map(([key, label]) => (
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
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Активных лимитов", value: usageBars.length.toString(), icon: "🛡" },
                  { label: "Превышено",         value: usageBars.filter(u => u.limit > 0 && (u.current / u.limit) >= 1).length.toString(), icon: "🔴", color: "text-red-400" },
                  { label: "Предупреждений",    value: usageBars.filter(u => { const p = u.limit > 0 ? u.current / u.limit : 0; return p >= 0.7 && p < 1; }).length.toString(), icon: "⚠️", color: "text-yellow-400" },
                ].map(s => (
                  <div key={s.label} className="bg-[#161b27] border border-white/5 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2"><span>{s.icon}</span><p className="text-xs text-slate-500">{s.label}</p></div>
                    <p className={`text-2xl font-bold ${s.color ?? "text-white"}`}>{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Usage bars */}
              {loading ? (
                <div className="text-center py-10 text-slate-600 text-sm">Загрузка...</div>
              ) : (
                <div className="space-y-3">
                  {usageBars.map(u => {
                    const pct    = u.limit > 0 ? Math.min((u.current / u.limit) * 100, 100) : 0;
                    const status = getStatusBadge(pct);
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
                              <span className="text-slate-500">Использование</span>
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
                      <p className="text-xs text-slate-500">Нет данных о сделках. <a href="/connect" className="text-emerald-400 hover:underline">Подключите аккаунт</a> и нажмите «Синхронизировать».</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {tab === "settings" && (
            <div className="grid grid-cols-2 gap-5">

              {/* ── Limits form ── */}
              <div className="bg-[#161b27] border border-white/5 rounded-xl p-6">
                <h2 className="text-sm font-semibold text-white mb-1">Лимиты риска</h2>
                <p className="text-xs text-slate-500 mb-5">Установите на спокойную голову, до начала торгов</p>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-slate-400 mb-1.5 flex items-center gap-1.5"><span>📉</span> Максимальный дневной убыток ($)</label>
                    <input type="number" value={limits.dailyLoss}
                      onChange={e => setLimits(l => ({ ...l, dailyLoss: +e.target.value }))}
                      className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50 transition-colors" />
                    <p className="text-[10px] text-slate-600 mt-1">Торговля блокируется при достижении этого значения</p>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 mb-1.5 flex items-center gap-1.5"><span>⚠️</span> Максимальная просадка ($)</label>
                    <input type="number" value={limits.maxDrawdown}
                      onChange={e => setLimits(l => ({ ...l, maxDrawdown: +e.target.value }))}
                      className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50 transition-colors" />
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 mb-1.5 flex items-center gap-1.5"><span>🔁</span> Максимум сделок в день</label>
                    <input type="number" value={limits.maxTrades}
                      onChange={e => setLimits(l => ({ ...l, maxTrades: +e.target.value }))}
                      className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50 transition-colors" />
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 mb-1.5 flex items-center gap-1.5"><span>🔴</span> Максимум убыточных сделок подряд</label>
                    <input type="number" min={1} max={10} value={limits.maxConsecLosses}
                      onChange={e => setLimits(l => ({ ...l, maxConsecLosses: +e.target.value }))}
                      className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50 transition-colors" />
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 mb-1.5 flex items-center gap-1.5"><span>📊</span> Максимальный размер позиции (lot)</label>
                    <input type="number" step={0.1} min={0.01} value={limits.maxPositionSize}
                      onChange={e => setLimits(l => ({ ...l, maxPositionSize: +e.target.value }))}
                      className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50 transition-colors" />
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 mb-1.5 flex items-center gap-1.5"><span>🎯</span> Максимальный риск на сделку ($)</label>
                    <input type="number" value={limits.riskPerTrade}
                      onChange={e => setLimits(l => ({ ...l, riskPerTrade: +e.target.value }))}
                      className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50 transition-colors" />
                  </div>
                </div>
              </div>

              {/* ── Block settings ── */}
              <div className="space-y-4">
                <div className="bg-[#161b27] border border-white/5 rounded-xl p-6">
                  <h2 className="text-sm font-semibold text-white mb-1">Условия блокировки</h2>
                  <p className="text-xs text-slate-500 mb-5">Когда TradeGuard должен заблокировать торговлю</p>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between py-3 border-b border-white/5">
                      <div>
                        <p className="text-sm text-slate-200">При достижении дневного лимита</p>
                        <p className="text-xs text-slate-500 mt-0.5">Блокировать при убытке ≥ ${limits.dailyLoss.toLocaleString()}</p>
                      </div>
                      <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">Всегда</span>
                    </div>

                    <div className="flex items-center justify-between py-3 border-b border-white/5">
                      <div>
                        <p className="text-sm text-slate-200">При серии убыточных сделок</p>
                        <p className="text-xs text-slate-500 mt-0.5">Блокировать после {limits.maxConsecLosses} убытков подряд</p>
                      </div>
                      <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">Всегда</span>
                    </div>

                    <div className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-sm text-slate-200">Автоматическая разблокировка</p>
                        <p className="text-xs text-slate-500 mt-0.5">Разблокировать автоматически через заданное время</p>
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
                  <h2 className="text-sm font-semibold text-white mb-1">Длительность блокировки</h2>
                  <p className="text-xs text-slate-500 mb-5">На сколько времени блокировать аккаунт при нарушении</p>

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
                      При нарушении лимита аккаунт будет заблокирован на{" "}
                      <strong className="text-red-400">{BLOCK_DURATION_OPTIONS.find(o => o.value === block.blockDuration)?.label.toLowerCase()}</strong>.
                      {block.autoUnblock ? " Разблокируется автоматически." : " Требуется ручная разблокировка."}
                    </p>
                  </div>
                </div>

                {/* Cooldown note */}
                <div className="bg-[#161b27] border border-white/5 rounded-xl p-4 flex items-start gap-3">
                  <span className="text-lg">💡</span>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Блокировка выполняется автоматически: отменяются все ордера и закрываются все позиции маркет-ордером.
                    Нажмите <strong className="text-slate-400">Сохранить</strong>, чтобы лимиты вступили в силу.
                  </p>
                </div>
              </div>
            </div>
          )}
        </main>
      </PageTransition>
    </div>
  );
}
