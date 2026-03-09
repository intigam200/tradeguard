import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BybitClient } from "@/lib/exchanges/bybit-client";
import { decrypt } from "@/lib/crypto";

export const dynamic = "force-dynamic";

export async function GET() {
  const account = await prisma.connectedAccount.findFirst({
    where: { broker: "BYBIT" }
  });
  if (!account) return NextResponse.json({ error: "No Bybit account" });
  const client = new BybitClient(decrypt(account.apiKey), decrypt(account.apiSecret), false);
  try {
    const conn = await client.testConnection();
    const trades = await client.getHistoricalTrades(Date.now() - 90 * 24 * 3_600_000);
    return NextResponse.json({ isTestnet: account.isTestnet, conn, tradesCount: trades.length, first: trades[0] ?? null });
  } catch(e) {
    return NextResponse.json({ error: (e as Error).message });
  }
}
