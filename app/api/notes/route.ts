import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function getUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get("tg_uid")?.value ?? null;
}

export async function GET(): Promise<NextResponse> {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

  const notes = await prisma.note.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(notes);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as {
    title?: string; content?: string; tags?: string[];
    mood?: string; tradeDate?: string; images?: string[];
  };

  const note = await prisma.note.create({
    data: {
      userId,
      title:     body.title     ?? "Untitled",
      content:   body.content   ?? "",
      tags:      body.tags      ?? [],
      mood:      body.mood      ?? "neutral",
      images:    body.images    ?? [],
      tradeDate: body.tradeDate ? new Date(body.tradeDate) : null,
    },
  });

  return NextResponse.json(note, { status: 201 });
}
