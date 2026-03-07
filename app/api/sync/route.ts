/**
 * POST /api/sync — импортировать закрытые сделки с биржи в БД
 *   body: { accountId?: string }  — если не указан, синхронизируются все аккаунты
 *
 * GET  /api/sync — синхронизировать все аккаунты + проверить лимиты
 *
 * Требует cookie tg_uid.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies }       from "next/headers";
import { prisma }        from "@/lib/prisma";
import { syncAccount, syncAllAccounts, checkLimitsFromDb } from "@/lib/sync";
import { monitor }       from "@/lib/monitor";

export const dynamic = 'force-dynamic';

async function getUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get("tg_uid")?.value ?? null;
}

// ─── POST /api/sync ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as { accountId?: string };

  // Убедиться что мониторинг запущен
  await monitor.init().catch(console.error);

  let results;

  if (body.accountId) {
    // Проверяем что аккаунт принадлежит пользователю
    const account = await prisma.connectedAccount.findUnique({
      where: { id: body.accountId },
      select: { userId: true },
    });
    if (!account || account.userId !== userId) {
      return NextResponse.json({ ok: false, error: "Account not found" }, { status: 404 });
    }
    results = [await syncAccount(body.accountId)];
  } else {
    // Синхронизировать только аккаунты этого пользователя
    const accounts = await prisma.connectedAccount.findMany({
      where: { userId, isActive: true, broker: { notIn: ["DEMO"] } },
      select: { id: true },
    });
    results = [];
    for (const a of accounts) {
      results.push(await syncAccount(a.id));
    }
  }

  // Проверка лимитов: DB-based (надёжная) + WebSocket-based (если мониторинг активен)
  for (const r of results) {
    if (!r.error) {
      // DB-based проверка — не зависит от in-memory состояния мониторинга
      await checkLimitsFromDb(r.accountId, r.unrealizedPnl).catch((e: Error) =>
        console.error(`[API /sync] checkLimitsFromDb error (${r.accountId}):`, e.message)
      );
      // WebSocket-based проверка как дополнительный слой
      monitor.forceCheck(r.accountId).catch(console.error);
    }
  }

  const totalSynced  = results.reduce((s, r) => s + r.synced, 0);
  const totalSkipped = results.reduce((s, r) => s + r.skipped, 0);

  console.log(`[API /sync] POST: synced=${totalSynced}, skipped=${totalSkipped}, accounts=${results.length}`);

  return NextResponse.json({
    ok:      true,
    synced:  totalSynced,
    skipped: totalSkipped,
    results,
  });
}

// ─── GET /api/sync ────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

  await monitor.init().catch(console.error);

  // Синхронизировать только аккаунты этого пользователя
  const accounts = await prisma.connectedAccount.findMany({
    where: { userId, isActive: true, broker: { notIn: ["DEMO"] } },
    select: { id: true },
  });

  const results = [];
  for (const a of accounts) {
    const r = await syncAccount(a.id);
    results.push(r);
    if (!r.error) {
      await checkLimitsFromDb(a.id, r.unrealizedPnl).catch((e: Error) =>
        console.error(`[API /sync] checkLimitsFromDb error (${a.id}):`, e.message)
      );
      monitor.forceCheck(a.id).catch(console.error);
    }
  }

  return NextResponse.json({ ok: true, results });
}
