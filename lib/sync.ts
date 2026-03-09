/**
 * Shared sync helper — импортирует закрытые сделки с биржи в таблицу trades.
 *
 * Используется из:
 *   - POST /api/sync  (ручная синхронизация пользователем)
 *   - GET  /api/cron  (автоматическая синхронизация каждую минуту)
 */

import { prisma }      from "./prisma";
import { BybitClient } from "./exchanges/bybit-client";
import { decrypt }     from "./crypto";
import type { BreachType } from "@/app/generated/prisma/enums";

export type SyncResult = {
  accountId:     string;
  broker:        string;
  synced:        number;
  skipped:       number;
  unrealizedPnl: number;
  error?:        string;
};

// ─── Синхронизировать один аккаунт ───────────────────────────────────────────

export async function syncAccount(accountId: string): Promise<SyncResult> {
  const account = await prisma.connectedAccount.findUnique({
    where: { id: accountId },
  });

  if (!account) {
    return { accountId, broker: "UNKNOWN", synced: 0, skipped: 0, unrealizedPnl: 0, error: "Account not found" };
  }

  if (account.broker === "DEMO") {
    return { accountId, broker: account.broker, synced: 0, skipped: 0, unrealizedPnl: 0 };
  }

  if (account.broker === "BYBIT") {
    return syncBybitAccount(account.id, account.userId, account.apiKey, account.apiSecret, account.isTestnet);
  }

  // Binance и другие — пока не реализованы
  return { accountId, broker: account.broker, synced: 0, skipped: 0, unrealizedPnl: 0 };
}

// ─── Синхронизировать все активные Bybit-аккаунты ────────────────────────────

export async function syncAllAccounts(): Promise<SyncResult[]> {
  const accounts = await prisma.connectedAccount.findMany({
    where: { broker: { notIn: ["DEMO"] } },
  });

  const results: SyncResult[] = [];
  for (const acc of accounts) {
    const result = await syncAccount(acc.id);
    results.push(result);
    if (!result.error) {
      await checkLimitsFromDb(acc.id, result.unrealizedPnl).catch((e: Error) =>
        console.error(`[Sync] checkLimitsFromDb error (${acc.id}):`, e.message)
      );
    }
  }
  return results;
}

// ─── Внутренняя: синхронизация одного Bybit-аккаунта ─────────────────────────

async function syncBybitAccount(
  accountId: string,
  userId:    string,
  apiKey:    string,
  apiSecret: string,
  isTestnet: boolean
): Promise<SyncResult> {
  // Force mainnet — demo keys should not be used for real limit checks
  const client = new BybitClient(decrypt(apiKey), decrypt(apiSecret), false);

  // Первый запуск → 90 дней; повторный → последние 7 дней
  const existingCount = await prisma.trade.count({ where: { accountId } });
  const isFirstSync   = existingCount === 0;
  const startMs       = isFirstSync
    ? Date.now() - 90 * 24 * 3_600_000
    : Date.now() -  7 * 24 * 3_600_000;

  console.log(`[Sync] ${accountId}: isTestnet=${isTestnet} isFirstSync=${isFirstSync} startMs=${new Date(startMs).toISOString()}`);

  let trades;
  let unrealizedPnl = 0;
  try {
    [trades, unrealizedPnl] = await Promise.all([
      client.getHistoricalTrades(startMs),
      client.getUnrealizedPnl().catch(() => 0),
    ]);
  } catch (err) {
    const msg = (err as Error).message;
    console.error(`[Sync] fetchTrades failed for ${accountId}:`, msg);
    return { accountId, broker: "BYBIT", synced: 0, skipped: 0, unrealizedPnl: 0, error: msg };
  }

  console.log(`[Sync] ${accountId}: fetched ${trades.length} closed trade(s), unrealizedPnl=${unrealizedPnl.toFixed(2)}`);

  let synced = 0;
  let skipped = 0;

  for (const t of trades) {
    // Проверяем дедупликацию по externalId + userId
    const existing = await prisma.trade.findFirst({
      where: { userId, externalId: t.orderId },
      select: { id: true },
    });

    if (existing) {
      skipped++;
      continue;
    }

    const closedAt = new Date(parseInt(t.createdTime));

    try {
      await prisma.trade.create({
        data: {
          userId,
          accountId,
          externalId:  t.orderId,
          symbol:      t.symbol,
          // Сторона закрытия Sell → позиция была LONG; Buy → позиция была SHORT
          direction:   t.side === "Sell" ? "LONG" : "SHORT",
          status:      "CLOSED",
          entryPrice:  parseFloat(t.avgEntryPrice) || 0,
          exitPrice:   parseFloat(t.avgExitPrice)  || 0,
          quantity:    parseFloat(t.qty)            || 0,
          realizedPnl: parseFloat(t.closedPnl)     || 0,
          commission:  0,
          // openedAt ≈ closedAt (Bybit closed-pnl не содержит точное время открытия)
          openedAt:    closedAt,
          closedAt,
        },
      });
      synced++;
    } catch (err) {
      console.error(`[Sync] Failed to save trade ${t.orderId}:`, (err as Error).message);
    }
  }

  console.log(`[Sync] ${accountId}: synced=${synced}, skipped=${skipped}, unrealizedPnl=${unrealizedPnl.toFixed(2)}`);
  return { accountId, broker: "BYBIT", synced, skipped, unrealizedPnl };
}

// ─── DB-based limit check (не зависит от in-memory мониторинга) ───────────────

export async function checkLimitsFromDb(accountId: string, unrealizedPnl = 0): Promise<{ blocked: boolean; reason?: string }> {
  const account = await prisma.connectedAccount.findUnique({
    where:   { id: accountId },
    include: { user: { include: { limits: true } } },
  });
  if (!account || account.isBlocked || !account.isActive) return { blocked: false };

  const limits = account.user.limits;
  if (!limits) {
    console.log(`[CheckLimits] No limits configured for account ${accountId}`);
    return { blocked: false };
  }

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const weekStart = new Date();
  const dow = weekStart.getUTCDay();
  weekStart.setUTCDate(weekStart.getUTCDate() - (dow === 0 ? 6 : dow - 1));
  weekStart.setUTCHours(0, 0, 0, 0);

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const todayTrades = await prisma.trade.findMany({
    where:  { userId: account.userId, status: "CLOSED", closedAt: { gte: todayStart } },
    select: { realizedPnl: true },
  });

  const realizedDailyPnl = todayTrades.reduce((s, t) => s + (t.realizedPnl ?? 0), 0);
  // Include unrealized PnL from currently open positions
  const effectiveDailyPnl = realizedDailyPnl + unrealizedPnl;
  const dailyLoss   = Math.abs(Math.min(effectiveDailyPnl, 0));
  const tradesCount = todayTrades.length;

  console.log(`[CheckLimits] account=${accountId} realizedPnl=${realizedDailyPnl.toFixed(2)} unrealizedPnl=${unrealizedPnl.toFixed(2)} effectiveDailyPnl=${effectiveDailyPnl.toFixed(2)} dailyLoss=${dailyLoss.toFixed(2)} limit=${limits.dailyLossLimit} trades=${tradesCount}/${limits.maxDailyTrades ?? "∞"}`);

  // Check daily loss limit (realized + unrealized)
  if (limits.dailyLossLimit && dailyLoss >= limits.dailyLossLimit) {
    const reason = `Дневной убыток $${dailyLoss.toFixed(2)} превысил лимит $${limits.dailyLossLimit} (реализовано: $${realizedDailyPnl.toFixed(2)}, открыто: $${unrealizedPnl.toFixed(2)})`;
    console.warn(`[CheckLimits] BLOCKING ${accountId}: ${reason}`);
    await _dbBlock(accountId, account.userId, limits.blockDurationHours, "DAILY_LOSS_LIMIT", limits.dailyLossLimit, dailyLoss, reason);
    await _closePositions(account);
    return { blocked: true, reason };
  }

  // Check max daily trades
  if (limits.maxDailyTrades && tradesCount >= limits.maxDailyTrades) {
    const reason = `Сделок за день: ${tradesCount} (лимит: ${limits.maxDailyTrades})`;
    console.warn(`[CheckLimits] BLOCKING ${accountId}: ${reason}`);
    await _dbBlock(accountId, account.userId, limits.blockDurationHours, "DAILY_TRADE_COUNT", limits.maxDailyTrades, tradesCount, reason);
    await _closePositions(account);
    return { blocked: true, reason };
  }

  // Check weekly loss limit
  if (limits.weeklyLossLimit) {
    const weekTrades = await prisma.trade.findMany({
      where:  { userId: account.userId, status: "CLOSED", closedAt: { gte: weekStart } },
      select: { realizedPnl: true },
    });
    const weeklyPnl  = weekTrades.reduce((s, t) => s + (t.realizedPnl ?? 0), 0);
    const weeklyLoss = Math.abs(Math.min(weeklyPnl, 0));
    console.log(`[CheckLimits] account=${accountId} weeklyLoss=${weeklyLoss.toFixed(2)} limit=${limits.weeklyLossLimit}`);
    if (weeklyLoss >= limits.weeklyLossLimit) {
      const reason = `Недельный убыток $${weeklyLoss.toFixed(2)} превысил лимит $${limits.weeklyLossLimit}`;
      console.warn(`[CheckLimits] BLOCKING ${accountId}: ${reason}`);
      await _dbBlock(accountId, account.userId, limits.blockDurationHours, "WEEKLY_LOSS_LIMIT", limits.weeklyLossLimit, weeklyLoss, reason);
      await _closePositions(account);
      return { blocked: true, reason };
    }
  }

  // Check monthly loss limit
  if (limits.monthlyLossLimit) {
    const monthTrades = await prisma.trade.findMany({
      where:  { userId: account.userId, status: "CLOSED", closedAt: { gte: monthStart } },
      select: { realizedPnl: true },
    });
    const monthlyPnl  = monthTrades.reduce((s, t) => s + (t.realizedPnl ?? 0), 0);
    const monthlyLoss = Math.abs(Math.min(monthlyPnl, 0));
    console.log(`[CheckLimits] account=${accountId} monthlyLoss=${monthlyLoss.toFixed(2)} limit=${limits.monthlyLossLimit}`);
    if (monthlyLoss >= limits.monthlyLossLimit) {
      const reason = `Месячный убыток $${monthlyLoss.toFixed(2)} превысил лимит $${limits.monthlyLossLimit}`;
      console.warn(`[CheckLimits] BLOCKING ${accountId}: ${reason}`);
      await _dbBlock(accountId, account.userId, limits.blockDurationHours, "MONTHLY_LOSS_LIMIT", limits.monthlyLossLimit, monthlyLoss, reason);
      await _closePositions(account);
      return { blocked: true, reason };
    }
  }

  // Check consecutive losses
  if (limits.maxConsecutiveLosses) {
    const recent = await prisma.trade.findMany({
      where:   { userId: account.userId, status: "CLOSED" },
      orderBy: { closedAt: "desc" },
      take:    limits.maxConsecutiveLosses + 1,
      select:  { realizedPnl: true },
    });
    let streak = 0;
    for (const t of recent) {
      if ((t.realizedPnl ?? 0) < 0) streak++;
      else break;
    }
    if (streak >= limits.maxConsecutiveLosses) {
      const reason = `Серия убытков: ${streak} подряд (лимит: ${limits.maxConsecutiveLosses})`;
      console.warn(`[CheckLimits] BLOCKING ${accountId}: ${reason}`);
      await _dbBlock(accountId, account.userId, limits.blockDurationHours, "CONSECUTIVE_LOSSES", limits.maxConsecutiveLosses, streak, reason);
      await _closePositions(account);
      return { blocked: true, reason };
    }
  }

  console.log(`[CheckLimits] account=${accountId} — all limits OK`);
  return { blocked: false };
}

// ── Закрытие всех позиций и ордеров при блокировке ────────────────────────────

async function _closePositions(account: { id: string; broker: string; apiKey: string; apiSecret: string; isTestnet: boolean }): Promise<void> {
  if (account.broker !== "BYBIT") return;
  try {
    const client = new BybitClient(decrypt(account.apiKey), decrypt(account.apiSecret), account.isTestnet);
    await client.cancelAllOrders().catch((e: Error) =>
      console.error(`[CheckLimits] cancelOrders failed (${account.id}):`, e.message)
    );
    await client.closeAllPositions().catch((e: Error) =>
      console.error(`[CheckLimits] closePositions failed (${account.id}):`, e.message)
    );
    console.log(`[CheckLimits] Positions closed for blocked account ${account.id}`);
  } catch (err) {
    console.error(`[CheckLimits] _closePositions error (${account.id}):`, (err as Error).message);
  }
}

async function _dbBlock(
  accountId:   string,
  userId:      string,
  durationHrs: number,
  breachType:  BreachType,
  limitValue:  number,
  actualValue: number,
  description: string,
): Promise<void> {
  const blockedUntil = new Date(Date.now() + durationHrs * 3_600_000);

  await prisma.connectedAccount.update({
    where: { id: accountId },
    data:  { isBlocked: true, blockedAt: new Date(), blockedUntil, blockReason: description },
  });

  // Dedup: одно нарушение в день на тип
  const todayStart = new Date(); todayStart.setUTCHours(0, 0, 0, 0);
  const existing = await prisma.limitBreach.findFirst({
    where: { accountId, breachType, isWarning: false, createdAt: { gte: todayStart } },
  });
  if (!existing) {
    await prisma.limitBreach.create({
      data: {
        userId, accountId, breachType,
        severity:    "CRITICAL",
        isWarning:   false,
        limitValue,
        actualValue,
        excessAmount: Math.max(0, actualValue - limitValue),
        description,
      },
    });
  }

  console.log(`[CheckLimits] DB block applied for ${accountId} until ${blockedUntil.toISOString()}`);
}
