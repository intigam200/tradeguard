/**
 * BinanceClient — подключение к Binance Futures через User Data Stream + REST API
 *
 * WebSocket: wss://fstream.binance.com/ws/<listenKey>
 * REST: https://fapi.binance.com/fapi/v1/
 *
 * Binance Futures использует ListenKey для персонального потока данных.
 * ListenKey нужно продлевать каждые 30 минут через PUT /fapi/v1/listenKey.
 */

import WebSocket from "ws";
import { createHmac } from "crypto";

// ─── Типы событий Binance ─────────────────────────────────────────────────────

export type BinancePosition = {
  s: string;    // symbol
  pa: string;   // positionAmt (отрицательное = SHORT)
  ep: string;   // entryPrice
  up: string;   // unrealizedProfit
  mt: string;   // marginType
  ps: string;   // positionSide: BOTH | LONG | SHORT
};

export type BinanceOrder = {
  s: string;   // symbol
  c: string;   // clientOrderId
  i: number;   // orderId
  S: string;   // side: BUY | SELL
  o: string;   // orderType
  X: string;   // orderStatus
  q: string;   // originalQty
  z: string;   // filledQty
  p: string;   // price
  ap: string;  // avgPrice
  rp: string;  // realizedProfit
};

type BinanceWsEvent = {
  e: string;    // event type
  E: number;    // event time
  T?: number;   // transaction time
  a?: {         // account update
    B: Array<{ a: string; wb: string; cw: string }>;   // balances
    P: BinancePosition[];                              // positions
  };
  o?: BinanceOrder; // order update
};

type BinanceRestResponse<T> = T;

// ─── Клиент ───────────────────────────────────────────────────────────────────

export class BinanceClient {
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly restBase = "https://fapi.binance.com";
  private readonly wsBase  = "wss://fstream.binance.com/ws";

  private ws: WebSocket | null = null;
  private listenKey: string | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private keepAliveTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isDestroyed = false;
  private reconnectDelay = 5_000;

  private positionCallbacks: Array<(data: BinancePosition[]) => void> = [];
  private orderFilledCallbacks: Array<(data: BinanceOrder) => void> = [];

  constructor(apiKey: string, apiSecret: string) {
    this.apiKey    = apiKey;
    this.apiSecret = apiSecret;
  }

  // ── Подключение ─────────────────────────────────────────────────────────────

  async connectWebSocket(): Promise<void> {
    // 1. Получить listenKey
    this.listenKey = await this.createListenKey();
    console.log("[BinanceClient] Got listenKey:", this.listenKey.slice(0, 12) + "...");

    // 2. Открыть WebSocket на user data stream
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(`${this.wsBase}/${this.listenKey}`);

        this.ws.once("open", () => {
          console.log("[BinanceClient] WebSocket connected");
          this.startPing();
          this.startKeepAlive();
          resolve();
        });

        this.ws.on("message", (raw: Buffer | string) => {
          this.handleMessage(raw.toString());
        });

        this.ws.on("error", (err: Error) => {
          console.error("[BinanceClient] WS error:", err.message);
          reject(err);
        });

        this.ws.on("close", (code: number) => {
          console.warn(`[BinanceClient] WS closed (${code}), reconnecting in ${this.reconnectDelay / 1000}s...`);
          this.clearTimers();
          this.scheduleReconnect();
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  // ── Обработка входящих сообщений ────────────────────────────────────────────

  private handleMessage(raw: string): void {
    let event: BinanceWsEvent;
    try {
      event = JSON.parse(raw) as BinanceWsEvent;
    } catch {
      return;
    }

    // ACCOUNT_UPDATE — изменение позиций / баланса
    if (event.e === "ACCOUNT_UPDATE" && event.a?.P) {
      const positions = event.a.P.filter(
        (p) => parseFloat(p.pa) !== 0 // только активные позиции
      );
      if (positions.length > 0) {
        for (const cb of this.positionCallbacks) {
          try { cb(positions); } catch (e) { console.error("[BinanceClient] positionCallback error:", e); }
        }
      }
      return;
    }

    // ORDER_TRADE_UPDATE — исполнение ордера
    if (event.e === "ORDER_TRADE_UPDATE" && event.o) {
      const order = event.o;
      if (order.X === "FILLED" || order.X === "PARTIALLY_FILLED") {
        for (const cb of this.orderFilledCallbacks) {
          try { cb(order); } catch (e) { console.error("[BinanceClient] orderFilledCallback error:", e); }
        }
      }
    }
  }

  // ── Колбэки ─────────────────────────────────────────────────────────────────

  onPositionUpdate(callback: (data: BinancePosition[]) => void): void {
    this.positionCallbacks.push(callback);
  }

  onOrderFilled(callback: (data: BinanceOrder) => void): void {
    this.orderFilledCallbacks.push(callback);
  }

  // ── REST: Отмена всех открытых ордеров ─────────────────────────────────────

  async cancelAllOrders(): Promise<void> {
    console.log("[BinanceClient] Cancelling all orders...");
    // Получить список торгуемых символов с открытыми ордерами
    const openOrders = await this.restGet<Array<{ symbol: string }>>(
      "/fapi/v1/openOrders", {}
    );

    // Binance требует отмену по символу
    const symbols = Array.from(new Set(openOrders.map((o) => o.symbol)));
    await Promise.allSettled(
      symbols.map((sym) =>
        this.restDelete(`/fapi/v1/allOpenOrders`, { symbol: sym }).catch((err: Error) => {
          console.error(`[BinanceClient] cancelOrders(${sym}) error:`, err.message);
        })
      )
    );
    console.log(`[BinanceClient] Cancelled orders for ${symbols.length} symbols`);
  }

  // ── REST: Закрытие всех открытых позиций ───────────────────────────────────

  async closeAllPositions(): Promise<void> {
    console.log("[BinanceClient] Closing all positions...");
    const positions = await this.getOpenPositions();

    await Promise.allSettled(
      positions.map((pos) => {
        const qty  = Math.abs(parseFloat(pos.pa)).toString();
        const side = parseFloat(pos.pa) > 0 ? "SELL" : "BUY"; // закрывающая сторона
        return this.placeMarketClose(pos.s, side, qty).catch((err: Error) => {
          console.error(`[BinanceClient] closePosition(${pos.s}) error:`, err.message);
        });
      })
    );
    console.log(`[BinanceClient] Closed ${positions.length} positions`);
  }

  private async getOpenPositions(): Promise<BinancePosition[]> {
    const all = await this.restGet<BinancePosition[]>("/fapi/v2/positionRisk", {});
    return all.filter((p) => parseFloat(p.pa) !== 0);
  }

  private async placeMarketClose(symbol: string, side: string, quantity: string): Promise<void> {
    const params: Record<string, string> = {
      symbol,
      side,
      type:         "MARKET",
      quantity,
      reduceOnly:   "true",
      timestamp:    Date.now().toString(),
    };
    params.signature = this.sign(new URLSearchParams(params).toString());
    await this.restPost("/fapi/v1/order", params);
  }

  // ── REST: Проверка подключения (валидация API-ключей) ──────────────────────

  async testConnection(): Promise<{ balance: number }> {
    type BalanceEntry = { asset: string; balance: string; availableBalance: string };
    const balances = await this.restGet<BalanceEntry[]>("/fapi/v2/balance", {});
    const usdt = balances.find((b) => b.asset === "USDT");
    const balance = usdt ? parseFloat(usdt.balance) : 0;
    return { balance };
  }

  // ── REST: P&L за сегодня ────────────────────────────────────────────────────

  async getDailyPnl(): Promise<number> {
    const startTime = this.startOfTodayMs();
    const trades = await this.restGet<Array<{ realizedPnl: string }>>(
      "/fapi/v1/userTrades",
      { startTime: startTime.toString() }
    );
    return trades.reduce((sum, t) => sum + parseFloat(t.realizedPnl), 0);
  }

  async getUnrealizedPnl(): Promise<number> {
    const positions = await this.restGet<Array<{ positionAmt: string; unrealizedProfit: string }>>(
      "/fapi/v2/positionRisk", {}
    );
    return positions
      .filter(p => parseFloat(p.positionAmt) !== 0)
      .reduce((sum, p) => sum + parseFloat(p.unrealizedProfit), 0);
  }

  // ── REST: Количество сделок за дату ────────────────────────────────────────

  async getTradesCount(date: Date): Promise<number> {
    const startTime = this.startOfDayMs(date);
    const endTime   = startTime + 86_400_000;
    const trades = await this.restGet<unknown[]>(
      "/fapi/v1/userTrades",
      { startTime: startTime.toString(), endTime: endTime.toString() }
    );
    return trades.length;
  }

  // ── REST: P&L за произвольный период ───────────────────────────────────────

  async getPnlForPeriod(startMs: number): Promise<number> {
    const trades = await this.restGet<Array<{ realizedPnl: string }>>(
      "/fapi/v1/userTrades",
      { startTime: startMs.toString() }
    );
    return trades.reduce((sum, t) => sum + parseFloat(t.realizedPnl), 0);
  }

  // ── ListenKey ────────────────────────────────────────────────────────────────

  private async createListenKey(): Promise<string> {
    const res = await fetch(`${this.restBase}/fapi/v1/listenKey`, {
      method: "POST",
      headers: { "X-MBX-APIKEY": this.apiKey },
    });
    const json = await res.json() as { listenKey?: string; code?: number; msg?: string };
    if (!json.listenKey) {
      throw new Error(`[BinanceClient] Failed to get listenKey: ${json.msg ?? "unknown error"}`);
    }
    return json.listenKey;
  }

  private async keepAliveListenKey(): Promise<void> {
    if (!this.listenKey) return;
    try {
      await fetch(`${this.restBase}/fapi/v1/listenKey`, {
        method: "PUT",
        headers: { "X-MBX-APIKEY": this.apiKey },
      });
    } catch (err) {
      console.error("[BinanceClient] keepAlive listenKey failed:", err);
    }
  }

  // ── Вспомогательные REST методы ─────────────────────────────────────────────

  private async restGet<T>(path: string, params: Record<string, string>): Promise<T> {
    const signed: Record<string, string> = {
      ...params,
      timestamp: Date.now().toString(),
    };
    const query   = new URLSearchParams(signed).toString();
    const sig     = this.sign(query);
    const fullUrl = `${this.restBase}${path}?${query}&signature=${sig}`;

    const res = await fetch(fullUrl, {
      headers: { "X-MBX-APIKEY": this.apiKey },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`[BinanceClient] GET ${path} HTTP ${res.status}: ${text}`);
    }
    return res.json() as Promise<BinanceRestResponse<T>>;
  }

  private async restPost(path: string, params: Record<string, string>): Promise<void> {
    const body = new URLSearchParams(params).toString();
    const res  = await fetch(`${this.restBase}${path}`, {
      method: "POST",
      headers: {
        "X-MBX-APIKEY": this.apiKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`[BinanceClient] POST ${path} HTTP ${res.status}: ${text}`);
    }
  }

  private async restDelete(path: string, params: Record<string, string>): Promise<void> {
    const signed: Record<string, string> = {
      ...params,
      timestamp: Date.now().toString(),
    };
    const query = new URLSearchParams(signed).toString();
    const sig   = this.sign(query);

    const res = await fetch(`${this.restBase}${path}?${query}&signature=${sig}`, {
      method: "DELETE",
      headers: { "X-MBX-APIKEY": this.apiKey },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`[BinanceClient] DELETE ${path} HTTP ${res.status}: ${text}`);
    }
  }

  private sign(queryString: string): string {
    return createHmac("sha256", this.apiSecret)
      .update(queryString)
      .digest("hex");
  }

  // ── Утилиты ─────────────────────────────────────────────────────────────────

  private startOfTodayMs(): number {
    return this.startOfDayMs(new Date());
  }

  private startOfDayMs(date: Date): number {
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  }

  private startPing(): void {
    // Binance WS требует pong на ping — ws пакет делает это автоматически.
    // Доп. ping для keepalive соединения
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, 30_000);
  }

  private startKeepAlive(): void {
    // Продлеваем listenKey каждые 29 минут (Binance инвалидирует через 60 мин)
    this.keepAliveTimer = setInterval(() => {
      this.keepAliveListenKey().catch(console.error);
    }, 29 * 60 * 1000);
  }

  private clearTimers(): void {
    if (this.pingTimer)     { clearInterval(this.pingTimer);      this.pingTimer = null; }
    if (this.keepAliveTimer){ clearInterval(this.keepAliveTimer); this.keepAliveTimer = null; }
    if (this.reconnectTimer){ clearTimeout(this.reconnectTimer);  this.reconnectTimer = null; }
  }

  private scheduleReconnect(): void {
    if (this.isDestroyed) return;
    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connectWebSocket();
        this.reconnectDelay = 5_000;
      } catch (err) {
        console.error("[BinanceClient] Reconnect failed:", err);
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, 60_000);
        this.scheduleReconnect();
      }
    }, this.reconnectDelay);
  }

  // ── Уничтожение ─────────────────────────────────────────────────────────────

  destroy(): void {
    this.isDestroyed = true;
    this.clearTimers();
    this.ws?.close();
    this.ws = null;
    this.positionCallbacks = [];
    this.orderFilledCallbacks = [];
  }
}
