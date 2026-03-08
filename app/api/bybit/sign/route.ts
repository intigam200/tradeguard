/**
 * POST /api/bybit/sign — server-side HMAC signing proxy for Bybit API
 *
 * The browser cannot expose apiSecret, so the server signs the request
 * and returns { apiKey, timestamp, signature, recvWindow } to the client.
 * The client then makes the actual Bybit API call directly (bypassing Vercel IP block).
 *
 * apiSecret is NEVER returned to the browser.
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { cookies }  from "next/headers";
import { prisma }   from "@/lib/prisma";
import { decrypt }  from "@/lib/crypto";
import { createHmac } from "crypto";

async function getUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get("tg_uid")?.value ?? null;
}

type SignBody = {
  accountId:   string;
  queryString: string; // e.g. "category=linear&limit=200&startTime=1234567890"
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

  let body: SignBody;
  try {
    body = await req.json() as SignBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { accountId, queryString } = body;

  const account = await prisma.connectedAccount.findUnique({
    where:  { id: accountId },
    select: { userId: true, apiKey: true, apiSecret: true, isTestnet: true },
  });

  if (!account || account.userId !== userId) {
    return NextResponse.json({ ok: false, error: "Account not found" }, { status: 404 });
  }

  const apiKey    = decrypt(account.apiKey);
  const apiSecret = decrypt(account.apiSecret);
  const recvWindow = "5000";
  const timestamp  = Date.now().toString();

  // Bybit signature format: timestamp + apiKey + recvWindow + queryString
  const paramStr  = timestamp + apiKey + recvWindow + queryString;
  const signature = createHmac("sha256", apiSecret).update(paramStr).digest("hex");

  return NextResponse.json({
    ok:         true,
    apiKey,       // not secret — safe to return (Bybit shows it in UI too)
    timestamp,
    signature,
    recvWindow,
    isTestnet:  account.isTestnet,
  });
}
