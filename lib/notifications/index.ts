/**
 * lib/notifications/index.ts — единый сервис уведомлений
 *
 * Читает настройки из User.notifyOnBlock / notifyOnWarning / notifyDailySummary
 * и отправляет Telegram + Email в зависимости от конфигурации.
 */

import { prisma } from "@/lib/prisma";
import { sendTelegramAlert, messages as tgMessages } from "./telegram";
import { sendEmailAlert, emailTemplates }            from "./email";

// ─── Блокировка аккаунта ─────────────────────────────────────────────────────

export async function notifyBlocked(
  accountId: string,
  reason:    string,
  until:     string,
): Promise<void> {
  const account = await prisma.connectedAccount.findUnique({
    where:   { id: accountId },
    include: { user: true },
  });
  if (!account || !account.user.notifyOnBlock) return;

  const { user } = account;
  const emailTo = user.notifyEmail ?? user.email;

  if (user.telegramChatId) {
    await sendTelegramAlert(user.telegramChatId, tgMessages.blocked(reason, until));
  }

  if (emailTo) {
    const t = emailTemplates.blocked(reason, until);
    await sendEmailAlert(emailTo, t.subject, t.html);
  }
}

// ─── Предупреждение 80% ───────────────────────────────────────────────────────

export async function notifyWarning(
  accountId: string,
  limitType: string,
  current:   string,
  max:       string,
): Promise<void> {
  const account = await prisma.connectedAccount.findUnique({
    where:   { id: accountId },
    include: { user: true },
  });
  if (!account || !account.user.notifyOnWarning) return;

  const { user } = account;
  const emailTo = user.notifyEmail ?? user.email;

  if (user.telegramChatId) {
    await sendTelegramAlert(user.telegramChatId, tgMessages.warning80(limitType, current, max));
  }

  if (emailTo) {
    const t = emailTemplates.warning80(limitType, current, max);
    await sendEmailAlert(emailTo, t.subject, t.html);
  }
}

// ─── Итоги дня (по accountId или userId) ─────────────────────────────────────

export async function sendDailySummary(
  accountId: string,
  pnl:       string,
  trades:    number,
  winRate:   string,
): Promise<void> {
  const account = await prisma.connectedAccount.findUnique({
    where:   { id: accountId },
    include: { user: true },
  });
  if (!account || !account.user.notifyDailySummary) return;

  const { user } = account;
  const emailTo = user.notifyEmail ?? user.email;

  if (user.telegramChatId) {
    await sendTelegramAlert(user.telegramChatId, tgMessages.dailySummary(pnl, trades, winRate));
  }

  if (emailTo) {
    const t = emailTemplates.dailySummary(pnl, trades, winRate);
    await sendEmailAlert(emailTo, t.subject, t.html);
  }
}

// ─── Итоги дня для всех пользователей (вызывается из cron) ──────────────────

export async function sendAllDailySummaries(): Promise<void> {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  // Пользователи, у которых включён notifyDailySummary
  const users = await prisma.user.findMany({
    where: { notifyDailySummary: true },
    include: { connectedAccounts: { where: { isActive: true }, take: 1 } },
  });

  for (const user of users) {
    try {
      const trades = await prisma.trade.findMany({
        where:  { userId: user.id, status: "CLOSED", closedAt: { gte: todayStart } },
        select: { realizedPnl: true },
      });

      if (trades.length === 0) continue;

      const totalPnl  = trades.reduce((s, t) => s + (t.realizedPnl ?? 0), 0);
      const winners   = trades.filter(t => (t.realizedPnl ?? 0) > 0).length;
      const winRate   = ((winners / trades.length) * 100).toFixed(0) + "%";
      const pnlStr    = (totalPnl >= 0 ? "+" : "") + "$" + Math.abs(totalPnl).toFixed(2);

      const emailTo = user.notifyEmail ?? user.email;

      if (user.telegramChatId) {
        await sendTelegramAlert(user.telegramChatId, tgMessages.dailySummary(pnlStr, trades.length, winRate));
      }
      if (emailTo) {
        const t = emailTemplates.dailySummary(pnlStr, trades.length, winRate);
        await sendEmailAlert(emailTo, t.subject, t.html);
      }
    } catch (err) {
      console.error(`[Notifications] dailySummary error for user ${user.id}:`, err);
    }
  }
}
