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

type AccountInfo = {
  id:        string;
  broker:    string;
  label:     string | null;
  isTestnet: boolean;
};

type SignResult = {
  ok:         boolean;
  apiKey?:    string;
  timestamp?: string;
  signature?: string;
  recvWindow?: string;
  isTestnet?: boolean;
};

const PAGE_TITLES: Record<string, [string, string]> = {
  "/dashboard": ["Dashboard",       "Дашборд"],
  "/limits":    ["Limits & Blocking","Лимиты и блокировка"],
  "/settings":  ["Settings",        "Настройки"],
  "/breaches":  ["Violations",      "Нарушения"],
  "/connect":   ["Connect Broker",  "Подключение биржи"],
  "/journal":   ["Analytics",       "Аналитика"],
};

// ── Sign a Bybit request server-side (keeps apiSecret on server) ──────────────
async function bybitSign(accountId: string, queryString: string): Promise<SignResult | null> {
  try {
    const res = await fetch("/api/bybit/sign", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ accountId, queryString }),
    });
    return await res.json() as SignResult;
  } catch {
    return null;
  }
}

// ── Call Bybit API directly from browser (bypasses Vercel IP block) ───────────
async function bybitGet<T>(
  baseUrl: string,
  path:    string,
  qs:      string,
  sign:    SignResult,
): Promise<T | null> {
  try {
    const res = await fetch(`${baseUrl}${path}?${qs}`, {
      headers: {
        "X-BAPI-API-KEY":     sign.apiKey!,
        "X-BAPI-TIMESTAMP":   sign.timestamp!,
        "X-BAPI-SIGN":        sign.signature!,
        "X-BAPI-RECV-WINDOW": sign.recvWindow!,
      },
    });
    if (!res.headers.get("content-type")?.includes("application/json")) return null;
    return await res.json() as T;
  } catch {
    return null;
  }
}

// ── Sync one Bybit account from browser ──────────────────────────────────────
async function syncBybitAccount(acc: AccountInfo): Promise<{ synced: number; skipped: number; isBlocked: boolean }> {
  const baseUrl = acc.isTestnet ? "https://api-demo.bybit.com" : "https://api.bybit.com";

  // 1. Fetch closed trades (today)
  const todayMs = new Date(); todayMs.setUTCHours(0, 0, 0, 0);
  const closedQs = `category=linear&limit=200&startTime=${todayMs.getTime()}`;
  const closedSign = await bybitSign(acc.id, closedQs);
  if (!closedSign?.ok) return { synced: 0, skipped: 0, isBlocked: false };

  type ClosedPnlData = { retCode: number; result?: { list?: unknown[] } };
  const closedData = await bybitGet<ClosedPnlData>(baseUrl, "/v5/position/closed-pnl", closedQs, closedSign);
  const trades = closedData?.retCode === 0 ? (closedData.result?.list ?? []) : [];

  // 2. Fetch unrealized PnL from open positions
  let unrealizedPnl = 0;
  const posQs   = "category=linear&settleCoin=USDT";
  const posSign = await bybitSign(acc.id, posQs);
  if (posSign?.ok) {
    type PosData = { retCode: number; result?: { list?: { unrealisedPnl?: string; size?: string }[] } };
    const posData = await bybitGet<PosData>(baseUrl, "/v5/position/list", posQs, posSign);
    if (posData?.retCode === 0) {
      unrealizedPnl = (posData.result?.list ?? [])
        .filter(p => parseFloat(p.size ?? "0") !== 0)
        .reduce((s, p) => s + parseFloat(p.unrealisedPnl ?? "0"), 0);
    }
  }

  // 3. POST to server to save and check limits
  try {
    const importRes  = await fetch("/api/trades/import", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ accountId: acc.id, trades, unrealizedPnl }),
    });
    const importData = await importRes.json() as { ok: boolean; synced?: number; skipped?: number; isBlocked?: boolean };
    if (importData.ok) {
      return { synced: importData.synced ?? 0, skipped: importData.skipped ?? 0, isBlocked: importData.isBlocked ?? false };
    }
  } catch { /* ignore */ }

  return { synced: 0, skipped: 0, isBlocked: false };
}

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
  }, []);

  // Close bell dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setShowBell(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Client-side sync: browser fetches from Bybit directly ─────────────────
  const handleSync = async () => {
    setSyncing(true);
    try {
      // Get list of connected accounts
      const accRes  = await fetch("/api/accounts");
      const accData = await accRes.json() as { ok: boolean; accounts?: AccountInfo[] };
      const accounts = accData.accounts ?? [];

      let anyBlocked = false;

      for (const acc of accounts) {
        if (acc.broker !== "BYBIT") continue;
        const result = await syncBybitAccount(acc);
        if (result.isBlocked) anyBlocked = true;
      }

      setLastSync(new Date());
      await loadStats();
      window.dispatchEvent(new Event("tradeguard:synced"));

      // If any account was just blocked, reload the page to show block banner
      if (anyBlocked) window.location.reload();
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
