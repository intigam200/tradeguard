"use client";

import { useState, useEffect, useCallback } from "react";
import AppShell from "@/components/layout/AppShell";
import { BlockTimer } from "@/components/BlockTimer";
import { PageTransition } from "@/components/ui/animations";
import { useLang } from "@/context/language";

type LimitConfig = { dailyLoss: string; maxDrawdown: string; maxTrades: string; maxConsecLosses: string; maxPositionSize: string; riskPerTrade: string; };
type BlockConfig = { blockDuration: string; autoUnblock: boolean; };
type Usage = { dailyPnl: number; dailyTradesCount: number; weeklyPnl: number; monthlyPnl: number; consecutiveLosses: number; };

const defaultLimits: LimitConfig = { dailyLoss: "2000", maxDrawdown: "8000", maxTrades: "10", maxConsecLosses: "3", maxPositionSize: "2.0", riskPerTrade: "100" };
const defaultBlock:  BlockConfig = { blockDuration: "24", autoUnblock: true };
const DURATION_MARKS = [1, 2, 4, 8, 24, 48];

function BlockDurationSlider({ value, onChange, lang }: { value: string; onChange: (v: string) => void; lang: string }) {
  const t   = (en: string, ru: string) => lang === "en" ? en : ru;
  const hrs = parseInt(value) || 24;
  const idx = DURATION_MARKS.indexOf(hrs);
  const cur = idx === -1 ? DURATION_MARKS.indexOf(24) : idx;
  const lbl = hrs === 1 ? `1 ${t("hour","час")}` : hrs < 5 ? `${hrs} ${t("hours","часа")}` : `${hrs} ${t("hours","часов")}`;
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <span className="text-xs text-slate-400">{t("Duration","Длительность")}</span>
        <span className="text-sm font-semibold text-white">{lbl}</span>
      </div>
      <input type="range" min={0} max={DURATION_MARKS.length - 1} step={1} value={cur}
        onChange={e => onChange(String(DURATION_MARKS[parseInt(e.target.value)]))}
        className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-white/10 accent-red-500"
      />
      <div className="flex gap-1">
        {DURATION_MARKS.map((h, i) => (
          <button key={h} type="button" onClick={() => onChange(String(h))}
            className={`flex-1 h-8 rounded text-xs font-medium transition-all border ${i === cur ? "bg-red-500/20 border-red-500/30 text-red-400" : i < cur ? "bg-red-500/5 border-red-500/10 text-red-400/40" : "bg-white/[0.02] border-white/5 text-slate-500 hover:border-white/10"}`}>{h}h</button>
        ))}
      </div>
    </div>
  );
}

function getBarColor(pct: number) { return pct >= 100 ? "bg-red-500" : pct >= 70 ? "bg-yellow-400" : "bg-emerald-500"; }

export default function LimitsPage() {
  const { lang } = useLang();
  const t = (en: string, ru: string) => lang === "en" ? en : ru;
  const [limits,       setLimits]       = useState<LimitConfig>(defaultLimits);
  const [block,        setBlock]        = useState<BlockConfig>(defaultBlock);
  const [usage,        setUsage]        = useState<Usage | null>(null);
  const [isBlocked,    setIsBlocked]    = useState(false);
  const [blockedUntil, setBlockedUntil] = useState<string | null>(null);
  const [tab,          setTab]          = useState<"current" | "settings">("current");
  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [saved,        setSaved]        = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [lr, sr] = await Promise.all([fetch("/api/limits"), fetch("/api/stats")]);
      const lj = await lr.json() as { ok: boolean; limits: { dailyLossLimit: number; maxDrawdown: number; maxDailyTrades: number | null; maxConsecutiveLosses: number | null; maxPositionSize: number | null; maxRiskPerTrade: number | null; blockDurationHours: number; autoUnblock: boolean; } | null };
      const sj = await sr.json() as { ok: boolean; usage?: Usage | null; accounts?: { isBlocked: boolean; blockedUntil: string | null }[] };
      if (lj.ok && lj.limits) {
        const l = lj.limits;
        setLimits({ dailyLoss: String(l.dailyLossLimit), maxDrawdown: String(l.maxDrawdown), maxTrades: String(l.maxDailyTrades ?? 10), maxConsecLosses: String(l.maxConsecutiveLosses ?? 3), maxPositionSize: String(l.maxPositionSize ?? 2.0), riskPerTrade: String(l.maxRiskPerTrade ?? 100) });
        setBlock({ blockDuration: String(l.blockDurationHours), autoUnblock: l.autoUnblock });
      }
      if (sj.ok) {
        if (sj.usage) setUsage(sj.usage);
        // Блокировка активна только если blockedUntil ещё не наступило
        const now = new Date();
        const ba = (sj.accounts ?? []).find(a => a.isBlocked && (!a.blockedUntil || new Date(a.blockedUntil) > now));
        setIsBlocked(!!ba); setBlockedUntil(ba?.blockedUntil ?? null);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSave = async () => {
    if (isBlocked) return;
    setSaving(true);
    try {
      const res = await fetch("/api/limits", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dailyLossLimit: parseFloat(limits.dailyLoss)||2000, maxDrawdown: parseFloat(limits.maxDrawdown)||8000, maxDailyTrades: parseInt(limits.maxTrades)||10, maxConsecutiveLosses: parseInt(limits.maxConsecLosses)||3, maxPositionSize: parseFloat(limits.maxPositionSize)||2.0, maxRiskPerTrade: parseFloat(limits.riskPerTrade)||100, blockDurationHours: parseInt(block.blockDuration)||24, autoUnblock: block.autoUnblock, warningThresholdPct: 80 }),
      });
      const j = await res.json() as { ok: boolean };
      if (j.ok) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
    } finally { setSaving(false); }
  };

  const nL = { dailyLoss: parseFloat(limits.dailyLoss)||0, maxDrawdown: parseFloat(limits.maxDrawdown)||0, maxTrades: parseInt(limits.maxTrades)||0, maxConsecLosses: parseInt(limits.maxConsecLosses)||0, riskPerTrade: parseFloat(limits.riskPerTrade)||0 };
  const bars = [
    { label: t("Daily Loss","Дневной убыток"),    icon:"📉", cur: usage ? Math.abs(Math.min(usage.dailyPnl,0)) : 0,     lim: nL.dailyLoss,       fmt: (v: number) => "$"+v.toLocaleString("en-US",{maximumFractionDigits:0}) },
    { label: t("Max Drawdown","Макс. просадка"),  icon:"⚠️", cur: usage ? Math.abs(Math.min(usage.weeklyPnl,0)) : 0,    lim: nL.maxDrawdown,     fmt: (v: number) => "$"+v.toLocaleString("en-US",{maximumFractionDigits:0}) },
    { label: t("Trade Count","Кол-во сделок"),    icon:"🔁", cur: usage ? usage.dailyTradesCount : 0, lim: nL.maxTrades,       fmt: (v: number) => String(v) },
    { label: t("Consec. Losses","Убытков подряд"),icon:"🔴", cur: usage ? usage.consecutiveLosses : 0, lim: nL.maxConsecLosses, fmt: (v: number) => String(v) },
    { label: t("Risk/Trade ($)","Риск/сделка ($)"),icon:"🎯", cur: 0, lim: nL.riskPerTrade, fmt: (v: number) => "$"+v },
  ];
  const ic = "w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50 transition-colors";

  return (
    <AppShell>
      <PageTransition>
        <main className="flex-1 overflow-auto p-4 md:p-6 space-y-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex gap-1 bg-[#161b27] border border-white/5 rounded-xl p-1 w-fit">
              {([["current", t("Current Usage","Текущее использование")], ["settings", t("Limit Settings","Настройка лимитов")]] as const).map(([key, lbl]) => (
                <button key={key} onClick={() => setTab(key)} className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === key ? "bg-white/10 text-white" : "text-slate-500 hover:text-slate-300"}`}>{lbl}</button>
              ))}
            </div>
            {tab === "settings" && (
              <button onClick={handleSave} disabled={saving||loading||isBlocked}
                className={`text-xs font-semibold px-4 py-1.5 rounded-lg transition-colors ${saved ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/20" : saving ? "bg-white/5 text-slate-500 cursor-not-allowed" : isBlocked ? "bg-white/5 text-slate-600 cursor-not-allowed" : "bg-emerald-500 hover:bg-emerald-400 text-black"}`}>
                {saved ? t("✓ Saved","✓ Сохранено") : saving ? t("Saving...","Сохраняю...") : isBlocked ? "🔒 "+t("Locked","Заблокировано") : t("Save","Сохранить")}
              </button>
            )}
          </div>

          {tab === "current" && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: t("Active Limits","Активных лимитов"), value: bars.length.toString(), icon: "🛡" },
                  { label: t("Exceeded","Превышено"),             value: bars.filter(b => b.lim > 0 && (b.cur/b.lim) >= 1).length.toString(), icon: "🔴", color: "text-red-400" },
                  { label: t("Warnings","Предупреждений"),        value: bars.filter(b => { const p = b.lim > 0 ? b.cur/b.lim : 0; return p >= 0.7 && p < 1; }).length.toString(), icon: "⚠️", color: "text-yellow-400" },
                ].map(s => (
                  <div key={s.label} className="bg-[#161b27] border border-white/5 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2"><span>{s.icon}</span><p className="text-xs text-slate-500">{s.label}</p></div>
                    <p className={`text-2xl font-bold ${s.color ?? "text-white"}`}>{s.value}</p>
                  </div>
                ))}
              </div>
              {loading ? <div className="text-center py-10 text-slate-600 text-sm">{t("Loading...","Загрузка...")}</div> : (
                <div className="space-y-3">
                  {bars.map(b => {
                    const pct = b.lim > 0 ? Math.min((b.cur/b.lim)*100, 100) : 0;
                    const st  = pct >= 100 ? { text: t("Exceeded","Превышен"), cls: "text-red-400 bg-red-500/10 border-red-500/20" } : pct >= 70 ? { text: t("Warning","Предупреждение"), cls: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20" } : { text: t("Normal","В норме"), cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" };
                    return (
                      <div key={b.label} className="bg-[#161b27] border border-white/5 rounded-xl p-5">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2"><span>{b.icon}</span><p className="text-sm font-semibold text-white">{b.label}</p></div>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${st.cls}`}>{st.text}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex-1">
                            <div className="flex justify-between text-xs mb-1.5"><span className="text-slate-500">{t("Usage","Использование")}</span><span className="text-slate-300 font-medium">{b.fmt(b.cur)} / {b.fmt(b.lim)}</span></div>
                            <div className="h-2 bg-white/5 rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all ${getBarColor(pct)}`} style={{ width: `${pct}%` }} /></div>
                          </div>
                          <p className={`text-lg font-bold min-w-[46px] text-right ${pct >= 100 ? "text-red-400" : pct >= 70 ? "text-yellow-400" : "text-emerald-400"}`}>{Math.round(pct)}%</p>
                        </div>
                      </div>
                    );
                  })}
                  {!usage && <div className="bg-[#161b27] border border-white/5 rounded-xl p-4 text-center"><p className="text-xs text-slate-500">{t("No trade data. ","Нет данных. ")}<a href="/connect" className="text-emerald-400 hover:underline">{t("Connect an account","Подключите аккаунт")}</a></p></div>}
                </div>
              )}
            </>
          )}

          {tab === "settings" && (
            <div className="relative">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="bg-[#161b27] border border-white/5 rounded-xl p-6">
                  <h2 className="text-sm font-semibold text-white mb-1">{t("Risk Limits","Лимиты риска")}</h2>
                  <p className="text-xs text-slate-500 mb-5">{t("Set calmly before trading","Установите на спокойную голову")}</p>
                  <div className="space-y-4">
                    {[
                      { icon:"📉", label: t("Max Daily Loss ($)","Макс. дневной убыток ($)"), field:"dailyLoss", hint: t("Blocks when reached","Блок. при достижении") },
                      { icon:"⚠️", label: t("Max Drawdown ($)","Максимальная просадка ($)"), field:"maxDrawdown" },
                      { icon:"🔁", label: t("Max Trades per Day","Максимум сделок в день"), field:"maxTrades" },
                      { icon:"🔴", label: t("Max Consecutive Losses","Максимум убытков подряд"), field:"maxConsecLosses" },
                      { icon:"📊", label: t("Max Position Size (lot)","Макс. размер позиции (lot)"), field:"maxPositionSize", step:"0.1" },
                      { icon:"🎯", label: t("Max Risk per Trade ($)","Макс. риск на сделку ($)"), field:"riskPerTrade" },
                    ].map(f => (
                      <div key={f.field}>
                        <label className="text-xs text-slate-400 mb-1.5 flex items-center gap-1.5"><span>{f.icon}</span> {f.label}</label>
                        <input type="number" step={f.step} value={limits[f.field as keyof LimitConfig]} onChange={e => setLimits(l => ({ ...l, [f.field]: e.target.value }))} onFocus={e => e.target.select()} className={ic} />
                        {f.hint && <p className="text-[10px] text-slate-600 mt-1">{f.hint}</p>}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="bg-[#161b27] border border-white/5 rounded-xl p-6">
                    <h2 className="text-sm font-semibold text-white mb-1">{t("Blocking Conditions","Условия блокировки")}</h2>
                    <p className="text-xs text-slate-500 mb-5">{t("When to block trading","Когда блокировать торговлю")}</p>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between py-3 border-b border-white/5">
                        <div><p className="text-sm text-slate-200">{t("On daily limit reached","При достижении дневного лимита")}</p><p className="text-xs text-slate-500 mt-0.5">{t("Block at loss ≥","Блок. при убытке ≥")} ${(parseFloat(limits.dailyLoss)||0).toLocaleString()}</p></div>
                        <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">{t("Always","Всегда")}</span>
                      </div>
                      <div className="flex items-center justify-between py-3 border-b border-white/5">
                        <div><p className="text-sm text-slate-200">{t("On consecutive loss streak","При серии убытков")}</p><p className="text-xs text-slate-500 mt-0.5">{t("Block after","Блок. после")} {limits.maxConsecLosses} {t("losses","убытков")}</p></div>
                        <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">{t("Always","Всегда")}</span>
                      </div>
                      <div className="flex items-center justify-between py-3">
                        <div><p className="text-sm text-slate-200">{t("Auto-unblock","Авто-разблокировка")}</p><p className="text-xs text-slate-500 mt-0.5">{t("Unblock automatically after duration","Разблокировать автоматически")}</p></div>
                        <button onClick={() => setBlock(b => ({ ...b, autoUnblock: !b.autoUnblock }))} className={`w-11 h-6 rounded-full transition-colors relative ${block.autoUnblock ? "bg-emerald-500" : "bg-white/10"}`}>
                          <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${block.autoUnblock ? "left-6" : "left-1"}`} />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="bg-[#161b27] border border-white/5 rounded-xl p-6">
                    <h2 className="text-sm font-semibold text-white mb-1">{t("Block Duration","Длительность блокировки")}</h2>
                    <p className="text-xs text-slate-500 mb-5">{t("How long to block on violation","На сколько блокировать при нарушении")}</p>
                    <BlockDurationSlider value={block.blockDuration} onChange={v => setBlock(b => ({ ...b, blockDuration: v }))} lang={lang} />
                    <div className="mt-4 bg-red-500/5 border border-red-500/15 rounded-lg p-3">
                      <p className="text-[10px] text-slate-500">{t("On violation: blocked for","При нарушении: блок. на")} <strong className="text-red-400">{block.blockDuration}h</strong>. {block.autoUnblock ? t("Auto-unblocks.","Авто-разблок.") : t("Manual unblock required.","Ручная разблокировка.")}</p>
                    </div>
                  </div>
                  <div className="bg-[#161b27] border border-white/5 rounded-xl p-4 flex items-start gap-3">
                    <span className="text-lg">💡</span>
                    <p className="text-xs text-slate-500 leading-relaxed">{t("Blocking: all orders cancelled, positions closed at market. Click ","Блокировка: ордера отменяются, позиции закрываются по рынку. ")}<strong className="text-slate-400">{t("Save","Сохранить")}</strong>{t(" to apply changes."," для применения.")}</p>
                  </div>
                </div>
              </div>

              {isBlocked && (
                <div className="absolute inset-0 bg-[#0f1117]/85 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center z-10 gap-3 p-6">
                  <div className="text-5xl">🔒</div>
                  <h3 className="text-white font-bold text-lg text-center">{t("Limits Locked","Лимиты заблокированы")}</h3>
                  <p className="text-slate-400 text-sm text-center max-w-xs">{t("Cannot change limits during block period. Prevents bypassing your rules.","Нельзя изменять лимиты во время блокировки — защита от обхода правил.")}</p>
                  {blockedUntil && <div className="font-mono text-red-400 text-xl"><BlockTimer blockedUntil={blockedUntil} /></div>}
                  <p className="text-slate-500 text-xs">{t("Editable after block ends","Доступно после снятия блокировки")}</p>
                </div>
              )}
            </div>
          )}
        </main>
      </PageTransition>
    </AppShell>
  );
}
