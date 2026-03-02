/**
 * GET /api/admin/unblock?userId=...&token=...
 * Admin approves an unblock request. Triggered by a Telegram link.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma }                    from "@/lib/prisma";
import { pusherServer }              from "@/lib/pusher";
import { sendTelegramAlert }         from "@/lib/notifications/telegram";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;
  const userId = searchParams.get("userId");
  const token  = searchParams.get("token");

  if (!userId || !token) {
    return new NextResponse("<h2>Missing parameters</h2>", { status: 400, headers: { "Content-Type": "text/html" } });
  }

  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken || token !== adminToken) {
    return new NextResponse("<h2>Invalid token</h2>", { status: 403, headers: { "Content-Type": "text/html" } });
  }

  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: { email: true, telegramChatId: true, notifyOnUnblock: true },
  });
  if (!user) {
    return new NextResponse("<h2>User not found</h2>", { status: 404, headers: { "Content-Type": "text/html" } });
  }

  // Unblock all active accounts
  await prisma.connectedAccount.updateMany({
    where: { userId, isActive: true },
    data:  { isBlocked: false, blockedAt: null, blockedUntil: null, blockReason: null },
  });

  // Mark unblock requests as approved
  await prisma.unblockRequest.updateMany({
    where: { userId, status: "pending" },
    data:  { status: "approved", resolvedAt: new Date() },
  });

  // Notify user via Pusher
  try {
    await pusherServer.trigger(`user-${userId}`, "unblock-approved", {});
  } catch {
    // Pusher not configured — skip
  }

  // Notify user via Telegram if they have a chatId and prefer notifications
  if (user.telegramChatId && user.notifyOnUnblock) {
    await sendTelegramAlert(
      user.telegramChatId,
      `✅ <b>TradeGuard — Trading Unblocked</b>\n\nYour early unblock request has been approved. You can resume trading now. Trade wisely!`,
    );
  }

  return new NextResponse(
    `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px;background:#0d1117;color:#e6edf3">` +
    `<h2 style="color:#3fb950">✅ Unblock Approved</h2>` +
    `<p>User <b>${user.email}</b> has been unblocked successfully.</p>` +
    `<p style="color:#8b949e">You can close this tab.</p>` +
    `</body></html>`,
    { status: 200, headers: { "Content-Type": "text/html" } },
  );
}
