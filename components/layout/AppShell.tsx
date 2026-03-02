"use client";

import { useState } from "react";
import Sidebar from "./Sidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

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
        {/* Mobile top bar */}
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
              TG
            </div>
            <span className="font-semibold text-white text-sm">TradeGuard</span>
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}
