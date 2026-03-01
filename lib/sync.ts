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

export type SyncResult = {
  accountId: string;
  broker:    string;
  synced:    number;
  skipped:   number;
  error?:    string;
};

// ─── Синхронизировать один аккаунт ───────────────────────────────────────────

export async function syncAccount(accountId: string): Promise<SyncResult> {
  const account = await prisma.connectedAccount.findUnique({
    where: { id: accountId },
  });

  if (!account) {
    return { accountId, broker: "UNKNOWN", synced: 0, skipped: 0, error: "Account not found" };
  }

  if (!account.isActive || account.broker === "DEMO") {
    return { accountId, broker: account.broker, synced: 0, skipped: 0 };
  }

  if (account.broker === "BYBIT") {
    return syncBybitAccount(account.id, account.userId, account.apiKey, account.apiSecret, account.isTestnet);
  }

  // Binance и другие — пока не реализованы
  return { accountId, broker: account.broker, synced: 0, skipped: 0 };
}

// ─── Синхронизировать все активные Bybit-аккаунты ────────────────────────────

export async function syncAllAccounts(): Promise<SyncResult[]> {
  const accounts = await prisma.connectedAccount.findMany({
    where: { isActive: true, broker: { notIn: ["DEMO"] } },
  });

  const results: SyncResult[] = [];
  for (const acc of accounts) {
    const result = await syncAccount(acc.id);
    results.push(result);
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
  const client = new BybitClient(decrypt(apiKey), decrypt(apiSecret), isTestnet);

  let trades;
  try {
    trades = await client.getTodayTrades();
  } catch (err) {
    const msg = (err as Error).message;
    console.error(`[Sync] getTodayTrades failed for ${accountId}:`, msg);
    return { accountId, broker: "BYBIT", synced: 0, skipped: 0, error: msg };
  }

  console.log(`[Sync] ${accountId}: fetched ${trades.length} closed trade(s) from Bybit`);

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

  console.log(`[Sync] ${accountId}: synced=${synced}, skipped=${skipped}`);
  return { accountId, broker: "BYBIT", synced, skipped };
}
