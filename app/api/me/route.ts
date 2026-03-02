import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get("tg_uid")?.value;
    if (!userId) return NextResponse.json({ ok: false }, { status: 401 });

    const [user, unacknowledgedCount] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true },
      }),
      prisma.limitBreach.count({
        where: { userId, isAcknowledged: false, isWarning: false },
      }),
    ]);

    if (!user) return NextResponse.json({ ok: false }, { status: 404 });

    return NextResponse.json({ ok: true, user, unacknowledgedCount });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
