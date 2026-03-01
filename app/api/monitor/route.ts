/**
 * GET  /api/monitor/status  — статус мониторинга всех аккаунтов
 * POST /api/monitor/unblock — ручная разблокировка аккаунта (только admin)
 * POST /api/monitor/start   — добавить аккаунт в мониторинг
 * POST /api/monitor/stop    — остановить мониторинг аккаунта
 * POST /api/monitor/check   — форсировать проверку лимитов
 */

import { NextRequest, NextResponse } from "next/server";
import { monitor }  from "@/lib/monitor";
import { prisma }   from "@/lib/prisma";

// Инициализируем монитор при первом запросе (если ещё не инициализирован)
let initPromise: Promise<void> | null = null;

function ensureInit(): Promise<void> {
  if (!initPromise) {
    initPromise = monitor.init();
  }
  return initPromise;
}

// ─── GET /api/monitor/status ─────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  try {
    await ensureInit();

    const statuses = monitor.status();

    // Обогащаем статусы данными из БД
    const enriched = await Promise.all(
      statuses.map(async (s) => {
        const account = await prisma.connectedAccount.findUnique({
          where: { id: s.accountId },
          select: {
            id:           true,
            broker:       true,
            label:        true,
            isBlocked:    true,
            blockedUntil: true,
            blockReason:  true,
            userId:       true,
          },
        });
        return {
          ...s,
          label:        account?.label ?? null,
          userId:       account?.userId ?? null,
          blockedUntil: account?.blockedUntil ?? null,
          blockReason:  account?.blockReason ?? null,
        };
      })
    );

    return NextResponse.json({
      ok:       true,
      count:    enriched.length,
      accounts: enriched,
    });
  } catch (err) {
    console.error("[API /monitor] GET error:", err);
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}

// ─── POST /api/monitor/* ─────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    await ensureInit();

    const url    = new URL(req.url);
    const action = url.searchParams.get("action");

    const body = await req.json() as { accountId?: string; adminKey?: string };
    const { accountId, adminKey } = body;

    // Простая проверка admin-ключа для защищённых операций
    const isAdmin = adminKey === process.env.MONITOR_ADMIN_KEY;

    switch (action) {

      // Разблокировать аккаунт вручную (только admin)
      case "unblock": {
        if (!isAdmin) {
          return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
        }
        if (!accountId) {
          return NextResponse.json({ ok: false, error: "accountId required" }, { status: 400 });
        }

        await monitor.unblockAccount(accountId);

        return NextResponse.json({
          ok:      true,
          message: `Account ${accountId} unblocked`,
        });
      }

      // Добавить аккаунт в мониторинг
      case "start": {
        if (!accountId) {
          return NextResponse.json({ ok: false, error: "accountId required" }, { status: 400 });
        }

        await monitor.addAccount(accountId);

        return NextResponse.json({
          ok:      true,
          message: `Monitoring started for ${accountId}`,
        });
      }

      // Остановить мониторинг аккаунта
      case "stop": {
        if (!isAdmin) {
          return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
        }
        if (!accountId) {
          return NextResponse.json({ ok: false, error: "accountId required" }, { status: 400 });
        }

        monitor.removeAccount(accountId);

        return NextResponse.json({
          ok:      true,
          message: `Monitoring stopped for ${accountId}`,
        });
      }

      // Форсировать проверку лимитов
      case "check": {
        if (!accountId) {
          return NextResponse.json({ ok: false, error: "accountId required" }, { status: 400 });
        }

        await monitor.forceCheck(accountId);

        return NextResponse.json({
          ok:      true,
          message: `Limit check triggered for ${accountId}`,
        });
      }

      default:
        return NextResponse.json(
          { ok: false, error: `Unknown action: ${action ?? "(none)"}. Use: unblock | start | stop | check` },
          { status: 400 }
        );
    }
  } catch (err) {
    console.error("[API /monitor] POST error:", err);
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
