/**
 * MonitorManager — DB-based stub (WebSocket disabled on Vercel serverless)
 *
 * Vercel kills long-running connections after ~10s, so WebSocket monitoring
 * via LimitEngine does NOT work. Instead, limit checks run after every sync:
 *   client sync → /api/trades/import → checkLimitsFromDb()
 *
 * This stub keeps the same interface so all API routes continue to compile.
 */

import { checkLimitsFromDb } from "./sync";
import { prisma }            from "./prisma";

const globalForMonitor = globalThis as unknown as {
  __tradeGuardMonitor: MonitorManager | undefined;
};

class MonitorManager {
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    console.log("[Monitor] DB-based monitoring active (WebSocket disabled on Vercel)");
  }

  async addAccount(accountId: string): Promise<void> {
    console.log(`[Monitor] Account registered for DB monitoring: ${accountId}`);
  }

  removeAccount(accountId: string): void {
    console.log(`[Monitor] Account removed: ${accountId}`);
  }

  async unblockAccount(accountId: string): Promise<void> {
    await prisma.connectedAccount.update({
      where: { id: accountId },
      data:  { isBlocked: false, blockedUntil: null, blockReason: null },
    });
    console.log(`[Monitor] Unblocked account ${accountId}`);
  }

  // Run a DB-based limit check (no Bybit API call — reads from trades table)
  async forceCheck(accountId: string): Promise<void> {
    await checkLimitsFromDb(accountId, 0);
  }

  status(): Array<{ accountId: string; broker: string; isBlocked: boolean; lastCheckAt: Date }> {
    return [];
  }

  get size(): number { return 0; }
}

function getMonitor(): MonitorManager {
  if (!globalForMonitor.__tradeGuardMonitor) {
    globalForMonitor.__tradeGuardMonitor = new MonitorManager();
  }
  return globalForMonitor.__tradeGuardMonitor;
}

export const monitor = getMonitor();
