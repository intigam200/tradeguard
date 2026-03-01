/**
 * GET /api/breaches — история нарушений текущего пользователя
 *
 * Требует cookie tg_uid.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

async function getUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get("tg_uid")?.value ?? null;
}

export async function GET(): Promise<NextResponse> {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

  const breaches = await prisma.limitBreach.findMany({
    where:   { userId },
    orderBy: { occurredAt: "desc" },
    take:    100,
  });

  return NextResponse.json({ ok: true, breaches });
}
