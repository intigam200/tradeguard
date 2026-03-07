"use client";

import { useState, useEffect, useCallback } from "react";
import AppShell from "@/components/layout/AppShell";
import { PageTransition } from "@/components/ui/animations";
import { validators, errorMessages, filters } from "@/lib/validation";
import { useLang } from "@/context/language";
import { PageLoader } from "@/components/ui/page-loader";

type UserSettings = {
  id: string; email: string; name: string | null; telegramChatId: string | null; notifyEmail: string | null;
  notifyOnBlock: boolean; notifyOnWarning: boolean; notifyDailySummary: boolean; notifyOnUnblock: boolean; notifyOnNewTrade: boolean;
};

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none ${value ? "bg-emerald-500" : "bg-white/10"}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${value ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

export default function SettingsPage() {
  const { lang } = useLang();
  const t = (en: string, ru: string) => lang === "en" ? en : ru;
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
  const [notifyOnUnblock,    setNotifyOnUnblock]    = useState(false);
  const [notifyOnNewTrade,   setNotifyOnNewTrade]   = useState(false);
  const [errors,             setErrors]             = useState<Record<string, string>>({});

  const setError = (key: string, msg: string) => setErrors(prev => ({ ...prev, [key]: msg }));

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
        setNotifyOnUnblock(u.notifyOnUnblock);
        setNotifyOnNewTrade(u.notifyOnNewTrade);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
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
    setSaving(true); setSaved(false);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name || null, telegramChatId: telegramChatId || null, notifyEmail: notifyEmail || null, notifyOnBlock, notifyOnWarning, notifyDailySummary, notifyOnUnblock, notifyOnNewTrade }),
      });
      const data = await res.json() as { ok: boolean };
      if (data.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const hasErrors = Object.values(errors).some(e => e);

  if (loading) return <AppShell><PageLoader /></AppShell>;

  return (
    <AppShell>
      <PageTransition>
        <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6 max-w-3xl">
          {/* Save button row */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">{t("Profile and notifications","Профиль и уведомления")}</p>
            <button onClick={handleSave} disabled={saving||loading||hasErrors}
              className="text-xs px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-semibold transition-colors disabled:opacity-50">
              {saving ? t("Saving...","Сохранение...") : saved ? t("✓ Saved","✓ Сохранено") : t("Save","Сохранить")}
            </button>
          </div>

          {loading ? <div className="text-center py-20 text-slate-600 text-sm">{t("Loading...","Загрузка...")}</div> : (
            <>
              {/* Profile */}
              <section className="bg-[#161b27] border border-white/5 rounded-xl p-6">
                <h2 className="text-sm font-semibold text-white mb-5">{t("Profile","Профиль")}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-400 mb-1.5 block">{t("Name","Имя")}</label>
                    <input value={name}
                      onChange={e => { const f = filters.englishName(e.target.value); setName(f); setError("name", e.target.value !== f ? errorMessages.englishName : ""); }}
                      onBlur={() => setError("name", name && !validators.englishName(name) ? errorMessages.englishName : "")}
                      placeholder="Your name"
                      className={`w-full bg-white/5 border rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none transition-colors ${errors.name ? "border-red-500/50" : "border-white/10 focus:border-emerald-500/50"}`} />
                    {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name}</p>}
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1.5 block">{t("Account Email","Email аккаунта")}</label>
                    <input value={settings?.email ?? ""} readOnly className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-500 cursor-not-allowed" />
                  </div>
                </div>
              </section>

              {/* Telegram */}
              <section className="bg-[#161b27] border border-white/5 rounded-xl p-6">
                <div className="flex items-start justify-between mb-4">
                  <div><h2 className="text-sm font-semibold text-white">Telegram</h2><p className="text-xs text-slate-500 mt-0.5">{t("Instant Telegram notifications","Мгновенные уведомления в Telegram")}</p></div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${telegramChatId ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-white/5 text-slate-500 border-white/10"}`}>{telegramChatId ? t("Connected","Подключён") : t("Not set up","Не настроен")}</span>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1.5 block">Telegram Chat ID</label>
                  <input value={telegramChatId}
                    onChange={e => { const f = filters.telegramId(e.target.value); setTelegramChatId(f); setError("telegramChatId", e.target.value !== f ? errorMessages.telegramId : ""); }}
                    onBlur={() => setError("telegramChatId", telegramChatId && !validators.telegramId(telegramChatId) ? errorMessages.telegramId : "")}
                    placeholder="123456789"
                    className={`w-full max-w-xs bg-white/5 border rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none transition-colors ${errors.telegramChatId ? "border-red-500/50" : "border-white/10 focus:border-emerald-500/50"}`} />
                  {errors.telegramChatId && <p className="text-xs text-red-400 mt-1">{errors.telegramChatId}</p>}
                  <p className="text-xs text-slate-500 mt-2">{t("Message","Напишите")} <span className="text-emerald-400 font-mono">@userinfobot</span> {t("in Telegram and copy your Chat ID.","в Telegram и скопируйте Chat ID.")} {t("Bot token:","Токен бота:")} <span className="font-mono text-slate-400">TELEGRAM_BOT_TOKEN</span></p>
                </div>
              </section>

              {/* Email */}
              <section className="bg-[#161b27] border border-white/5 rounded-xl p-6">
                <div className="flex items-start justify-between mb-4">
                  <div><h2 className="text-sm font-semibold text-white">Email</h2><p className="text-xs text-slate-500 mt-0.5">{t("Email notifications via Resend","Уведомления на почту через Resend")}</p></div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${settings?.email ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-white/5 text-slate-500 border-white/10"}`}>{settings?.email ? t("Active","Активен") : t("No email","Нет email")}</span>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1.5 block">{t("Notification email","Email для уведомлений")} <span className="text-slate-600">({t("default — account email","по умолчанию — email аккаунта")})</span></label>
                  <input value={notifyEmail}
                    onChange={e => { const f = filters.email(e.target.value); setNotifyEmail(f); setError("notifyEmail", e.target.value !== f ? errorMessages.email : ""); }}
                    onBlur={() => setError("notifyEmail", notifyEmail && !validators.email(notifyEmail) ? errorMessages.email : "")}
                    type="email" placeholder={settings?.email ?? "alerts@example.com"}
                    className={`w-full max-w-sm bg-white/5 border rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none transition-colors ${errors.notifyEmail ? "border-red-500/50" : "border-white/10 focus:border-emerald-500/50"}`} />
                  {errors.notifyEmail && <p className="text-xs text-red-400 mt-1">{errors.notifyEmail}</p>}
                  <p className="text-xs text-slate-500 mt-2">{t("API key:","API-ключ:")} <span className="font-mono text-slate-400">RESEND_API_KEY</span>. {t("Free plan: 100 emails/day at","Бесплатно: 100 писем/день на")} <span className="text-slate-400">resend.com</span>.</p>
                </div>
              </section>

              {/* Notifications */}
              <section className="bg-[#161b27] border border-white/5 rounded-xl p-6">
                <h2 className="text-sm font-semibold text-white mb-5">{t("Notify me when","Что уведомлять")}</h2>
                <div className="space-y-2 w-full">
                  {[
                    { value: notifyOnBlock,      setter: setNotifyOnBlock,      label: t("Trading is blocked","Торговля заблокирована"),       desc: t("When any limit is reached and trading stops","Когда лимит срабатывает и торговля останавливается") },
                    { value: notifyOnWarning,    setter: setNotifyOnWarning,    label: t("80% of limit reached","Достигнуто 80% лимита"),       desc: t("Early warning before blocking","Предупреждение до блокировки") },
                    { value: notifyDailySummary, setter: setNotifyDailySummary, label: t("Daily summary","Итоги дня"),                         desc: t("End of day report (23:55 UTC)","Отчёт в конце дня (23:55 UTC)") },
                    { value: notifyOnUnblock,    setter: setNotifyOnUnblock,    label: t("Trading is unblocked","Торговля разблокирована"),     desc: t("When block ends or admin approves early unblock","Когда блок истекает или одобрена досрочная разблокировка") },
                    { value: notifyOnNewTrade,   setter: setNotifyOnNewTrade,   label: t("New trade detected","Обнаружена новая сделка"),       desc: t("Each time a trade is synced from your exchange","При каждой синхронизации сделки с биржи") },
                  ].map(item => (
                    <div key={item.label}
                      className="flex items-center justify-between p-4 bg-white/[0.025] rounded-xl border border-white/5 hover:border-white/10 transition-colors cursor-pointer"
                      onClick={() => item.setter(!item.value)}>
                      <div className="flex-1 min-w-0 pr-4">
                        <p className="text-sm font-medium text-white">{item.label}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
                      </div>
                      <div className="flex-shrink-0" onClick={e => e.stopPropagation()}>
                        <Toggle value={item.value} onChange={item.setter} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </main>
      </PageTransition>
    </AppShell>
  );
}
