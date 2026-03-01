"use client";

import { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/layout/Sidebar";
import { PageTransition } from "@/components/ui/animations";
import { validators, errorMessages, filters } from "@/lib/validation";

type UserSettings = {
  id:                 string;
  email:              string;
  name:               string | null;
  telegramChatId:     string | null;
  notifyEmail:        string | null;
  notifyOnBlock:      boolean;
  notifyOnWarning:    boolean;
  notifyDailySummary: boolean;
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);

  const [name,               setName]               = useState("");
  const [telegramChatId,     setTelegramChatId]     = useState("");
  const [notifyEmail,        setNotifyEmail]        = useState("");
  const [notifyOnBlock,      setNotifyOnBlock]      = useState(true);
  const [notifyOnWarning,    setNotifyOnWarning]    = useState(true);
  const [notifyDailySummary, setNotifyDailySummary] = useState(false);
  const [errors,             setErrors]             = useState<Record<string, string>>({});

  const setError = (key: string, msg: string) =>
    setErrors(prev => ({ ...prev, [key]: msg }));

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      const data = await res.json() as { ok: boolean; user: UserSettings };
      if (data.ok) {
        const u = data.user;
        setSettings(u);
        setName(u.name ?? "");
        setTelegramChatId(u.telegramChatId ?? "");
        setNotifyEmail(u.notifyEmail ?? "");
        setNotifyOnBlock(u.notifyOnBlock);
        setNotifyOnWarning(u.notifyOnWarning);
        setNotifyDailySummary(u.notifyDailySummary);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const handleSave = async () => {
    const newErrors: Record<string, string> = {
      name:           name && !validators.englishName(name) ? errorMessages.englishName : "",
      notifyEmail:    notifyEmail && !validators.email(notifyEmail) ? errorMessages.email : "",
      telegramChatId: telegramChatId && !validators.telegramId(telegramChatId) ? errorMessages.telegramId : "",
    };
    setErrors(newErrors);
    if (Object.values(newErrors).some(e => e)) return;

    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/settings", {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          name:               name || null,
          telegramChatId:     telegramChatId || null,
          notifyEmail:        notifyEmail || null,
          notifyOnBlock,
          notifyOnWarning,
          notifyDailySummary,
        }),
      });
      const data = await res.json() as { ok: boolean };
      if (data.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const hasErrors = Object.values(errors).some(e => e);

  const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative w-9 h-5 rounded-full transition-colors shrink-0 mt-0.5 ${value ? "bg-emerald-500" : "bg-white/10"}`}
    >
      <span className={`absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full transition-transform ${value ? "translate-x-4" : "translate-x-0.5"}`} />
    </button>
  );

  return (
    <div className="flex min-h-screen bg-[#0f1117] text-slate-200 font-[family-name:var(--font-geist-sans)]">
      <Sidebar />
      <PageTransition>

        <header className="h-14 border-b border-white/5 px-6 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-sm font-semibold text-white">Настройки</h1>
            <p className="text-xs text-slate-500">Профиль и уведомления</p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving || loading || hasErrors}
            className="text-xs px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-semibold transition-colors disabled:opacity-50"
          >
            {saving ? "Сохранение..." : saved ? "✓ Сохранено" : "Сохранить"}
          </button>
        </header>

        <main className="flex-1 overflow-auto p-6 space-y-6 max-w-3xl">
          {loading ? (
            <div className="text-center py-20 text-slate-600 text-sm">Загрузка...</div>
          ) : (
            <>
              {/* Профиль */}
              <section className="bg-[#161b27] border border-white/5 rounded-xl p-6">
                <h2 className="text-sm font-semibold text-white mb-5">Профиль</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-400 mb-1.5 block">Имя</label>
                    <input
                      value={name}
                      onChange={e => {
                        const filtered = filters.englishName(e.target.value);
                        setName(filtered);
                        if (e.target.value !== filtered) {
                          setError("name", errorMessages.englishName);
                        } else {
                          setError("name", "");
                        }
                      }}
                      onBlur={() => setError("name", name && !validators.englishName(name) ? errorMessages.englishName : "")}
                      placeholder="Your name"
                      className={`w-full bg-white/5 border rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none transition-colors ${errors.name ? "border-red-500/50 focus:border-red-500/50" : "border-white/10 focus:border-emerald-500/50"}`}
                    />
                    {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name}</p>}
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1.5 block">Email аккаунта</label>
                    <input
                      value={settings?.email ?? ""}
                      readOnly
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-500 cursor-not-allowed"
                    />
                  </div>
                </div>
              </section>

              {/* Telegram */}
              <section className="bg-[#161b27] border border-white/5 rounded-xl p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-sm font-semibold text-white">Telegram</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Мгновенные уведомления в Telegram</p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${telegramChatId ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-white/5 text-slate-500 border-white/10"}`}>
                    {telegramChatId ? "Подключён" : "Не настроен"}
                  </span>
                </div>

                <div>
                  <label className="text-xs text-slate-400 mb-1.5 block">Telegram Chat ID</label>
                  <input
                    value={telegramChatId}
                    onChange={e => {
                      const filtered = filters.telegramId(e.target.value);
                      setTelegramChatId(filtered);
                      if (e.target.value !== filtered) {
                        setError("telegramChatId", errorMessages.telegramId);
                      } else if (errors.telegramChatId) {
                        setError("telegramChatId", "");
                      }
                    }}
                    onBlur={() => setError("telegramChatId", telegramChatId && !validators.telegramId(telegramChatId) ? errorMessages.telegramId : "")}
                    placeholder="123456789"
                    className={`w-full max-w-xs bg-white/5 border rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none transition-colors ${errors.telegramChatId ? "border-red-500/50 focus:border-red-500/50" : "border-white/10 focus:border-emerald-500/50"}`}
                  />
                  {errors.telegramChatId && <p className="text-xs text-red-400 mt-1">{errors.telegramChatId}</p>}
                  <p className="text-xs text-slate-500 mt-2">
                    Напишите <span className="text-emerald-400 font-mono">@userinfobot</span> в Telegram и скопируйте ваш Chat ID.
                    Токен бота задаётся в переменной <span className="font-mono text-slate-400">TELEGRAM_BOT_TOKEN</span>.
                  </p>
                </div>
              </section>

              {/* Email */}
              <section className="bg-[#161b27] border border-white/5 rounded-xl p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-sm font-semibold text-white">Email</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Уведомления на почту через Resend</p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${settings?.email ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-white/5 text-slate-500 border-white/10"}`}>
                    {settings?.email ? "Активен" : "Нет email"}
                  </span>
                </div>

                <div>
                  <label className="text-xs text-slate-400 mb-1.5 block">
                    Email для уведомлений{" "}
                    <span className="text-slate-600">(по умолчанию — email аккаунта)</span>
                  </label>
                  <input
                    value={notifyEmail}
                    onChange={e => {
                      const filtered = filters.email(e.target.value);
                      setNotifyEmail(filtered);
                      if (e.target.value !== filtered) {
                        setError("notifyEmail", errorMessages.email);
                      } else if (errors.notifyEmail) {
                        setError("notifyEmail", "");
                      }
                    }}
                    onBlur={() => setError("notifyEmail", notifyEmail && !validators.email(notifyEmail) ? errorMessages.email : "")}
                    type="email"
                    placeholder={settings?.email ?? "alerts@example.com"}
                    className={`w-full max-w-sm bg-white/5 border rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none transition-colors ${errors.notifyEmail ? "border-red-500/50 focus:border-red-500/50" : "border-white/10 focus:border-emerald-500/50"}`}
                  />
                  {errors.notifyEmail && <p className="text-xs text-red-400 mt-1">{errors.notifyEmail}</p>}
                  <p className="text-xs text-slate-500 mt-2">
                    API-ключ задаётся в переменной <span className="font-mono text-slate-400">RESEND_API_KEY</span>.
                    Бесплатный план: 100 писем/день на <span className="text-slate-400">resend.com</span>.
                  </p>
                </div>
              </section>

              {/* Что уведомлять */}
              <section className="bg-[#161b27] border border-white/5 rounded-xl p-6">
                <h2 className="text-sm font-semibold text-white mb-5">Что уведомлять</h2>
                <div className="space-y-5">
                  {[
                    {
                      value:  notifyOnBlock,
                      setter: setNotifyOnBlock,
                      label:  "При блокировке торговли",
                      desc:   "Мгновенное уведомление при срабатывании лимита и автоматическом закрытии позиций",
                      badge:  "CRITICAL",
                      badgeCls: "bg-red-500/15 text-red-400",
                    },
                    {
                      value:  notifyOnWarning,
                      setter: setNotifyOnWarning,
                      label:  "При достижении 80% лимита",
                      desc:   "Предупреждение заблаговременно — до срабатывания блокировки",
                      badge:  "WARNING",
                      badgeCls: "bg-yellow-500/15 text-yellow-400",
                    },
                    {
                      value:  notifyDailySummary,
                      setter: setNotifyDailySummary,
                      label:  "Итоги дня (23:55 UTC)",
                      desc:   "Ежедневный отчёт с P&L, количеством сделок и Win Rate",
                      badge:  "DAILY",
                      badgeCls: "bg-blue-500/15 text-blue-400",
                    },
                  ].map(item => (
                    <div key={item.label} className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded mt-0.5 ${item.badgeCls}`}>{item.badge}</span>
                        <div>
                          <p className="text-sm text-slate-200">{item.label}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
                        </div>
                      </div>
                      <Toggle value={item.value} onChange={item.setter} />
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </main>
      </PageTransition>
    </div>
  );
}
