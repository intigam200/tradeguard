/**
 * DELETE /api/accounts/[id] — отключить брокерский аккаунт
 *
 * Останавливает мониторинг и помечает аккаунт как неактивный.
 * Требует cookie tg_uid.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma }  from "@/lib/prisma";
import { monitor } from "@/lib/monitor";

export const dynamic = 'force-dynamic';

async function getUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get("tg_uid")?.value ?? null;
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;

  // Проверяем что аккаунт принадлежит этому пользователю
  const account = await prisma.connectedAccount.findUnique({
    where: { id },
    select: { id: true, userId: true, isActive: true },
  });

  if (!account) {
    return NextResponse.json({ ok: false, error: "Account not found" }, { status: 404 });
  }

  if (account.userId !== userId) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  // Останавливаем мониторинг
  try {
    monitor.removeAccount(id);
  } catch (err) {
    console.warn("[API /accounts/delete] removeAccount error:", (err as Error).message);
  }

  // Деактивируем в БД
  await prisma.connectedAccount.update({
    where: { id },
    data:  { isActive: false },
  });

  console.log(`[API /accounts] Disconnected account ${id} for user ${userId}`);

  return NextResponse.json({ ok: true, message: `Аккаунт ${id} отключён` });
}
