/**
 * lib/notifications/email.ts — отправка email-уведомлений через Resend
 *
 * Требует RESEND_API_KEY в .env
 * Бесплатный план resend.com: 100 писем/день, домен resend.dev
 */

import { Resend } from "resend";

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

export async function sendEmailAlert(to: string, subject: string, html: string): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.warn("[Email] RESEND_API_KEY not set, skipping");
    return;
  }
  try {
    await resend.emails.send({
      from: "TradeGuard <alerts@tradeguard.io>",
      to,
      subject,
      html,
    });
  } catch (e) {
    console.error("[Email] send error:", e);
  }
}

// ─── HTML-шаблоны ────────────────────────────────────────────────────────────

const wrap = (content: string) => `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0f1117;color:#e2e8f0;padding:32px;border-radius:12px;">
    ${content}
    <hr style="border:none;border-top:1px solid #1e293b;margin:24px 0;">
    <p style="color:#64748b;font-size:13px;margin:0;">TradeGuard — Контроль торговой дисциплины</p>
  </div>
`;

export const emailTemplates = {
  blocked: (reason: string, until: string) => ({
    subject: "🔴 Торговля заблокирована — TradeGuard",
    html: wrap(`
      <h1 style="color:#ef4444;margin-top:0;">🔴 Торговля заблокирована</h1>
      <p>Причина: <strong>${reason}</strong></p>
      <p>Все позиции закрыты автоматически.</p>
      <p>Разблокировка: <strong>${until}</strong></p>
    `),
  }),

  warning80: (limitType: string, current: string, max: string) => ({
    subject: "⚠️ Внимание — 80% лимита достигнуто",
    html: wrap(`
      <h1 style="color:#f59e0b;margin-top:0;">⚠️ Предупреждение</h1>
      <p>Лимит: <strong>${limitType}</strong></p>
      <p>Текущее: <strong>${current}</strong></p>
      <p>Максимум: <strong>${max}</strong></p>
    `),
  }),

  dailySummary: (pnl: string, trades: number, winRate: string) => ({
    subject: "📊 Итоги торгового дня — TradeGuard",
    html: wrap(`
      <h1 style="color:#22c55e;margin-top:0;">📊 Итоги дня</h1>
      <p>P&L: <strong>${pnl}</strong></p>
      <p>Сделок: <strong>${trades}</strong></p>
      <p>Win Rate: <strong>${winRate}</strong></p>
    `),
  }),
};
