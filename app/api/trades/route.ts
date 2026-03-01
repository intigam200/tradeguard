/**
 * GET /api/trades — список сделок пользователя из БД
 *
 * Query params:
 *   limit       — количество (по умолчанию 50, макс 1000)
 *   offset      — пагинация
 *   status      — ALL | OPEN | CLOSED
 *   since       — фильтр по openedAt (ISO дата)
 *   until       — фильтр по openedAt (ISO дата)
 *   closedSince — фильтр по closedAt (ISO дата, для аналитики)
 *   closedUntil — фильтр по closedAt (ISO дата, для аналитики)
 *   symbol      — поиск по инструменту
 *   direction   — LONG | SHORT
 *
 * Требует cookie tg_uid.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies }   from "next/headers";
import { prisma }    from "@/lib/prisma";
import type { Prisma } from "@/app/generated/prisma/client";

async function getUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get("tg_uid")?.value ?? null;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

  const sp          = new URL(req.url).searchParams;
  const limit       = Math.min(parseInt(sp.get("limit") ?? "50"), 1000);
  const offset      = parseInt(sp.get("offset") ?? "0");
  const status      = sp.get("status");
  const since       = sp.get("since");
  const until       = sp.get("until");
  const closedSince = sp.get("closedSince");
  const closedUntil = sp.get("closedUntil");
  const symbol      = sp.get("symbol");
  const direction   = sp.get("direction");

  const where: Prisma.TradeWhereInput = { userId };

  if (status && status !== "ALL") where.status = status as "OPEN" | "CLOSED" | "CANCELLED";

  // Filter by closedAt (analytics) or openedAt (default)
  if (closedSince || closedUntil) {
    where.closedAt = {};
    if (closedSince) where.closedAt.gte = new Date(closedSince);
    if (closedUntil) where.closedAt.lte = new Date(closedUntil + "T23:59:59.999Z");
  } else if (since || until) {
    where.openedAt = {};
    if (since) where.openedAt.gte = new Date(since);
    if (until) where.openedAt.lte = new Date(until + "T23:59:59.999Z");
  }

  if (symbol)    where.symbol    = { contains: symbol.toUpperCase() };
  if (direction && direction !== "ALL") where.direction = direction as "LONG" | "SHORT";

  try {
    const [trades, total] = await Promise.all([
      prisma.trade.findMany({
        where,
        orderBy: [{ closedAt: "desc" }, { openedAt: "desc" }],
        take:    limit,
        skip:    offset,
      }),
      prisma.trade.count({ where }),
    ]);
    return NextResponse.json({ ok: true, trades, total });
  } catch (err) {
    console.error("[API /trades] GET error:", err);
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
