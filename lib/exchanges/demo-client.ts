/**
 * DemoClient — виртуальный клиент биржи для демо-режима.
 *
 * Реализует тот же интерфейс что BybitClient и BinanceClient,
 * но не делает реальных запросов к бирже.
 * Используется для тестирования TradeGuard без реальных API-ключей.
 */

type PositionCallback = (positions: unknown[]) => void;
type OrderFilledCallback = (order: unknown) => void;

export class DemoClient {
  private positionCallbacks: PositionCallback[] = [];
  private orderFilledCallbacks: OrderFilledCallback[] = [];

  // ── WebSocket ─────────────────────────────────────────────────────────────

  async connectWebSocket(): Promise<void> {
    console.log("[DemoClient] Virtual connection established (no real WS)");
  }

  onPositionUpdate(callback: PositionCallback): void {
    this.positionCallbacks.push(callback);
  }

  onOrderFilled(callback: OrderFilledCallback): void {
    this.orderFilledCallbacks.push(callback);
  }

  // ── REST: тест подключения ────────────────────────────────────────────────

  async testConnection(): Promise<{ uid: string; balance: number }> {
    return { uid: "DEMO0000", balance: 10000 };
  }

  // ── REST: P&L и статистика ────────────────────────────────────────────────

  async getDailyPnl(): Promise<number> {
    // Фиксированное значение — удобно для тестирования лимитов
    return -150;
  }

  async getUnrealizedPnl(): Promise<number> {
    return 0;
  }

  async getTradesCount(_date: Date): Promise<number> {
    return 3;
  }

  async getPnlForPeriod(_startMs: number): Promise<number> {
    return 0;
  }

  // ── REST: торговые операции ───────────────────────────────────────────────

  async cancelAllOrders(): Promise<void> {
    console.log("[DemoClient] Demo: cancelAllOrders (no-op)");
  }

  async closeAllPositions(): Promise<void> {
    console.log("[DemoClient] Demo: closeAllPositions (no-op)");
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  destroy(): void {
    this.positionCallbacks = [];
    this.orderFilledCallbacks = [];
    console.log("[DemoClient] Destroyed");
  }
}
