/**
 * POST /api/trades/import — save browser-fetched Bybit trade data and check limits
 *
 * Called by the client after it fetches closed trades directly from Bybit API
 * (bypassing Vercel IP block). Server saves to DB and runs limit checks.
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { cookies }          from "next/headers";
import { prisma }           from "@/lib/prisma";
import { checkLimitsFromDb } from "@/lib/sync";

async function getUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get("tg_uid")?.value ?? null;
}

type TradeRecord = {
  orderId:       string;
  symbol:        string;
  side:          "Buy" | "Sell";
  qty:           string;
  avgEntryPrice: string;
  avgExitPrice:  string;
  closedPnl:     string;
  createdTime:   string; // unix ms string
};

type ImportBody = {
  accountId:     string;
  trades:        TradeRecord[];
  unrealizedPnl?: number;
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

  let body: ImportBody;
  try {
    body = await req.json() as ImportBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { accountId, trades, unrealizedPnl = 0 } = body;

  // Verify account belongs to this user
  const account = await prisma.connectedAccount.findUnique({
    where:  { id: accountId },
    select: { userId: true },
  });
  if (!account || account.userId !== userId) {
    return NextResponse.json({ ok: false, error: "Account not found" }, { status: 404 });
  }

  let synced  = 0;
  let skipped = 0;

  for (const t of trades) {
    const existing = await prisma.trade.findFirst({
      where:  { userId, externalId: t.orderId },
      select: { id: true },
    });
    if (existing) { skipped++; continue; }

    const closedAt = new Date(parseInt(t.createdTime));

    try {
      await prisma.trade.create({
        data: {
          userId,
          accountId,
          externalId:  t.orderId,
          symbol:      t.symbol,
          direction:   t.side === "Sell" ? "LONG" : "SHORT",
          status:      "CLOSED",
          entryPrice:  parseFloat(t.avgEntryPrice) || 0,
          exitPrice:   parseFloat(t.avgExitPrice)  || 0,
          quantity:    parseFloat(t.qty)            || 0,
          realizedPnl: parseFloat(t.closedPnl)     || 0,
          commission:  0,
          openedAt:    closedAt,
          closedAt,
        },
      });
      synced++;
    } catch (err) {
      console.error(`[Import] Failed to save trade ${t.orderId}:`, (err as Error).message);
    }
  }

  console.log(`[Import] account=${accountId} synced=${synced} skipped=${skipped} unrealizedPnl=${unrealizedPnl.toFixed(2)}`);

  // Check limits based on DB data (no Bybit API call needed)
  const limitResult = await checkLimitsFromDb(accountId, unrealizedPnl).catch((e: Error) => {
    console.error(`[Import] checkLimitsFromDb error:`, e.message);
    return { blocked: false as const, reason: undefined };
  });

  return NextResponse.json({
    ok:        true,
    synced,
    skipped,
    isBlocked: limitResult.blocked,
    reason:    limitResult.blocked ? (limitResult as { blocked: true; reason?: string }).reason : undefined,
  });
}
