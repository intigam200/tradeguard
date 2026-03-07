/**
 * GET /api/setup — авто-создание тестового пользователя при первом заходе.
 * Устанавливает httpOnly cookie tg_uid с userId.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export const dynamic = 'force-dynamic';

const DEFAULT_EMAIL = "trader@tradeguard.local";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const cookieStore = await cookies();
    const existing = cookieStore.get("tg_uid");

    // Если кука есть — проверяем что пользователь существует
    if (existing?.value) {
      const user = await prisma.user.findUnique({
        where: { id: existing.value },
        select: { id: true, email: true, name: true },
      });
      if (user) {
        return NextResponse.json({ ok: true, userId: user.id, isNew: false, user });
      }
    }

    // Ищем или создаём пользователя по email
    let user = await prisma.user.findUnique({
      where: { email: DEFAULT_EMAIL },
      select: { id: true, email: true, name: true },
    });

    let isNew = false;
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: DEFAULT_EMAIL,
          name:  "Трейдер",
          role:  "TRADER",
        },
        select: { id: true, email: true, name: true },
      });
      isNew = true;
      console.log("[Setup] Created default user:", user.id);
    }

    const response = NextResponse.json({ ok: true, userId: user.id, isNew, user });

    // Устанавливаем cookie на 30 дней
    response.cookies.set("tg_uid", user.id, {
      httpOnly: true,
      sameSite: "lax",
      maxAge:   60 * 60 * 24 * 30,
      path:     "/",
    });

    return response;
  } catch (err) {
    console.error("[API /setup] Error:", err);
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
