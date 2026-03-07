/**
 * POST /api/support/request-unblock
 * Creates an UnblockRequest in DB and sends Telegram to admin with approve/deny links.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies }                   from "next/headers";
import { prisma }                    from "@/lib/prisma";
import { sendTelegramAlert }         from "@/lib/notifications/telegram";

export const dynamic = 'force-dynamic';

async function getUserId(): Promise<string | null> {
  const store = await cookies();
  return store.get("tg_uid")?.value ?? null;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

  const body = await req.json() as { blockReason?: string | null; blockedUntil?: string | null };

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!user) return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });

  // Prevent duplicate pending requests
  const existing = await prisma.unblockRequest.findFirst({
    where: { userId, status: "pending" },
  });
  if (existing) return NextResponse.json({ ok: true, alreadyPending: true });

  const reason = body.blockReason ?? "Unknown reason";
  await prisma.unblockRequest.create({ data: { userId, blockReason: reason } });

  const adminChatId = process.env.ADMIN_TELEGRAM_CHAT_ID;
  const adminToken  = process.env.ADMIN_TOKEN;
  const adminUrl    = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  if (adminChatId && adminToken) {
    const until       = body.blockedUntil ? new Date(body.blockedUntil).toUTCString() : "unknown";
    const approveUrl  = `${adminUrl}/api/admin/unblock?userId=${userId}&token=${adminToken}`;
    const denyUrl     = `${adminUrl}/api/admin/deny-unblock?userId=${userId}&token=${adminToken}`;

    await sendTelegramAlert(
      adminChatId,
      `🔓 <b>UNBLOCK REQUEST</b>\n\n` +
      `User: <b>${user.email}</b>\n` +
      `Reason: <b>${reason}</b>\n` +
      `Blocked until: <b>${until}</b>\n\n` +
      `<a href="${approveUrl}">✅ Approve Unblock</a>\n` +
      `<a href="${denyUrl}">❌ Deny Request</a>`,
    );
  }

  return NextResponse.json({ ok: true });
}
