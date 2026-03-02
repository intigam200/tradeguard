"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useLang } from "@/context/language";

interface NavItem { icon: string; href: string; en: string; ru: string; hasAlert?: boolean; }

const NAV: NavItem[] = [
  { icon: "◼",  href: "/dashboard", en: "Dashboard",  ru: "Дашборд"    },
  { icon: "📊", href: "/journal",   en: "Analytics",  ru: "Аналитика"  },
  { icon: "🛡", href: "/limits",    en: "Limits",     ru: "Лимиты"     },
  { icon: "⚠",  href: "/breaches", en: "Violations", ru: "Нарушения",  hasAlert: true },
  { icon: "🔗", href: "/connect",   en: "Connect",    ru: "Подключить" },
  { icon: "⚙",  href: "/settings", en: "Settings",   ru: "Настройки"  },
];

export default function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const router   = useRouter();
  const { lang } = useLang();

  const [email,   setEmail]   = useState("");
  const [unacked, setUnacked] = useState(0);

  useEffect(() => {
    fetch("/api/me")
      .then(r => r.json())
      .then(d => {
        if (d.ok) {
          setEmail(d.user?.email ?? "");
          setUnacked(d.unacknowledgedCount ?? 0);
        }
      })
      .catch(() => {});
  }, [pathname]);

  const handleSignOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  const initials = email ? email[0].toUpperCase() : "?";

  return (
    <aside className="w-60 shrink-0 bg-[#161b27] border-r border-white/5 flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-white/5">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-sm font-bold text-black shrink-0">
            TG
          </div>
          <span className="font-semibold text-white">TradeGuard</span>
        </Link>
        <p className="text-xs text-slate-500 mt-1 ml-10">
          {lang === "en" ? "Trade Discipline" : "Контроль дисциплины"}
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV.map((n) => {
          const isActive = pathname === n.href || (n.href !== "/dashboard" && pathname.startsWith(n.href));
          return (
            <Link
              key={n.href}
              href={n.href}
              onClick={onClose}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-emerald-500/10 text-emerald-400 font-medium"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              }`}
            >
              <span className="text-base">{n.icon}</span>
              {lang === "en" ? n.en : n.ru}
              {n.hasAlert && unacked > 0 && (
                <span className="ml-auto w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-blue-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-white truncate">{email || "—"}</p>
            <button
              onClick={handleSignOut}
              className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
            >
              {lang === "en" ? "Sign out" : "Выйти"}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
