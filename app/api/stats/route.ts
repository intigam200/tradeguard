/**
 * GET /api/stats — сводная статистика для дашборда
 *
 * Возвращает: accounts, limits, hasLimits, usage, breachesToday, totalBreaches, recentBreaches
 * Требует cookie tg_uid.
 */

import { NextResponse } from "next/server";
import { cookies }      from "next/headers";
import { prisma }       from "@/lib/prisma";

async function getUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get("tg_uid")?.value ?? null;
}

export async function GET(): Promise<NextResponse> {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
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

  const threeMonthStart = new Date();
  threeMonthStart.setUTCMonth(threeMonthStart.getUTCMonth() - 3);
  threeMonthStart.setUTCHours(0, 0, 0, 0);

  try {
    const now = new Date();

    const [
      , accounts, limits, breachesToday, totalBreaches, recentBreaches,
      todayTrades, weekTrades, monthTrades, recentClosedTrades,
      threeMonthAgg, allTimeAgg,
    ] = await Promise.all([
      // Авто-сброс истёкших блокировок (параллельно с остальными запросами)
      prisma.connectedAccount.updateMany({
        where: { userId, isBlocked: true, blockedUntil: { lt: now } },
        data:  { isBlocked: false, blockedUntil: null, blockReason: null },
      }),
      prisma.connectedAccount.findMany({
        where:   { userId, isActive: true },
        select:  { id: true, broker: true, label: true, isBlocked: true,
                   blockedUntil: true, blockReason: true, isTestnet: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.userLimits.findUnique({ where: { userId } }),
      prisma.limitBreach.count({ where: { userId, occurredAt: { gte: todayStart } } }),
      prisma.limitBreach.count({ where: { userId } }),
      prisma.limitBreach.findMany({
        where: { userId }, orderBy: { occurredAt: "desc" }, take: 5,
      }),
      prisma.trade.findMany({
        where:  { userId, status: "CLOSED", closedAt: { gte: todayStart } },
        select: { realizedPnl: true },
      }),
      prisma.trade.findMany({
        where:  { userId, status: "CLOSED", closedAt: { gte: weekStart } },
        select: { realizedPnl: true },
      }),
      prisma.trade.findMany({
        where:  { userId, status: "CLOSED", closedAt: { gte: monthStart } },
        select: { realizedPnl: true },
      }),
      prisma.trade.findMany({
        where:   { userId, status: "CLOSED" },
        orderBy: { closedAt: "desc" },
        take:    20,
        select:  { realizedPnl: true },
      }),
      prisma.trade.aggregate({
        where: { userId, status: "CLOSED", closedAt: { gte: threeMonthStart } },
        _sum:  { realizedPnl: true },
      }),
      prisma.trade.aggregate({
        where: { userId, status: "CLOSED" },
        _sum:  { realizedPnl: true },
      }),
    ]);

    const dailyPnl         = todayTrades.reduce((s, t) => s + (t.realizedPnl ?? 0), 0);
    const dailyTradesCount = todayTrades.length;
    const weeklyPnl        = weekTrades.reduce((s, t) => s + (t.realizedPnl ?? 0), 0);
    const monthlyPnl       = monthTrades.reduce((s, t) => s + (t.realizedPnl ?? 0), 0);
    const threeMonthPnl    = threeMonthAgg._sum.realizedPnl ?? 0;
    const allTimePnl       = allTimeAgg._sum.realizedPnl ?? 0;

    let consecutiveLosses = 0;
    for (const t of recentClosedTrades) {
      if ((t.realizedPnl ?? 0) < 0) consecutiveLosses++;
      else break;
    }

    return NextResponse.json({
      ok: true,
      userId,
      accounts,
      limits,
      hasLimits: limits !== null,
      usage: { dailyPnl, dailyTradesCount, weeklyPnl, monthlyPnl, threeMonthPnl, allTimePnl, consecutiveLosses },
      breachesToday,
      totalBreaches,
      recentBreaches,
    });
  } catch (err) {
    console.error("[API /stats] error:", err);
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
