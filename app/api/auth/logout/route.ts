import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = 'force-dynamic';

export async function POST() {
  const cookieStore = await cookies();
  const response = NextResponse.json({ ok: true });
  response.cookies.set("tg_uid", "", { maxAge: 0, path: "/" });
  return response;
}
