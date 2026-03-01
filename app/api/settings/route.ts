/**
 * GET  /api/settings → профиль пользователя (имя, email, уведомления)
 * PUT  /api/settings → обновить настройки уведомлений
 *
 * Требует cookie tg_uid.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies }                   from "next/headers";
import { prisma }                    from "@/lib/prisma";

async function getUserId(): Promise<string | null> {
  const store = await cookies();
  return store.get("tg_uid")?.value ?? null;
}

export async function GET(): Promise<NextResponse> {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: {
      id: true, email: true, name: true, role: true,
      telegramChatId: true, notifyEmail: true,
      notifyOnBlock: true, notifyOnWarning: true, notifyDailySummary: true,
    },
  });

  if (!user) return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });

  return NextResponse.json({ ok: true, user });
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

  const body = await req.json() as {
    name?:              string;
    telegramChatId?:    string | null;
    notifyEmail?:       string | null;
    notifyOnBlock?:     boolean;
    notifyOnWarning?:   boolean;
    notifyDailySummary?: boolean;
  };

  const user = await prisma.user.update({
    where: { id: userId },
    data:  {
      ...(body.name               !== undefined && { name: body.name }),
      ...(body.telegramChatId     !== undefined && { telegramChatId: body.telegramChatId || null }),
      ...(body.notifyEmail        !== undefined && { notifyEmail: body.notifyEmail || null }),
      ...(body.notifyOnBlock      !== undefined && { notifyOnBlock: body.notifyOnBlock }),
      ...(body.notifyOnWarning    !== undefined && { notifyOnWarning: body.notifyOnWarning }),
      ...(body.notifyDailySummary !== undefined && { notifyDailySummary: body.notifyDailySummary }),
    },
    select: {
      id: true, email: true, name: true,
      telegramChatId: true, notifyEmail: true,
      notifyOnBlock: true, notifyOnWarning: true, notifyDailySummary: true,
    },
  });

  return NextResponse.json({ ok: true, user });
}
