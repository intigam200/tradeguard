"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useLang } from "@/context/language";

type Breach = { id: string; breachType: string; severity: string; description: string | null; occurredAt: string; };

type HeaderStats = {
  breachesToday: number;
  recentBreaches: Breach[];
  isBlocked: boolean;
  dailyLossPct: number;
};

const PAGE_TITLES: Record<string, [string, string]> = {
  "/dashboard": ["Dashboard",       "Дашборд"],
  "/limits":    ["Limits & Blocking","Лимиты и блокировка"],
  "/settings":  ["Settings",        "Настройки"],
  "/breaches":  ["Violations",      "Нарушения"],
  "/connect":   ["Connect Broker",  "Подключение биржи"],
  "/journal":   ["Analytics",       "Аналитика"],
};

export function AppHeader() {
  const pathname = usePathname();
  const { lang, setLang } = useLang();
  const t = (en: string, ru: string) => lang === "en" ? en : ru;

  const [hs, setHs] = useState<HeaderStats>({ breachesToday: 0, recentBreaches: [], isBlocked: false, dailyLossPct: 0 });
  const [syncing,  setSyncing]  = useState(false);
  const [showBell, setShowBell] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const bellRef = useRef<HTMLDivElement>(null);

  const loadStats = async () => {
    try {
      const res  = await fetch("/api/stats");
      const data = await res.json() as {
        ok: boolean;
        accounts?: { isBlocked: boolean }[];
        limits?: { dailyLossLimit: number } | null;
        usage?: { dailyPnl: number } | null;
        breachesToday?: number;
        recentBreaches?: Breach[];
      };
      if (!data.ok) return;
      const blocked = (data.accounts ?? []).some(a => a.isBlocked);
      const pct = data.limits && data.usage
        ? Math.min(Math.abs(Math.min(data.usage.dailyPnl, 0)) / data.limits.dailyLossLimit * 100, 100)
        : 0;
      setHs({
        breachesToday: data.breachesToday ?? 0,
        recentBreaches: data.recentBreaches ?? [],
        isBlocked: blocked,
        dailyLossPct: pct,
      });
    } catch { /* ignore */ }
  };

  useEffect(() => {
    loadStats();
    const iv = setInterval(loadStats, 120_000);
    const onSynced = () => { setLastSync(new Date()); loadStats(); };
    window.addEventListener("tradeguard:synced", onSynced);
    return () => { clearInterval(iv); window.removeEventListener("tradeguard:synced", onSynced); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto sync every 2 minutes — server-side (Railway, not Vercel, so no IP block)
  useEffect(() => {
    const autoSync = async () => {
      try {
        const res  = await fetch("/api/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
        const data = await res.json() as { ok: boolean; results?: { isBlocked?: boolean }[] };
        if (!data.ok) return;
        const anyBlocked = data.results?.some(r => r.isBlocked);
        await loadStats();
        window.dispatchEvent(new Event("tradeguard:synced"));
        if (anyBlocked) window.location.reload();
      } catch { /* ignore */ }
    };

    // First auto-sync after 30s, then every 2 minutes
    const startTimer = setTimeout(() => {
      autoSync();
      const iv = setInterval(autoSync, 120_000);
      return () => clearInterval(iv);
    }, 30_000);

    return () => clearTimeout(startTimer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Close bell dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setShowBell(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Manual sync button — server-side
  const handleSync = async () => {
    setSyncing(true);
    try {
      const res  = await fetch("/api/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await res.json() as { ok: boolean; results?: { isBlocked?: boolean }[] };
      setLastSync(new Date());
      await loadStats();
      window.dispatchEvent(new Event("tradeguard:synced"));
      if (data.results?.some(r => r.isBlocked)) window.location.reload();
    } finally {
      setSyncing(false);
    }
  };

  const riskLevel = hs.isBlocked
    ? t("Blocked",     "Блокировка")
    : hs.dailyLossPct >= 80
    ? t("Critical",    "Критично")
    : hs.dailyLossPct >= 50
    ? t("High Risk",   "Выс. риск")
    : t("Normal",      "Норма");

  const riskColor = hs.isBlocked || hs.dailyLossPct >= 80
    ? "text-red-400 bg-red-400/10 border-red-400/20"
    : hs.dailyLossPct >= 50
    ? "text-yellow-400 bg-yellow-400/10 border-yellow-400/20"
    : "text-emerald-400 bg-emerald-400/10 border-emerald-400/20";

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  const minsAgo  = lastSync ? Math.round((Date.now() - lastSync.getTime()) / 60_000) : null;
  const syncLabel = minsAgo === null ? null : minsAgo === 0 ? t("Just synced", "Только что") : `${t("Synced", "Синхр.")} ${minsAgo}${t("m ago", "м")}`;

  const titles = PAGE_TITLES[pathname];
  const title   = titles ? (lang === "en" ? titles[0] : titles[1]) : "TradeGuard";

  return (
    <header className="h-14 border-b border-white/5 px-4 md:px-6 flex items-center justify-between shrink-0">
      <div>
        <h1 className="text-sm font-semibold text-white">{title}</h1>
        {syncLabel && <p className="text-xs text-slate-500">{syncLabel}</p>}
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        {/* Sync */}
        <button
          onClick={handleSync}
          disabled={syncing}
          className="text-xs px-2 md:px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 transition-colors disabled:opacity-50"
        >
          {syncing ? t("⟳ Syncing...", "⟳ Синхрон...") : t("⟳ Sync", "⟳ Синхр.")}
        </button>

        {/* Risk badge */}
        <span className={`hidden sm:flex items-center gap-1.5 text-xs font-medium border px-3 py-1 rounded-full ${riskColor}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
          {riskLevel}
        </span>

        {/* Lang */}
        <button
          onClick={() => setLang(lang === "en" ? "ru" : "en")}
          className="text-xs px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 transition-colors font-medium"
        >
          {lang === "en" ? "RU" : "EN"}
        </button>

        {/* Bell */}
        <div ref={bellRef} className="relative">
          <button
            onClick={() => setShowBell(v => !v)}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 transition-colors text-sm relative"
          >
            🔔
            {hs.breachesToday > 0 && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full text-[8px] text-white flex items-center justify-center font-bold">
                {hs.breachesToday > 9 ? "9+" : hs.breachesToday}
              </span>
            )}
          </button>

          {showBell && (
            <div className="absolute right-0 top-10 w-72 bg-[#1e2534] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">{t("Notifications", "Уведомления")}</h3>
                <button onClick={() => setShowBell(false)} className="text-slate-500 hover:text-slate-300 text-xs">✕</button>
              </div>
              <div className="divide-y divide-white/5 max-h-60 overflow-auto">
                {hs.recentBreaches.length === 0
                  ? <p className="px-4 py-3 text-xs text-slate-500">{t("No violations", "Нарушений нет")}</p>
                  : hs.recentBreaches.map(b => (
                    <div key={b.id} className="px-4 py-3">
                      <p className="text-xs text-slate-300">{b.description ?? b.breachType}</p>
                      <p className="text-[10px] text-slate-500 mt-1">{fmtTime(b.occurredAt)}</p>
                    </div>
                  ))
                }
              </div>
              <div className="px-4 py-2 border-t border-white/5">
                <a href="/breaches" className="text-xs text-emerald-400 hover:text-emerald-300">
                  {t("All violations →", "Все нарушения →")}
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
