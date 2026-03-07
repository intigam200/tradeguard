/**
 * GET /api/broker/live — живые данные с биржи (баланс + дневной PnL)
 * Обращается напрямую к Bybit API, не использует Trade-таблицу.
 * Требует cookie tg_uid.
 */

import { NextResponse }   from "next/server";
import { cookies }        from "next/headers";
import { prisma }         from "@/lib/prisma";
import { BybitClient }    from "@/lib/exchanges/bybit-client";
import { decrypt }        from "@/lib/crypto";

async function getUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get("tg_uid")?.value ?? null;
}

export async function GET(): Promise<NextResponse> {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

  try {
    const accounts = await prisma.connectedAccount.findMany({
      where:  { userId, isActive: true, broker: "BYBIT" },
      select: { id: true, apiKey: true, apiSecret: true, isTestnet: true, label: true },
    });

    if (accounts.length === 0) {
      return NextResponse.json({ ok: true, balance: 0, dailyPnl: 0, accounts: [] });
    }

    // Параллельный запрос к каждому Bybit-аккаунту
    const results = await Promise.allSettled(
      accounts.map(async (acc) => {
        const client = new BybitClient(
          decrypt(acc.apiKey),
          decrypt(acc.apiSecret),
          acc.isTestnet,
        );
        const [conn, dailyPnl] = await Promise.all([
          client.testConnection(),
          client.getDailyPnl(),
        ]);
        return { id: acc.id, label: acc.label, balance: conn.balance, dailyPnl };
      })
    );

    let totalBalance = 0;
    let totalDailyPnl = 0;
    const accountData: { id: string; label: string | null; balance: number; dailyPnl: number }[] = [];

    for (const r of results) {
      if (r.status === "fulfilled") {
        totalBalance  += r.value.balance;
        totalDailyPnl += r.value.dailyPnl;
        accountData.push(r.value);
      }
    }

    return NextResponse.json({
      ok:        true,
      balance:   totalBalance,
      dailyPnl:  totalDailyPnl,
      accounts:  accountData,
    });
  } catch (err) {
    console.error("[API /broker/live] error:", err);
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
