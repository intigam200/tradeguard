/**
 * GET  /api/accounts — список подключённых аккаунтов текущего пользователя
 * POST /api/accounts — подключить новый брокерский аккаунт
 *
 * Требует cookie tg_uid (устанавливается через GET /api/setup)
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma }       from "@/lib/prisma";
import { monitor }      from "@/lib/monitor";
import { BybitClient }  from "@/lib/exchanges/bybit-client";
import { BinanceClient } from "@/lib/exchanges/binance-client";
import { encrypt }      from "@/lib/crypto";

export const dynamic = 'force-dynamic';

// ─── Хелпер: читает userId из cookie ─────────────────────────────────────────

async function getUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get("tg_uid")?.value ?? null;
}

// ─── GET /api/accounts ────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Not authenticated. Call /api/setup first." }, { status: 401 });
  }

  try {
    const accounts = await prisma.connectedAccount.findMany({
      where:   { userId, isActive: true },
      select: {
        id:          true,
        broker:      true,
        label:       true,
        isBlocked:   true,
        blockedUntil: true,
        blockReason: true,
        createdAt:   true,
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ ok: true, accounts });
  } catch (err) {
    console.error("[API /accounts] GET error:", err);
    // Возвращаем пустой массив вместо 500 чтобы страница не крашилась
    return NextResponse.json({ ok: true, accounts: [] });
  }
}

// ─── POST /api/accounts ───────────────────────────────────────────────────────

type ConnectBody = {
  broker:     "BYBIT" | "BINANCE" | "DEMO";
  apiKey:     string;
  apiSecret:  string;
  label?:     string;
  isTestnet?: boolean;
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Not authenticated. Call /api/setup first." }, { status: 401 });
  }

  let body: ConnectBody;
  try {
    body = await req.json() as ConnectBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { broker, apiKey, apiSecret, label, isTestnet = false } = body;

  if (!broker) {
    return NextResponse.json(
      { ok: false, error: "broker is required" },
      { status: 400 }
    );
  }

  if (broker !== "BYBIT" && broker !== "BINANCE" && broker !== "DEMO") {
    return NextResponse.json(
      { ok: false, error: "broker must be BYBIT, BINANCE or DEMO" },
      { status: 400 }
    );
  }

  // ── Шаг 1: Валидация API-ключей через тестовый запрос к бирже ───────────────

  let balance = 0;

  if (broker === "DEMO") {
    // Демо-режим: не нужны реальные ключи
    balance = 10000;
  } else {
    if (!apiKey || !apiSecret) {
      return NextResponse.json(
        { ok: false, error: "apiKey и apiSecret обязательны для реальных брокеров" },
        { status: 400 }
      );
    }
    try {
      if (broker === "BYBIT") {
        const client = new BybitClient(apiKey, apiSecret, isTestnet);
        const info   = await client.testConnection();
        balance = info.balance;
      } else {
        const client = new BinanceClient(apiKey, apiSecret);
        const info   = await client.testConnection();
        balance = info.balance;
      }
    } catch (err) {
      const msg = (err as Error).message;
      console.warn("[API /accounts] testConnection failed:", msg);
      return NextResponse.json(
        { ok: false, error: `Неверные API-ключи или нет доступа к бирже: ${msg}` },
        { status: 400 }
      );
    }
  }

  // ── Шаг 2: Сохранить аккаунт в БД ──────────────────────────────────────────

  let accountId: string;
  try {
    const account = await prisma.connectedAccount.create({
      data: {
        userId,
        broker,
        apiKey:    encrypt(apiKey),     // шифруем перед сохранением
        apiSecret: encrypt(apiSecret),  // шифруем перед сохранением
        label:     label ?? null,
        isTestnet: broker === "BYBIT" ? isTestnet : false,
        isActive:  true,
        isBlocked: false,
      },
    });
    accountId = account.id;
    console.log(`[API /accounts] Created account ${accountId} for user ${userId}`);
  } catch (err) {
    console.error("[API /accounts] DB create error:", err);
    return NextResponse.json(
      { ok: false, error: `Ошибка сохранения в базу данных: ${(err as Error).message}` },
      { status: 500 }
    );
  }

  // ── Шаг 3: Запустить мониторинг ─────────────────────────────────────────────

  try {
    await monitor.init();
    await monitor.addAccount(accountId);
    console.log(`[API /accounts] Monitoring started for ${accountId}`);
  } catch (err) {
    // Мониторинг не критичен для ответа — логируем но не фейлим запрос
    console.error("[API /accounts] monitor.addAccount failed:", err);
  }

  return NextResponse.json({
    ok:        true,
    accountId,
    broker,
    balance,
    message:   `Аккаунт подключён. Баланс USDT: ${balance.toFixed(2)}`,
  });
}
