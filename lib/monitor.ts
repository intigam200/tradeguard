/**
 * MonitorManager — Singleton-менеджер мониторинга всех активных аккаунтов.
 *
 * При старте сервера:
 *   1. Загружает все активные ConnectedAccount из БД
 *   2. Запускает LimitEngine.startMonitoring() для каждого
 *
 * Использует globalThis для сохранения экземпляра между hot-reload в dev-режиме.
 *
 * Использование:
 *   import { monitor } from "@/lib/monitor";
 *   await monitor.addAccount(accountId);
 *   await monitor.removeAccount(accountId);
 *   monitor.status(); // список всех активных мониторингов
 */

import { prisma }      from "./prisma";
import { LimitEngine } from "./limit-engine";
import type { ConnectedAccount } from "@/app/generated/prisma/client";

// ─── Singleton ────────────────────────────────────────────────────────────────

const globalForMonitor = globalThis as unknown as {
  __tradeGuardMonitor: MonitorManager | undefined;
};

class MonitorManager {
  private readonly engine = new LimitEngine();
  private initialized = false;

  // ── Инициализация при старте сервера ────────────────────────────────────────

  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    console.log("[Monitor] Initializing TradeGuard monitor...");

    let accounts: ConnectedAccount[] = [];
    try {
      accounts = await prisma.connectedAccount.findMany({
        where: { isActive: true },
      });
    } catch (err) {
      // Если БД недоступна (например, нет миграций) — логируем и продолжаем
      console.warn("[Monitor] Failed to load accounts from DB:", (err as Error).message);
      return;
    }

    console.log(`[Monitor] Found ${accounts.length} active account(s)`);

    const results = await Promise.allSettled(
      accounts.map((acc) =>
        this.engine.startMonitoring(acc).then(() => {
          console.log(`[Monitor] Started monitoring: ${acc.id} (${acc.broker})`);
        })
      )
    );

    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length > 0) {
      console.warn(`[Monitor] ${failed.length} account(s) failed to start monitoring`);
    }

    console.log(`[Monitor] Initialized — monitoring ${this.engine.size} account(s)`);
  }

  // ── Добавить аккаунт в мониторинг (после подключения нового брокера) ────────

  async addAccount(accountId: string): Promise<void> {
    let account: ConnectedAccount | null = null;
    try {
      account = await prisma.connectedAccount.findUnique({
        where: { id: accountId },
      });
    } catch (err) {
      throw new Error(`[Monitor] DB error while fetching account ${accountId}: ${(err as Error).message}`);
    }

    if (!account) {
      throw new Error(`[Monitor] Account not found: ${accountId}`);
    }
    if (!account.isActive) {
      throw new Error(`[Monitor] Account ${accountId} is not active`);
    }

    await this.engine.startMonitoring(account);
    console.log(`[Monitor] Added account ${accountId} to monitoring`);
  }

  // ── Удалить аккаунт из мониторинга (после отключения брокера) ───────────────

  removeAccount(accountId: string): void {
    this.engine.stopMonitoring(accountId);
    console.log(`[Monitor] Removed account ${accountId} from monitoring`);
  }

  // ── Разблокировать аккаунт вручную (только для admins) ──────────────────────

  async unblockAccount(accountId: string): Promise<void> {
    await this.engine.unblockAccount(accountId);
  }

  // ── Форсировать проверку лимитов вручную ────────────────────────────────────

  async forceCheck(accountId: string): Promise<void> {
    await this.engine.checkLimits(accountId);
  }

  // ── Статус всех мониторингов ─────────────────────────────────────────────────

  status(): Array<{
    accountId:   string;
    broker:      string;
    isBlocked:   boolean;
    lastCheckAt: Date;
  }> {
    return this.engine.getStatus();
  }
}

// ─── Экспорт глобального singleton ────────────────────────────────────────────

function getMonitor(): MonitorManager {
  if (!globalForMonitor.__tradeGuardMonitor) {
    globalForMonitor.__tradeGuardMonitor = new MonitorManager();
  }
  return globalForMonitor.__tradeGuardMonitor;
}

export const monitor = getMonitor();
