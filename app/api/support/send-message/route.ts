/**
 * POST /api/support/send-message
 * Saves a user message to DB and notifies admin via Telegram.
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

  const body = await req.json() as { message?: string };
  const message = body.message?.trim();
  if (!message) return NextResponse.json({ ok: false, error: "Message is required" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!user) return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });

  await prisma.supportMessage.create({ data: { userId, message, role: "user" } });

  const adminChatId = process.env.ADMIN_TELEGRAM_CHAT_ID;
  if (adminChatId) {
    await sendTelegramAlert(
      adminChatId,
      `💬 <b>Support message</b> from <b>${user.email}</b>:\n\n"${message}"`,
    );
  }

  return NextResponse.json({ ok: true });
}
