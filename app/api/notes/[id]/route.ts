import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function getUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get("tg_uid")?.value ?? null;
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({})) as {
    title?: string; content?: string; tags?: string[];
    mood?: string; tradeDate?: string; images?: string[];
  };

  const note = await prisma.note.update({
    where: { id, userId },
    data: {
      title:     body.title,
      content:   body.content,
      tags:      body.tags,
      mood:      body.mood,
      images:    body.images,
      tradeDate: body.tradeDate ? new Date(body.tradeDate) : null,
    },
  });

  return NextResponse.json(note);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  await prisma.note.delete({ where: { id, userId } });

  return NextResponse.json({ ok: true });
}
