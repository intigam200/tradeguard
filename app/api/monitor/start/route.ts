/**
 * POST /api/monitor/start — запускает WebSocket мониторинг
 * для всех активных аккаунтов текущего пользователя.
 *
 * Использует существующий MonitorManager (lib/monitor.ts) и LimitEngine (lib/limit-engine.ts).
 * Требует cookie tg_uid.
 */

import { NextResponse } from "next/server";
import { cookies }      from "next/headers";
import { prisma }       from "@/lib/prisma";
import { monitor }      from "@/lib/monitor";

export const dynamic = "force-dynamic";

export async function POST(): Promise<NextResponse> {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get("tg_uid")?.value ?? null;

    if (!userId) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    const accounts = await prisma.connectedAccount.findMany({
      where: { userId, isActive: true, isBlocked: false },
      select: { id: true, broker: true },
    });

    const results = await Promise.allSettled(
      accounts.map(acc => monitor.addAccount(acc.id))
    );

    const started = results.filter(r => r.status === "fulfilled").length;
    const failed  = results.filter(r => r.status === "rejected").length;

    return NextResponse.json({
      ok:      true,
      message: `WebSocket monitoring active for ${started} account(s)`,
      started,
      failed,
    });
  } catch (err) {
    console.error("[API /monitor/start] error:", err);
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
