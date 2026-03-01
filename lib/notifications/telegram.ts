/**
 * lib/notifications/telegram.ts — отправка уведомлений через Telegram Bot API
 *
 * Использует node-telegram-bot-api (polling: false — только отправка).
 * Требует TELEGRAM_BOT_TOKEN в .env
 */

import TelegramBot from "node-telegram-bot-api";

function getBot(): TelegramBot | null {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  return new TelegramBot(token, { polling: false });
}

export async function sendTelegramAlert(chatId: string, message: string): Promise<void> {
  const bot = getBot();
  if (!bot) {
    console.warn("[Telegram] TELEGRAM_BOT_TOKEN not set, skipping");
    return;
  }
  try {
    await bot.sendMessage(chatId, message, { parse_mode: "HTML" });
  } catch (e) {
    console.error("[Telegram] sendMessage error:", e);
  }
}

// ─── Шаблоны сообщений ──────────────────────────────────────────────────────

export const messages = {
  warning80: (limitType: string, current: string, max: string) =>
    `⚠️ <b>TradeGuard — Предупреждение</b>\n\n` +
    `Ты достиг 80% лимита: <b>${limitType}</b>\n` +
    `Текущее значение: <b>${current}</b>\n` +
    `Лимит: <b>${max}</b>\n\n` +
    `Будь осторожен — осталось немного до блокировки.`,

  blocked: (reason: string, until: string) =>
    `🔴 <b>TradeGuard — Торговля ЗАБЛОКИРОВАНА</b>\n\n` +
    `Причина: <b>${reason}</b>\n` +
    `Все позиции закрыты автоматически.\n` +
    `Разблокировка: <b>${until}</b>\n\n` +
    `Используй это время чтобы проанализировать сделки.`,

  dailySummary: (pnl: string, trades: number, winRate: string) =>
    `📊 <b>TradeGuard — Итоги дня</b>\n\n` +
    `P&amp;L: <b>${pnl}</b>\n` +
    `Сделок: <b>${trades}</b>\n` +
    `Win Rate: <b>${winRate}</b>`,
};
