/**
 * DELETE /api/breaches/clear — удаляет все подтверждённые нарушения пользователя
 */

import { NextResponse } from "next/server";
import { cookies }      from "next/headers";
import { prisma }       from "@/lib/prisma";

export const dynamic = 'force-dynamic';

async function getUserId(): Promise<string | null> {
  const store = await cookies();
  return store.get("tg_uid")?.value ?? null;
}

export async function DELETE(): Promise<NextResponse> {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

  const { count } = await prisma.limitBreach.deleteMany({
    where: { userId, isAcknowledged: true },
  });

  return NextResponse.json({ ok: true, deleted: count });
}
