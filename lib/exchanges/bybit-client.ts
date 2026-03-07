/**
 * BybitClient — подключение к Bybit через WebSocket + REST API
 *
 * WebSocket: wss://stream.bybit.com/v5/private
 * REST: https://api.bybit.com/v5/
 *
 * Используется для мониторинга позиций и исполненных ордеров в реальном времени,
 * а также для принудительного закрытия всех позиций при нарушении лимитов.
 */

import WebSocket from "ws";
import { createHmac } from "crypto";

// ─── Типы ответов Bybit ───────────────────────────────────────────────────────

/** Одна закрытая позиция из /v5/position/closed-pnl */
export type BybitClosedPnlRecord = {
  symbol:        string;
  orderId:       string;
  /** Сторона ЗАКРЫТИЯ: Sell = позиция была LONG, Buy = позиция была SHORT */
  side:          "Buy" | "Sell";
  qty:           string;
  orderType:     string;
  avgEntryPrice: string;
  avgExitPrice:  string;
  closedPnl:     string;
  fillCount:     string;
  createdTime:   string; // unix ms, строка
  updatedTime:   string;
};

export type BybitPosition = {
  symbol: string;
  side: "Buy" | "Sell" | "None";
  size: string;           // строка, конвертировать в float
  avgPrice: string;
  unrealisedPnl: string;
  cumRealisedPnl: string;
};

export type BybitOrder = {
  orderId: string;
  symbol: string;
  side: "Buy" | "Sell";
  orderType: string;
  orderStatus: string;
  qty: string;
  cumExecQty: string;
  cumExecValue: string;
  avgPrice: string;
};

type BybitWsMessage = {
  op?: string;
  topic?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
  success?: boolean;
  ret_msg?: string;
  type?: string;
};

type BybitRestResponse<T> = {
  retCode: number;
  retMsg: string;
  result: T;
};

// ─── Клиент ───────────────────────────────────────────────────────────────────

export class BybitClient {
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly wsUrl: string;
  private readonly restBase: string;

  private ws: WebSocket | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isDestroyed = false;
  private reconnectDelay = 5_000;

  private positionCallbacks: Array<(data: BybitPosition[]) => void> = [];
  private orderFilledCallbacks: Array<(data: BybitOrder) => void> = [];

  constructor(apiKey: string, apiSecret: string, demo = false) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.wsUrl    = demo
      ? "wss://stream-demo.bybit.com/v5/private"
      : "wss://stream.bybit.com/v5/private";
    this.restBase = demo
      ? "https://api-demo.bybit.com"
      : "https://api.bybit.com";
  }

  // ── Подключение ─────────────────────────────────────────────────────────────

  async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.wsUrl);

        this.ws.once("open", () => {
          console.log("[BybitClient] WebSocket connected");
          this.authenticate();
          this.startPing();
          resolve();
        });

        this.ws.on("message", (raw: Buffer | string) => {
          this.handleMessage(raw.toString());
        });

        this.ws.on("error", (err: Error) => {
          console.error("[BybitClient] WS error:", err.message);
          // reject только при первом подключении
          reject(err);
        });

        this.ws.on("close", (code: number, reason: Buffer) => {
          console.warn(
            `[BybitClient] WS closed (${code} ${reason.toString()}), reconnecting in ${this.reconnectDelay / 1000}s...`
          );
          this.clearTimers();
          this.scheduleReconnect();
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  // ── Аутентификация через подписанный запрос ─────────────────────────────────

  private authenticate(): void {
    const expires = Date.now() + 10_000;
    const sig = createHmac("sha256", this.apiSecret)
      .update(`GET/realtime${expires}`)
      .digest("hex");

    this.wsSend({ op: "auth", args: [this.apiKey, expires, sig] });
  }

  // ── Подписка на топики после успешной аутентификации ───────────────────────

  private subscribeTopics(): void {
    this.wsSend({ op: "subscribe", args: ["position", "order", "execution"] });
    console.log("[BybitClient] Subscribed to position/order/execution");
  }

  // ── Обработка входящих сообщений ────────────────────────────────────────────

  private handleMessage(raw: string): void {
    let msg: BybitWsMessage;
    try {
      msg = JSON.parse(raw) as BybitWsMessage;
    } catch {
      return;
    }

    // Подтверждение аутентификации
    if (msg.op === "auth") {
      if (msg.success) {
        this.subscribeTopics();
      } else {
        console.error("[BybitClient] Auth failed:", msg.ret_msg);
      }
      return;
    }

    // Обновление позиций
    if (msg.topic === "position" && Array.isArray(msg.data)) {
      const positions = msg.data as BybitPosition[];
      for (const cb of this.positionCallbacks) {
        try { cb(positions); } catch (e) { console.error("[BybitClient] positionCallback error:", e); }
      }
      return;
    }

    // Обновление ордеров / исполнений
    if (msg.topic === "order" || msg.topic === "execution") {
      const items: BybitOrder[] = Array.isArray(msg.data) ? msg.data as BybitOrder[] : [msg.data as BybitOrder];
      for (const order of items) {
        if (order.orderStatus === "Filled" || order.orderStatus === "PartiallyFilled") {
          for (const cb of this.orderFilledCallbacks) {
            try { cb(order); } catch (e) { console.error("[BybitClient] orderFilledCallback error:", e); }
          }
        }
      }
    }
  }

  // ── Колбэки ─────────────────────────────────────────────────────────────────

  onPositionUpdate(callback: (data: BybitPosition[]) => void): void {
    this.positionCallbacks.push(callback);
  }

  onOrderFilled(callback: (data: BybitOrder) => void): void {
    this.orderFilledCallbacks.push(callback);
  }

  // ── REST: Отмена всех открытых ордеров ─────────────────────────────────────

  async cancelAllOrders(): Promise<void> {
    console.log("[BybitClient] Cancelling all orders...");
    const body = JSON.stringify({ category: "linear", settleCoin: "USDT" });
    const res = await this.restPost<{ list: unknown[] }>("/v5/order/cancel-all", body);
    console.log(`[BybitClient] Cancelled orders:`, res);
  }

  // ── REST: Закрытие всех открытых позиций ───────────────────────────────────

  async closeAllPositions(): Promise<void> {
    console.log("[BybitClient] Closing all positions...");
    const positions = await this.getOpenPositions();

    const openPositions = positions.filter((p) => parseFloat(p.size) > 0 && p.side !== "None");
    if (openPositions.length === 0) {
      console.log("[BybitClient] No open positions to close");
      return;
    }

    await Promise.allSettled(
      openPositions.map((pos) =>
        this.placeMarketClose(
          pos.symbol,
          pos.side === "Buy" ? "Sell" : "Buy",
          pos.size
        ).catch((err: Error) => {
          console.error(`[BybitClient] Failed to close ${pos.symbol}:`, err.message);
        })
      )
    );
    console.log(`[BybitClient] Closed ${openPositions.length} positions`);
  }

  async getOpenPositions(): Promise<BybitPosition[]> {
    const result = await this.restGet<{ list: BybitPosition[] }>(
      "/v5/position/list",
      { category: "linear", settleCoin: "USDT" }
    );
    return result.list;
  }

  /** Суммарный unrealized PnL по всем открытым позициям */
  async getUnrealizedPnl(): Promise<number> {
    const positions = await this.getOpenPositions();
    return positions
      .filter(p => parseFloat(p.size) > 0 && p.side !== "None")
      .reduce((sum, p) => sum + parseFloat(p.unrealisedPnl), 0);
  }

  private async placeMarketClose(symbol: string, side: string, qty: string): Promise<void> {
    const body = JSON.stringify({
      category: "linear",
      symbol,
      side,
      orderType: "Market",
      qty,
      reduceOnly: true,
    });
    await this.restPost<{ orderId: string }>("/v5/order/create", body);
  }

  // ── REST: Проверка подключения (валидация API-ключей) ──────────────────────

  async testConnection(): Promise<{ uid: string; balance: number }> {
    type WalletResult = {
      list: Array<{
        accountType: string;
        totalEquity: string;
        coin: Array<{ coin: string; walletBalance: string }>;
      }>;
    };
    const result = await this.restGet<WalletResult>(
      "/v5/account/wallet-balance",
      { accountType: "UNIFIED" }
    );
    const account = result.list[0];
    const balance = account ? parseFloat(account.totalEquity) : 0;
    // UID можно получить из /v5/user/query-api, но баланс достаточен для проверки
    return { uid: this.apiKey.slice(0, 8), balance };
  }

  // ── REST: P&L за сегодня (закрытые позиции) ────────────────────────────────

  async getDailyPnl(): Promise<number> {
    const startOfDay = this.startOfTodayMs();
    const result = await this.restGet<{ list: Array<{ closedPnl: string }> }>(
      "/v5/position/closed-pnl",
      { category: "linear", startTime: startOfDay.toString() }
    );
    return result.list.reduce((sum, t) => sum + parseFloat(t.closedPnl), 0);
  }

  // ── REST: Закрытые сделки за сегодня (для сохранения в БД) ─────────────────

  async getTodayTrades(): Promise<BybitClosedPnlRecord[]> {
    const startOfDay = this.startOfTodayMs();
    const result = await this.restGet<{
      list:             BybitClosedPnlRecord[];
      nextPageCursor?:  string;
    }>(
      "/v5/position/closed-pnl",
      { category: "linear", startTime: startOfDay.toString(), limit: "200" }
    );
    return result.list;
  }

  // ── REST: Количество сделок за дату ────────────────────────────────────────

  async getTradesCount(date: Date): Promise<number> {
    const start = this.startOfDayMs(date);
    const end   = start + 86_400_000;
    const result = await this.restGet<{ list: unknown[] }>(
      "/v5/execution/list",
      { category: "linear", startTime: start.toString(), endTime: end.toString() }
    );
    return result.list.length;
  }

  // ── REST: P&L за произвольный период ───────────────────────────────────────

  async getPnlForPeriod(startMs: number): Promise<number> {
    const result = await this.restGet<{ list: Array<{ closedPnl: string }> }>(
      "/v5/position/closed-pnl",
      { category: "linear", startTime: startMs.toString() }
    );
    return result.list.reduce((sum, t) => sum + parseFloat(t.closedPnl), 0);
  }

  // ── Вспомогательные методы REST ─────────────────────────────────────────────

  private async restPost<T>(path: string, body: string): Promise<T> {
    const ts  = Date.now().toString();
    const rw  = "5000";
    const sig = this.signPost(ts, body, rw);

    const res = await fetch(`${this.restBase}${path}`, {
      method: "POST",
      headers: {
        "X-BAPI-API-KEY":      this.apiKey,
        "X-BAPI-TIMESTAMP":    ts,
        "X-BAPI-SIGN":         sig,
        "X-BAPI-RECV-WINDOW":  rw,
        "Content-Type":        "application/json",
      },
      body,
    });

    const json = await res.json() as BybitRestResponse<T>;
    if (json.retCode !== 0) {
      throw new Error(`[BybitClient] POST ${path} failed (${json.retCode}): ${json.retMsg}`);
    }
    return json.result;
  }

  private async restGet<T>(path: string, params: Record<string, string>): Promise<T> {
    const ts    = Date.now().toString();
    const rw    = "5000";
    const query = new URLSearchParams(params).toString();
    const sig   = this.signGet(ts, query, rw);

    const res = await fetch(`${this.restBase}${path}?${query}`, {
      headers: {
        "X-BAPI-API-KEY":      this.apiKey,
        "X-BAPI-TIMESTAMP":    ts,
        "X-BAPI-SIGN":         sig,
        "X-BAPI-RECV-WINDOW":  rw,
      },
    });

    const json = await res.json() as BybitRestResponse<T>;
    if (json.retCode !== 0) {
      throw new Error(`[BybitClient] GET ${path} failed (${json.retCode}): ${json.retMsg}`);
    }
    return json.result;
  }

  // ── Подпись запросов ─────────────────────────────────────────────────────────

  private signPost(ts: string, body: string, rw: string): string {
    return createHmac("sha256", this.apiSecret)
      .update(ts + this.apiKey + rw + body)
      .digest("hex");
  }

  private signGet(ts: string, query: string, rw: string): string {
    return createHmac("sha256", this.apiSecret)
      .update(ts + this.apiKey + rw + query)
      .digest("hex");
  }

  // ── Утилиты ─────────────────────────────────────────────────────────────────

  private startOfTodayMs(): number {
    return this.startOfDayMs(new Date());
  }

  private startOfDayMs(date: Date): number {
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  }

  // ── WebSocket хелперы ────────────────────────────────────────────────────────

  private wsSend(payload: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  private startPing(): void {
    this.pingTimer = setInterval(() => {
      this.wsSend({ op: "ping" });
    }, 20_000);
  }

  private clearTimers(): void {
    if (this.pingTimer)     { clearInterval(this.pingTimer);   this.pingTimer = null; }
    if (this.reconnectTimer){ clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
  }

  private scheduleReconnect(): void {
    if (this.isDestroyed) return;
    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connectWebSocket();
        this.reconnectDelay = 5_000; // сбросить задержку при успехе
      } catch (err) {
        console.error("[BybitClient] Reconnect failed:", err);
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, 60_000); // exponential backoff
        this.scheduleReconnect();
      }
    }, this.reconnectDelay);
  }

  // ── Уничтожение клиента ──────────────────────────────────────────────────────

  destroy(): void {
    this.isDestroyed = true;
    this.clearTimers();
    this.ws?.close();
    this.ws = null;
    this.positionCallbacks = [];
    this.orderFilledCallbacks = [];
  }
}
