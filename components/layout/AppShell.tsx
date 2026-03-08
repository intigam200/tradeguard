"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import { AppHeader } from "./AppHeader";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const router = useRouter();

  // Step 1: ensure tg_uid cookie is set FIRST, then start everything else.
  // All other effects wait for `ready` so they never fire before the cookie exists.
  useEffect(() => {
    fetch("/api/setup")
      .then(r => r.json())
      .then((d: { ok: boolean }) => {
        if (d.ok) setReady(true);
      })
      .catch(() => setReady(true)); // allow render even if setup fails (cookie may already exist)
  }, []);

  // Start WebSocket monitoring — runs only after cookie is confirmed
  useEffect(() => {
    if (!ready) return;
    fetch("/api/monitor/start", { method: "POST" })
      .then(r => r.json())
      .then((d: { ok: boolean; message?: string }) => {
        if (d.ok) console.log("[Monitor]", d.message);
      })
      .catch(() => {});
  }, [ready]);

  // Client-side monitoring poll — check limits every 60 seconds
  useEffect(() => {
    if (!ready) return;
    const poll = async () => {
      try {
        const res  = await fetch("/api/sync", { method: "POST" });
        const data = await res.json() as { results?: { isBlocked?: boolean }[] };
        const anyBlocked = data.results?.some(r => r.isBlocked);
        if (anyBlocked) router.refresh();
      } catch { /* ignore network errors */ }
    };
    const id = setInterval(poll, 60_000);
    return () => clearInterval(id);
  }, [ready, router]);

  // Show spinner until setup cookie is confirmed
  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f1117]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-600">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#0f1117] text-slate-200 font-[family-name:var(--font-geist-sans)]">
      {/* Desktop sidebar */}
      <div className="hidden md:flex h-screen sticky top-0 shrink-0">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-60 shadow-2xl slide-in-left">
            <Sidebar onClose={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar (hamburger only) */}
        <div className="md:hidden flex items-center h-12 px-4 border-b border-white/5 bg-[#0f1117] sticky top-0 z-30 shrink-0 gap-3">
          <button
            onClick={() => setMobileOpen(true)}
            className="text-slate-400 hover:text-white text-xl leading-none"
            aria-label="Open menu"
          >
            ☰
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-emerald-500 flex items-center justify-center text-[10px] font-bold text-black">
              TM
            </div>
            <span className="font-semibold text-white text-sm">TradeMarco</span>
          </div>
        </div>

        {/* Global header — visible on every page */}
        <AppHeader />

        {children}
      </div>
    </div>
  );
}
