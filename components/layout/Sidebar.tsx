"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { icon: "◼",  label: "Дашборд",    href: "/dashboard" },
  { icon: "📊", label: "Analytics",   href: "/journal"   },
  { icon: "🛡", label: "Лимиты",     href: "/limits"    },
  { icon: "⚠",  label: "Нарушения",  href: "/breaches", badge: 2 },
  { icon: "🔗", label: "Подключить", href: "/connect"   },
  { icon: "⚙",  label: "Настройки",  href: "/settings"  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 shrink-0 bg-[#161b27] border-r border-white/5 flex flex-col">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-sm font-bold text-black">
            TG
          </div>
          <span className="font-semibold text-white">TradeGuard</span>
        </div>
        <p className="text-xs text-slate-500 mt-1">Контроль дисциплины</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((n) => {
          const isActive = pathname === n.href || (n.href !== "/dashboard" && pathname.startsWith(n.href));
          return (
            <Link
              key={n.label}
              href={n.href}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-emerald-500/10 text-emerald-400 font-medium"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              }`}
            >
              <span className="text-base">{n.icon}</span>
              {n.label}
              {n.badge && (
                <span className="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {n.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-xs font-bold text-white">
            АМ
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">Алек Мурадов</p>
            <p className="text-xs text-slate-500">TRADER</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
