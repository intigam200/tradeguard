/**
 * PATCH /api/breaches/[id] — подтвердить (acknowledge) нарушение
 *
 * Требует cookie tg_uid.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

async function getUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get("tg_uid")?.value ?? null;
}

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;

  const breach = await prisma.limitBreach.findUnique({ where: { id } });
  if (!breach) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }
  if (breach.userId !== userId) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  await prisma.limitBreach.update({
    where: { id },
    data:  { isAcknowledged: true, acknowledgedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
