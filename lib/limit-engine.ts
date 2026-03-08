/**
 * LimitEngine — главный движок мониторинга и блокировки.
 *
 *  1. startMonitoring(account) — подключает клиент биржи
 *  2. checkLimits() — сравнивает реальные значения с лимитами
 *     – При 80% → sendWarning() (1 раз в день на тип нарушения)
 *     – При 100% → blockAccount()
 *  3. blockAccount() — отменяет ордера, закрывает позиции, обновляет БД, уведомляет
 *  4. positionGuardian() — каждые 10с закрывает позиции при блокировке
 */

import { prisma }   from "./prisma";
import { decrypt }   from "./crypto";
import { notifyBlocked, notifyWarning } from "./notifications";
import { BybitClient }   from "./exchanges/bybit-client";
import { BinanceClient } from "./exchanges/binance-client";
import { DemoClient }    from "./exchanges/demo-client";
import type { ConnectedAccount, UserLimits } from "@/app/generated/prisma/client";
import type { BreachType } from "@/app/generated/prisma/enums";

type ExchangeClient = BybitClient | BinanceClient | DemoClient;

type MonitorState = {
  account:       ConnectedAccount;
  client:        ExchangeClient;
  guardianTimer: ReturnType<typeof setInterval> | null;
  lastCheckAt:   Date;
};

type BlockReason = {
  breachType:  BreachType;
  limitValue:  number;
  actualValue: number;
  description: string;
};

export class LimitEngine {
  private readonly states = new Map<string, MonitorState>();

  // ── Запуск мониторинга ────────────────────────────────────────────────────

  async startMonitoring(account: ConnectedAccount): Promise<void> {
    if (this.states.has(account.id)) return;

    const client = this.createClient(account);
    const state: MonitorState = { account, client, guardianTimer: null, lastCheckAt: new Date() };
    this.states.set(account.id, state);

    client.onPositionUpdate(async () => {
      await this.checkLimits(account.id).catch((e: Error) =>
        console.error(`[LimitEngine] checkLimits error (${account.id}):`, e.message)
      );
    });
    client.onOrderFilled(async () => {
      await this.checkLimits(account.id).catch((e: Error) =>
        console.error(`[LimitEngine] checkLimits(order) error (${account.id}):`, e.message)
      );
    });

    try {
      await client.connectWebSocket();
      console.log(`[LimitEngine] Monitoring started for account ${account.id} (${account.broker})`);
    } catch (err) {
      this.states.delete(account.id);
      throw new Error(`[LimitEngine] Failed to connect for ${account.id}: ${(err as Error).message}`);
    }

    if (account.isBlocked) this.startPositionGuardian(account.id);
  }

  // ── Остановка мониторинга ─────────────────────────────────────────────────

  stopMonitoring(accountId: string): void {
    const state = this.states.get(accountId);
    if (!state) return;
    if (state.guardianTimer) clearInterval(state.guardianTimer);
    state.client.destroy();
    this.states.delete(accountId);
    console.log(`[LimitEngine] Monitoring stopped for account ${accountId}`);
  }

  // ── Проверка лимитов ──────────────────────────────────────────────────────

  async checkLimits(accountId: string): Promise<void> {
    const state = this.states.get(accountId);
    if (!state) return;

    const fresh = await prisma.connectedAccount.findUnique({ where: { id: accountId } });
    if (!fresh || !fresh.isActive || fresh.isBlocked) return;

    const limits = await prisma.userLimits.findUnique({ where: { userId: fresh.userId } });
    if (!limits) return;

    const client = state.client;
    let dailyPnl = 0, unrealizedPnl = 0, tradesCount = 0, weeklyPnl = 0, monthlyPnl = 0;

    try {
      [dailyPnl, unrealizedPnl, tradesCount] = await Promise.all([
        client.getDailyPnl(),
        client.getUnrealizedPnl().catch(() => 0),
        client.getTradesCount(new Date()),
      ]);
      if (limits.weeklyLossLimit)  weeklyPnl  = await client.getPnlForPeriod(this.startOfWeekMs());
      if (limits.monthlyLossLimit) monthlyPnl = await client.getPnlForPeriod(this.startOfMonthMs());
    } catch (err) {
      console.error(`[LimitEngine] Fetch failed for ${accountId}:`, (err as Error).message);
      return;
    }

    state.lastCheckAt = new Date();

    // Effective daily PnL = realized (closed trades) + unrealized (open positions)
    const effectiveDailyPnl = dailyPnl + unrealizedPnl;

    const checks: Array<() => BlockReason | null> = [
      () => {
        if (effectiveDailyPnl >= 0 || !limits.dailyLossLimit) return null;
        const loss = Math.abs(effectiveDailyPnl), pct = loss / limits.dailyLossLimit;
        if (pct >= 1) return { breachType: "DAILY_LOSS_LIMIT", limitValue: limits.dailyLossLimit, actualValue: loss, description: `Дневной убыток $${loss.toFixed(2)} превысил лимит $${limits.dailyLossLimit}` };
        if (pct >= limits.warningThresholdPct / 100) this.sendWarning(fresh, limits, "DAILY_LOSS_LIMIT", loss, limits.dailyLossLimit, pct).catch(console.error);
        return null;
      },
      () => {
        if (!limits.maxDailyTrades) return null;
        const pct = tradesCount / limits.maxDailyTrades;
        if (pct >= 1) return { breachType: "DAILY_TRADE_COUNT", limitValue: limits.maxDailyTrades, actualValue: tradesCount, description: `Сделок за день: ${tradesCount} (лимит: ${limits.maxDailyTrades})` };
        if (pct >= limits.warningThresholdPct / 100) this.sendWarning(fresh, limits, "DAILY_TRADE_COUNT", tradesCount, limits.maxDailyTrades, pct).catch(console.error);
        return null;
      },
      () => {
        if (weeklyPnl >= 0 || !limits.weeklyLossLimit) return null;
        const loss = Math.abs(weeklyPnl), pct = loss / limits.weeklyLossLimit;
        if (pct >= 1) return { breachType: "WEEKLY_LOSS_LIMIT", limitValue: limits.weeklyLossLimit, actualValue: loss, description: `Недельный убыток $${loss.toFixed(2)} превысил лимит $${limits.weeklyLossLimit}` };
        if (pct >= limits.warningThresholdPct / 100) this.sendWarning(fresh, limits, "WEEKLY_LOSS_LIMIT", loss, limits.weeklyLossLimit, pct).catch(console.error);
        return null;
      },
      () => {
        if (monthlyPnl >= 0 || !limits.monthlyLossLimit) return null;
        const loss = Math.abs(monthlyPnl), pct = loss / limits.monthlyLossLimit;
        if (pct >= 1) return { breachType: "MONTHLY_LOSS_LIMIT", limitValue: limits.monthlyLossLimit, actualValue: loss, description: `Месячный убыток $${loss.toFixed(2)} превысил лимит $${limits.monthlyLossLimit}` };
        if (pct >= limits.warningThresholdPct / 100) this.sendWarning(fresh, limits, "MONTHLY_LOSS_LIMIT", loss, limits.monthlyLossLimit, pct).catch(console.error);
        return null;
      },
      () => {
        if (!limits.tradingStartTime || !limits.tradingEndTime) return null;
        const hhmm = new Date().toISOString().slice(11, 16);
        if (hhmm < limits.tradingStartTime || hhmm > limits.tradingEndTime)
          return { breachType: "TRADING_HOURS", limitValue: 0, actualValue: 0, description: `Торговля вне разрешённого времени (${limits.tradingStartTime}–${limits.tradingEndTime} UTC). Текущее: ${hhmm}` };
        return null;
      },
    ];

    for (const check of checks) {
      const reason = check();
      if (reason) {
        console.warn(`[LimitEngine] BREACH detected for ${accountId}: ${reason.breachType}`);
        await this.blockAccount(accountId, reason).catch((e: Error) =>
          console.error(`[LimitEngine] blockAccount error:`, e.message)
        );
        return;
      }
    }
  }

  // ── Блокировка аккаунта ───────────────────────────────────────────────────

  async blockAccount(accountId: string, reason: BlockReason): Promise<void> {
    const state = this.states.get(accountId);
    if (!state) return;

    const account = await prisma.connectedAccount.findUnique({
      where: { id: accountId },
      include: { user: { include: { limits: true } } },
    });
    if (!account) return;

    const blockDurationHours = account.user.limits?.blockDurationHours ?? 24;
    let blockedUntil: Date;
    if (blockDurationHours <= 0) {
      const now = new Date();
      blockedUntil = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
    } else {
      blockedUntil = new Date(Date.now() + blockDurationHours * 3_600_000);
    }

    console.log(`[LimitEngine] Blocking account ${accountId} until ${blockedUntil.toISOString()}`);

    try { await state.client.cancelAllOrders(); console.log(`[LimitEngine] [1/5] Orders cancelled`); }
    catch (err) { console.error(`[LimitEngine] cancelAllOrders failed:`, (err as Error).message); }

    try { await state.client.closeAllPositions(); console.log(`[LimitEngine] [2/5] Positions closed`); }
    catch (err) { console.error(`[LimitEngine] closeAllPositions failed:`, (err as Error).message); }

    await prisma.connectedAccount.update({
      where: { id: accountId },
      data:  { isBlocked: true, blockedAt: new Date(), blockedUntil, blockReason: reason.description },
    });
    console.log(`[LimitEngine] [3/5] DB updated`);

    // Dedup: одно CRITICAL-нарушение в день на тип/аккаунт
    const _blockToday = new Date();
    _blockToday.setUTCHours(0, 0, 0, 0);
    const _dupBlockBreach = await prisma.limitBreach.findFirst({
      where: { accountId, breachType: reason.breachType, isWarning: false, createdAt: { gte: _blockToday } },
    });
    if (!_dupBlockBreach) {
      await prisma.limitBreach.create({
        data: {
          userId:      account.userId,
          accountId:   accountId,
          breachType:  reason.breachType,
          severity:    reason.breachType === "TRADING_HOURS" ? "VIOLATION" : "CRITICAL",
          isWarning:   false,
          limitValue:  reason.limitValue,
          actualValue: reason.actualValue,
          excessAmount: Math.max(0, reason.actualValue - reason.limitValue),
          description: reason.description,
        },
      });
      console.log(`[LimitEngine] [4/5] LimitBreach created`);
    } else {
      console.log(`[LimitEngine] [4/5] LimitBreach skipped (duplicate today for ${reason.breachType})`);
    }

    await notifyBlocked(accountId, reason.description, blockedUntil.toLocaleString("ru")).catch(console.error);
    console.log(`[LimitEngine] [5/5] Notifications sent`);

    this.startPositionGuardian(accountId);
  }

  // ── Ручная разблокировка ──────────────────────────────────────────────────

  async unblockAccount(accountId: string): Promise<void> {
    const state = this.states.get(accountId);
    await prisma.connectedAccount.update({
      where: { id: accountId },
      data:  { isBlocked: false, blockedAt: null, blockedUntil: null, blockReason: null },
    });
    if (state?.guardianTimer) { clearInterval(state.guardianTimer); state.guardianTimer = null; }
    console.log(`[LimitEngine] Account ${accountId} manually unblocked`);
  }

  // ── Position Guardian ─────────────────────────────────────────────────────

  private startPositionGuardian(accountId: string): void {
    const state = this.states.get(accountId);
    if (!state || state.guardianTimer) return;

    console.log(`[LimitEngine] Guardian started for account ${accountId}`);

    state.guardianTimer = setInterval(async () => {
      try {
        const acc = await prisma.connectedAccount.findUnique({ where: { id: accountId } });
        if (!acc) { this.stopMonitoring(accountId); return; }

        if (acc.isBlocked && acc.blockedUntil && acc.blockedUntil <= new Date()) {
          const limits = await prisma.userLimits.findUnique({ where: { userId: acc.userId } });
          if (limits?.autoUnblock) {
            await this.unblockAccount(accountId);
            console.log(`[LimitEngine] Account ${accountId} auto-unblocked`);
            return;
          }
        }

        if (!acc.isBlocked) {
          if (state.guardianTimer) { clearInterval(state.guardianTimer); state.guardianTimer = null; }
          return;
        }

        await state.client.cancelAllOrders();
        await state.client.closeAllPositions();

        // Cooldown: не спамить guardian-нарушениями — 1 запись в час
        const _gcCooldown = new Date(Date.now() - 3_600_000);
        const _gcDup = await prisma.limitBreach.findFirst({
          where: { accountId, description: { contains: "Попытка открыть позицию" }, createdAt: { gte: _gcCooldown } },
        });
        if (!_gcDup) {
          await prisma.limitBreach.create({
            data: {
              userId: acc.userId, accountId, breachType: "DAILY_LOSS_LIMIT",
              severity: "CRITICAL", isWarning: false,
              limitValue: 0, actualValue: 0, excessAmount: 0,
              description: "⚠️ Попытка открыть позицию во время блокировки — закрыто автоматически",
            },
          });
        }

        if (acc.telegramChatId) {
          await this.sendTelegramRaw(acc.telegramChatId,
            `⚠️ TradeGuard: Попытка обхода блокировки!\nПозиция принудительно закрыта.`
          );
        }
      } catch (err) {
        console.error(`[LimitEngine] Guardian error (${accountId}):`, (err as Error).message);
      }
    }, 10_000);
  }

  // ── Предупреждения с cooldown (1 раз в день на тип) ───────────────────────

  private async sendWarning(
    account: ConnectedAccount,
    limits:  UserLimits,
    breachType: BreachType,
    actual:  number,
    limit:   number,
    pct:     number,
  ): Promise<void> {
    // Cooldown: проверяем, не было ли уже предупреждения сегодня по этому типу
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const alreadyWarned = await prisma.limitBreach.findFirst({
      where: {
        userId:    account.userId,
        accountId: account.id,
        breachType,
        isWarning: true,
        createdAt: { gte: startOfDay },
      },
    });

    if (alreadyWarned) {
      console.log(`[LimitEngine] WARNING suppressed (already sent today): ${account.id} ${breachType}`);
      return;
    }

    const pctStr = (pct * 100).toFixed(0);
    const msg    = `⚠️ TradeGuard: ${pctStr}% лимита ${breachType} (${actual.toFixed(2)} / ${limit})`;
    console.warn(`[LimitEngine] WARNING (${account.id}): ${msg}`);

    // Записать в БД (isWarning: true)
    await prisma.limitBreach.create({
      data: {
        userId:    account.userId,
        accountId: account.id,
        breachType,
        severity:  "WARNING",
        isWarning: true,
        limitValue:   limit,
        actualValue:  actual,
        excessAmount: 0,
        description:  msg,
      },
    });

    // Уведомление (Telegram + Email)
    await notifyWarning(account.id, breachType, actual.toFixed(2), String(limit)).catch(console.error);

    void limits; // suppress unused warning
  }

  // ── Прямая Telegram-отправка для guardian ────────────────────────────────

  private async sendTelegramRaw(chatId: string, text: string): Promise<void> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return;
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text }),
      });
      if (!res.ok) console.error("[LimitEngine] Telegram raw error:", await res.text());
    } catch (err) {
      console.error("[LimitEngine] sendTelegramRaw failed:", (err as Error).message);
    }
  }

  // ── Создание клиента биржи ────────────────────────────────────────────────

  private createClient(account: ConnectedAccount): ExchangeClient {
    switch (account.broker) {
      case "BYBIT":   return new BybitClient(decrypt(account.apiKey), decrypt(account.apiSecret), account.isTestnet);
      case "BINANCE": return new BinanceClient(decrypt(account.apiKey), decrypt(account.apiSecret));
      case "DEMO":    return new DemoClient();
      default:        throw new Error(`[LimitEngine] Unsupported broker: ${account.broker}`);
    }
  }

  // ── Утилиты дат ───────────────────────────────────────────────────────────

  private startOfWeekMs(): number {
    const now = new Date();
    const diff = (now.getUTCDay() === 0 ? -6 : 1 - now.getUTCDay());
    return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + diff);
  }

  private startOfMonthMs(): number {
    const now = new Date();
    return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  }

  // ── Статус ────────────────────────────────────────────────────────────────

  getStatus() {
    return Array.from(this.states.values()).map(s => ({
      accountId: s.account.id, broker: s.account.broker,
      isBlocked: s.account.isBlocked, lastCheckAt: s.lastCheckAt,
    }));
  }

  get size() { return this.states.size; }
}
