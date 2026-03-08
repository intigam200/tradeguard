export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";

// In-memory for demo — swap for DB insert when ready
const waitlistEmails = new Set<string>();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = (body.email ?? "").toLowerCase().trim();

    if (!email || !email.includes("@") || !email.includes(".")) {
      return NextResponse.json({ ok: false, error: "Invalid email" }, { status: 400 });
    }

    const isNew = !waitlistEmails.has(email);
    waitlistEmails.add(email);

    console.log(`[Waitlist] ${isNew ? "New" : "Existing"}: ${email} (total: ${waitlistEmails.size})`);

    return NextResponse.json({ ok: true, isNew });
  } catch {
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
