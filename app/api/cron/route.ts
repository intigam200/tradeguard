export const dynamic = 'force-dynamic';

/**
 * GET /api/cron — автоматическая синхронизация сделок + проверка лимитов
 *
 * Вызывается Vercel Cron каждую минуту (см. vercel.json).
 * Защищён заголовком Authorization: Bearer $CRON_SECRET (необязательно).
 *
 * Для локальной разработки: curl http://localhost:3000/api/cron
 */

import { NextRequest, NextResponse } from "next/server";
import { syncAllAccounts }       from "@/lib/sync";
import { monitor }               from "@/lib/monitor";
import { sendAllDailySummaries } from "@/lib/notifications";

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Опциональная защита от несанкционированного вызова
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("Authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
  }

  const timestamp = new Date().toISOString();
  console.log(`[Cron] ${timestamp} — starting sync + limit check`);

  await monitor.init().catch(console.error);

  // 1. Синхронизировать сделки для всех активных аккаунтов
  let syncResults: { synced: number }[] = [];
  try {
    syncResults = await syncAllAccounts();
  } catch (err) {
    console.error("[Cron] syncAllAccounts failed:", err);
    syncResults = [];
  }

  const totalSynced = syncResults.reduce((s, r) => s + r.synced, 0);

  // 2. Проверить лимиты для всех активных аккаунтов
  const statuses  = monitor.status();
  const checkResults = await Promise.allSettled(
    statuses.map((s) => monitor.forceCheck(s.accountId))
  );

  const checkFailed = checkResults.filter((r) => r.status === "rejected").length;

  // 3. Итоги дня — отправляем в 23:55 UTC
  const now = new Date();
  let dailySummarySent = false;
  if (now.getUTCHours() === 23 && now.getUTCMinutes() === 55) {
    try {
      await sendAllDailySummaries();
      dailySummarySent = true;
      console.log("[Cron] Daily summaries sent");
    } catch (err) {
      console.error("[Cron] sendAllDailySummaries failed:", err);
    }
  }

  console.log(
    `[Cron] ${timestamp} — done: synced=${totalSynced}, ` +
    `accounts=${syncResults.length}, checkFailed=${checkFailed}`
  );

  return NextResponse.json({
    ok:        true,
    timestamp,
    synced:    totalSynced,
    accounts:  syncResults,
    checks:    statuses.length,
    checkFailed,
    dailySummarySent,
  });
}
