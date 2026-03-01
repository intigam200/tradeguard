"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/layout/Sidebar";
import { PageTransition } from "@/components/ui/animations";
import { validators, errorMessages, filters } from "@/lib/validation";
import { BlockTimer } from "@/components/BlockTimer";

type BrokerDef = {
  id: string;
  name: string;
  logo: string;
  type: string;
  supported: boolean;
  fields: { key: string; label: string; placeholder: string; secret?: boolean }[];
};

const brokers: BrokerDef[] = [
  {
    id:        "BYBIT",
    name:      "Bybit",
    logo:      "🟠",
    type:      "Криптобиржа",
    supported: true,
    fields: [
      { key: "apiKey",    label: "API Key",    placeholder: "Enter API Key"    },
      { key: "apiSecret", label: "API Secret", placeholder: "Enter API Secret", secret: true },
    ],
  },
  {
    id:        "BINANCE",
    name:      "Binance Futures",
    logo:      "🟡",
    type:      "Криптобиржа",
    supported: true,
    fields: [
      { key: "apiKey",    label: "API Key",    placeholder: "Enter API Key"    },
      { key: "apiSecret", label: "API Secret", placeholder: "Enter API Secret", secret: true },
    ],
  },
  {
    id:        "mt4",
    name:      "MetaTrader 4",
    logo:      "📊",
    type:      "Форекс / CFD",
    supported: false,
    fields: [],
  },
  {
    id:        "mt5",
    name:      "MetaTrader 5",
    logo:      "📈",
    type:      "Форекс / CFD / Акции",
    supported: false,
    fields: [],
  },
  {
    id:        "okx",
    name:      "OKX",
    logo:      "⚫",
    type:      "Криптобиржа",
    supported: false,
    fields: [],
  },
];

type ConnectedAccount = {
  id:           string;
  broker:       string;
  label:        string | null;
  isBlocked:    boolean;
  blockedUntil: string | null;
  blockReason:  string | null;
  createdAt:    string;
};

type ConnectionStatus = "idle" | "connecting" | "connected" | "error";

export default function ConnectPage() {
  const [accounts, setAccounts]     = useState<ConnectedAccount[]>([]);
  const [selected, setSelected]     = useState<BrokerDef | null>(null);
  const [values, setValues]         = useState<Record<string, string>>({});
  const [label, setLabel]           = useState("");
  const [status, setStatus]         = useState<ConnectionStatus>("idle");
  const [errorMsg, setErrorMsg]     = useState("");
  const [balance, setBalance]       = useState<number | null>(null);
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [showForm, setShowForm]     = useState(false);
  const [dbError, setDbError]       = useState(false);
  const [retrying, setRetrying]     = useState(false);
  const [isTestnet, setIsTestnet]   = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [labelError,  setLabelError]  = useState("");

  // ── Инициализация: создать/получить пользователя, загрузить аккаунты ─────────

  useEffect(() => {
    setup();
  }, []);

  async function setup() {
    setRetrying(true);
    setDbError(false);
    try {
      const res  = await fetch("/api/setup");
      const data = await res.json() as { ok: boolean; error?: string };
      if (!data.ok) {
        console.error("Setup failed:", data.error);
        setDbError(true);
        return;
      }
      await loadAccounts();
    } catch (err) {
      console.error("Setup error:", err);
      setDbError(true);
    } finally {
      setRetrying(false);
    }
  }

  async function loadAccounts() {
    try {
      const res  = await fetch("/api/accounts");
      const data = await res.json() as { ok: boolean; accounts: ConnectedAccount[] };
      if (data.ok) {
        setAccounts(data.accounts);
        if (data.accounts.length > 0) setShowForm(false);
      }
    } catch (err) {
      console.error("loadAccounts error:", err);
    }
  }

  // ── Подключить новый аккаунт ─────────────────────────────────────────────────

  async function handleConnect() {
    if (!selected || !selected.supported) return;
    if (!selected.fields.every(f => values[f.key]?.trim())) return;

    // Validate all fields before connecting
    const newFieldErrors: Record<string, string> = {};
    for (const f of selected.fields) {
      const v = values[f.key]?.trim() ?? "";
      if (v && !validators.apiKey(v)) newFieldErrors[f.key] = errorMessages.apiKey;
    }
    const newLabelError = label && !validators.englishName(label) ? "Account name must be in English" : "";
    setFieldErrors(newFieldErrors);
    setLabelError(newLabelError);
    if (Object.values(newFieldErrors).some(e => e) || newLabelError) return;

    setStatus("connecting");
    setErrorMsg("");
    setBalance(null);

    try {
      const res  = await fetch("/api/accounts", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          broker:    selected.id,
          apiKey:    values["apiKey"]?.trim(),
          apiSecret: values["apiSecret"]?.trim(),
          label:     label.trim() || null,
          isTestnet: selected.id === "BYBIT" ? isTestnet : false,
        }),
      });

      const data = await res.json() as {
        ok: boolean;
        balance?: number;
        error?: string;
        accountId?: string;
      };

      if (!data.ok) {
        setStatus("error");
        setErrorMsg(data.error ?? "Неизвестная ошибка");
        return;
      }

      setStatus("connected");
      setBalance(data.balance ?? null);

      // Перезагрузить список аккаунтов
      await loadAccounts();

      // Сбросить форму
      setSelected(null);
      setValues({});
      setLabel("");
      setShowForm(false);
      setFieldErrors({});
      setLabelError("");

    } catch (err) {
      setStatus("error");
      setErrorMsg((err as Error).message);
    }
  }

  // ── Отключить аккаунт ─────────────────────────────────────────────────────────

  async function handleDisconnect(accountId: string) {
    setDisconnecting(accountId);
    try {
      const res = await fetch(`/api/accounts/${accountId}`, { method: "DELETE" });
      const data = await res.json() as { ok: boolean };
      if (data.ok) {
        setAccounts(prev => prev.filter(a => a.id !== accountId));
      }
    } catch (err) {
      console.error("disconnect error:", err);
    } finally {
      setDisconnecting(null);
    }
  }

  const hasAccounts = accounts.length > 0;
  const hasValidationErrors = Object.values(fieldErrors).some(e => e) || !!labelError;

  return (
    <div className="flex min-h-screen bg-[#0f1117] text-slate-200 font-[family-name:var(--font-geist-sans)]">
      <Sidebar />

      <PageTransition>
        <header className="h-14 border-b border-white/5 px-6 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-sm font-semibold text-white">Подключить брокера</h1>
            <p className="text-xs text-slate-500">Автоматический импорт сделок через API</p>
          </div>
          {hasAccounts && (
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                {accounts.length} аккаунт{accounts.length === 1 ? "" : "а"} подключено
              </span>
              {!showForm && (
                <button
                  onClick={() => { setShowForm(true); setStatus("idle"); setErrorMsg(""); }}
                  className="text-xs bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-lg transition-colors"
                >
                  + Добавить ещё
                </button>
              )}
            </div>
          )}
        </header>

        <main className="flex-1 overflow-auto p-6 space-y-6">

          {/* DB error banner */}
          {dbError && (
            <div className="bg-red-500/10 border border-red-500/25 rounded-xl p-4 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="text-lg shrink-0">⚠️</span>
                <div>
                  <p className="text-sm font-semibold text-red-400 mb-1">База данных недоступна</p>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Supabase проект скорее всего заморожен. Зайди на{" "}
                    <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-blue-400 underline">supabase.com</a>
                    {" "}→ выбери проект → нажми <strong className="text-slate-300">Restore project</strong>.
                    После разморозки выполни <code className="bg-black/30 px-1 rounded text-slate-300">npx prisma db push</code>.
                  </p>
                </div>
              </div>
              <button
                onClick={setup}
                disabled={retrying}
                className="shrink-0 text-xs text-slate-400 hover:text-white border border-white/10 hover:border-white/20 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              >
                {retrying ? "..." : "Повторить"}
              </button>
            </div>
          )}

          {/* Info banner */}
          <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl p-4 flex items-start gap-3">
            <span className="text-lg shrink-0">🔌</span>
            <div>
              <p className="text-sm font-semibold text-white mb-1">Как это работает</p>
              <p className="text-xs text-slate-400 leading-relaxed">
                Подключите ваш торговый счёт через API — и TradeGuard автоматически начнёт мониторинг
                в реальном времени. При нарушении лимитов система мгновенно закроет все позиции.
              </p>
            </div>
          </div>

          {/* Подключённые аккаунты */}
          {hasAccounts && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500 font-medium">Подключённые аккаунты</p>
              {accounts.map(acc => {
                const broker = brokers.find(b => b.id === acc.broker);
                return (
                  <div
                    key={acc.id}
                    className={`bg-[#161b27] border rounded-xl p-4 flex items-center justify-between ${
                      acc.isBlocked ? "border-red-500/25" : "border-emerald-500/20"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg ${
                        acc.isBlocked ? "bg-red-500/10" : "bg-emerald-500/10"
                      }`}>
                        {broker?.logo ?? "🔗"}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-white">
                            {acc.label ?? broker?.name ?? acc.broker}
                          </p>
                          {acc.label && (
                            <span className="text-[10px] text-slate-500">({broker?.name ?? acc.broker})</span>
                          )}
                        </div>
                        {acc.isBlocked ? (
                          <div>
                            <p className="text-xs text-red-400">
                              🔒 Заблокирован{acc.blockReason ? `: ${acc.blockReason}` : ""}
                            </p>
                            {acc.blockedUntil && (
                              <p className="text-xs text-slate-500 mt-0.5">
                                Разблокировка через: <BlockTimer blockedUntil={acc.blockedUntil} />
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-emerald-400">● Активен · Мониторинг запущен</p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDisconnect(acc.id)}
                      disabled={disconnecting === acc.id}
                      className="text-xs text-slate-400 hover:text-red-400 border border-white/10 hover:border-red-500/30 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {disconnecting === acc.id ? "..." : "Отключить"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Форма подключения */}
          {(!hasAccounts || showForm) && (
            <div className="grid grid-cols-3 gap-5">

              {/* Broker list */}
              <div className="col-span-1 space-y-2">
                <p className="text-xs text-slate-500 font-medium mb-3">Выберите платформу</p>
                {brokers.map(b => (
                  <button
                    key={b.id}
                    onClick={() => {
                      if (!b.supported) return;
                      setSelected(b);
                      setValues({});
                      setStatus("idle");
                      setErrorMsg("");
                      setIsTestnet(false);
                      setFieldErrors({});
                      setLabelError("");
                    }}
                    disabled={!b.supported}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                      !b.supported
                        ? "opacity-40 cursor-not-allowed bg-[#161b27] border-white/5"
                        : selected?.id === b.id
                        ? "bg-emerald-500/10 border-emerald-500/30 text-white"
                        : "bg-[#161b27] border-white/5 hover:border-white/10 text-slate-300"
                    }`}
                  >
                    <span className="text-xl w-8 text-center">{b.logo}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold">{b.name}</p>
                      <p className="text-[10px] text-slate-500">
                        {b.supported ? b.type : "Скоро"}
                      </p>
                    </div>
                    {b.supported && (
                      <span className="text-[10px] text-emerald-500 shrink-0">✓</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Connection form */}
              <div className="col-span-2">
                {selected ? (
                  <div className="bg-[#161b27] border border-white/5 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <span className="text-2xl">{selected.logo}</span>
                      <div>
                        <h2 className="text-sm font-semibold text-white">{selected.name}</h2>
                        <p className="text-xs text-slate-500">{selected.type}</p>
                      </div>
                    </div>

                    {/* Label field */}
                    <div className="mb-4">
                      <label className="text-xs text-slate-500 mb-1.5 block">
                        Название (необязательно)
                      </label>
                      <input
                        type="text"
                        value={label}
                        onChange={e => {
                          const filtered = filters.englishName(e.target.value);
                          setLabel(filtered);
                          if (e.target.value !== filtered) {
                            setLabelError("Account name must be in English");
                          } else {
                            setLabelError("");
                          }
                        }}
                        onBlur={() => setLabelError(label && !validators.englishName(label) ? "Account name must be in English" : "")}
                        placeholder="e.g. Main Bybit"
                        className={`w-full bg-[#0f1117] border rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none transition-colors ${labelError ? "border-red-500/50 focus:border-red-500/50" : "border-white/10 focus:border-emerald-500/50"}`}
                      />
                      {labelError && <p className="text-xs text-red-400 mt-1">{labelError}</p>}
                    </div>

                    {/* Demo Trading toggle (только для Bybit) */}
                    {selected.id === "BYBIT" && (
                      <div className="mb-4">
                        <label className="flex items-center gap-3 cursor-pointer select-none">
                          <div
                            onClick={() => setIsTestnet(v => !v)}
                            className={`relative w-9 h-5 rounded-full transition-colors ${isTestnet ? "bg-amber-500" : "bg-white/10"}`}
                          >
                            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${isTestnet ? "left-4" : "left-0.5"}`} />
                          </div>
                          <span className="text-xs text-slate-300">
                            Demo Trading
                            {isTestnet && <span className="ml-2 text-amber-400 text-[10px]">api-demo.bybit.com</span>}
                          </span>
                        </label>
                      </div>
                    )}

                    <div className="space-y-4 mb-6">
                      {selected.fields.map(f => (
                        <div key={f.key}>
                          <label className="text-xs text-slate-500 mb-1.5 block">{f.label}</label>
                          <div className="relative">
                            <input
                              type={f.secret && !showSecret[f.key] ? "password" : "text"}
                              value={values[f.key] ?? ""}
                              onChange={e => {
                                const filtered = filters.apiKey(e.target.value);
                                setValues(v => ({ ...v, [f.key]: filtered }));
                                if (fieldErrors[f.key]) {
                                  setFieldErrors(prev => ({ ...prev, [f.key]: "" }));
                                }
                              }}
                              onBlur={() => {
                                const v = values[f.key]?.trim() ?? "";
                                if (v) setFieldErrors(prev => ({ ...prev, [f.key]: !validators.apiKey(v) ? errorMessages.apiKey : "" }));
                              }}
                              placeholder={f.placeholder}
                              className={`w-full bg-[#0f1117] border rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none transition-colors pr-20 ${fieldErrors[f.key] ? "border-red-500/50 focus:border-red-500/50" : "border-white/10 focus:border-emerald-500/50"}`}
                            />
                            {f.secret && (
                              <button
                                type="button"
                                onClick={() => setShowSecret(s => ({ ...s, [f.key]: !s[f.key] }))}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
                              >
                                {showSecret[f.key] ? "скрыть" : "показать"}
                              </button>
                            )}
                          </div>
                          {fieldErrors[f.key] && <p className="text-xs text-red-400 mt-1">{fieldErrors[f.key]}</p>}
                        </div>
                      ))}
                    </div>

                    {/* Error */}
                    {status === "error" && errorMsg && (
                      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4 text-xs text-red-400">
                        {errorMsg}
                      </div>
                    )}

                    {/* Success balance */}
                    {status === "connected" && balance !== null && (
                      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 mb-4 text-xs text-emerald-400">
                        Подключено успешно. Баланс USDT: <strong>${balance.toFixed(2)}</strong>
                      </div>
                    )}

                    {/* Security note */}
                    <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3 mb-5 flex items-start gap-2">
                      <span className="text-sm shrink-0">🔒</span>
                      <p className="text-[10px] text-slate-500 leading-relaxed">
                        API-ключ проверяется напрямую на бирже перед сохранением.
                        Для мониторинга нужен доступ к чтению позиций. Для блокировки —
                        дополнительно разрешение на торговлю (только закрытие позиций).
                      </p>
                    </div>

                    <div className="flex gap-3">
                      {showForm && (
                        <button
                          onClick={() => { setShowForm(false); setSelected(null); setStatus("idle"); setFieldErrors({}); setLabelError(""); }}
                          className="px-4 py-2.5 rounded-xl text-sm text-slate-400 border border-white/10 hover:border-white/20 transition-colors"
                        >
                          Отмена
                        </button>
                      )}
                      <button
                        onClick={handleConnect}
                        disabled={
                          status === "connecting" ||
                          !selected.fields.every(f => values[f.key]?.trim()) ||
                          hasValidationErrors
                        }
                        className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                          status === "connecting"
                            ? "bg-emerald-500/20 text-emerald-400 cursor-wait"
                            : selected.fields.length === 0 || (selected.fields.every(f => values[f.key]?.trim()) && !hasValidationErrors)
                            ? "bg-emerald-500 hover:bg-emerald-400 text-black"
                            : "bg-white/5 text-slate-600 cursor-not-allowed"
                        }`}
                      >
                        {status === "connecting" ? "Проверка ключей..." : "Подключить"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-[#161b27] border border-white/5 rounded-xl h-full flex items-center justify-center min-h-[300px]">
                    <div className="text-center">
                      <p className="text-3xl mb-3">🔗</p>
                      <p className="text-sm text-slate-500">Выберите брокера слева</p>
                      <p className="text-xs text-slate-600 mt-1">Доступны: Bybit, Binance Futures</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        </main>
      </PageTransition>
    </div>
  );
}
