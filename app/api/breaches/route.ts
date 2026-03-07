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

export async function GET(req: Request): Promise<NextResponse> {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to   = searchParams.get("to");

  const breaches = await prisma.limitBreach.findMany({
    where: {
      userId,
      ...(from || to ? {
        occurredAt: {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to   ? { lte: new Date(to)   } : {}),
        },
      } : {}),
    },
    orderBy: { occurredAt: "desc" },
    take:    200,
  });

  return NextResponse.json({ ok: true, breaches });
}
