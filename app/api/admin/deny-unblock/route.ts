export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/deny-unblock?userId=...&token=...
 * Admin denies an unblock request. Triggered by a Telegram link.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma }                    from "@/lib/prisma";
import { pusherServer }              from "@/lib/pusher";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;
  const userId = searchParams.get("userId");
  const token  = searchParams.get("token");
  const reason = searchParams.get("reason") ?? "Your block period must be completed for your own discipline.";

  if (!userId || !token) {
    return new NextResponse("<h2>Missing parameters</h2>", { status: 400, headers: { "Content-Type": "text/html" } });
  }

  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken || token !== adminToken) {
    return new NextResponse("<h2>Invalid token</h2>", { status: 403, headers: { "Content-Type": "text/html" } });
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!user) {
    return new NextResponse("<h2>User not found</h2>", { status: 404, headers: { "Content-Type": "text/html" } });
  }

  // Mark unblock requests as denied
  await prisma.unblockRequest.updateMany({
    where: { userId, status: "pending" },
    data:  { status: "denied", resolvedAt: new Date() },
  });

  // Notify user via Pusher
  try {
    await pusherServer.trigger(`user-${userId}`, "unblock-denied", { reason });
  } catch {
    // Pusher not configured — skip
  }

  return new NextResponse(
    `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px;background:#0d1117;color:#e6edf3">` +
    `<h2 style="color:#f85149">❌ Request Denied</h2>` +
    `<p>Unblock request for <b>${user.email}</b> has been denied.</p>` +
    `<p style="color:#8b949e">You can close this tab.</p>` +
    `</body></html>`,
    { status: 200, headers: { "Content-Type": "text/html" } },
  );
}
