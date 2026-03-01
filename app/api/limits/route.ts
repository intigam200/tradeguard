/**
 * GET /api/limits  — получить лимиты текущего пользователя
 * PUT /api/limits  — сохранить / обновить лимиты
 *
 * Требует cookie tg_uid.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

async function getUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get("tg_uid")?.value ?? null;
}

// ─── GET /api/limits ──────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

  const limits = await prisma.userLimits.findUnique({ where: { userId } });
  return NextResponse.json({ ok: true, limits });
}

// ─── PUT /api/limits ──────────────────────────────────────────────────────────

type LimitsBody = {
  dailyLossLimit:       number;
  maxDrawdown:          number;
  maxPositionSize?:     number | null;
  maxRiskPerTrade?:     number | null;
  maxDailyTrades?:      number | null;
  maxConsecutiveLosses?: number | null;
  weeklyLossLimit?:     number | null;
  monthlyLossLimit?:    number | null;
  blockDurationHours?:  number;
  autoUnblock?:         boolean;
  warningThresholdPct?: number;
};

export async function PUT(req: NextRequest): Promise<NextResponse> {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

  let body: LimitsBody;
  try {
    body = await req.json() as LimitsBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.dailyLossLimit || !body.maxDrawdown) {
    return NextResponse.json(
      { ok: false, error: "dailyLossLimit и maxDrawdown обязательны" },
      { status: 400 }
    );
  }

  const limits = await prisma.userLimits.upsert({
    where:  { userId },
    update: {
      dailyLossLimit:       body.dailyLossLimit,
      maxDrawdown:          body.maxDrawdown,
      maxPositionSize:      body.maxPositionSize  ?? null,
      maxRiskPerTrade:      body.maxRiskPerTrade  ?? null,
      maxDailyTrades:       body.maxDailyTrades   ?? null,
      maxConsecutiveLosses: body.maxConsecutiveLosses ?? null,
      weeklyLossLimit:      body.weeklyLossLimit  ?? null,
      monthlyLossLimit:     body.monthlyLossLimit ?? null,
      blockDurationHours:   body.blockDurationHours  ?? 24,
      autoUnblock:          body.autoUnblock       ?? true,
      warningThresholdPct:  body.warningThresholdPct ?? 80,
    },
    create: {
      userId,
      dailyLossLimit:       body.dailyLossLimit,
      maxDrawdown:          body.maxDrawdown,
      maxPositionSize:      body.maxPositionSize  ?? null,
      maxRiskPerTrade:      body.maxRiskPerTrade  ?? null,
      maxDailyTrades:       body.maxDailyTrades   ?? null,
      maxConsecutiveLosses: body.maxConsecutiveLosses ?? null,
      weeklyLossLimit:      body.weeklyLossLimit  ?? null,
      monthlyLossLimit:     body.monthlyLossLimit ?? null,
      blockDurationHours:   body.blockDurationHours  ?? 24,
      autoUnblock:          body.autoUnblock       ?? true,
      warningThresholdPct:  body.warningThresholdPct ?? 80,
    },
  });

  console.log(`[API /limits] Saved limits for user ${userId}`);
  return NextResponse.json({ ok: true, limits });
}
