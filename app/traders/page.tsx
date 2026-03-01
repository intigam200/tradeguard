"use client";

import { useState } from "react";
import Sidebar from "@/components/layout/Sidebar";

type Trader = {
  id: number;
  name: string;
  initials: string;
  role: "TRADER" | "SENIOR_TRADER" | "MANAGER";
  status: "ACTIVE" | "BLOCKED" | "INACTIVE";
  pnl: number;
  winRate: number;
  trades: number;
  deposit: number;
  joined: string;
  color: string;
};

const traders: Trader[] = [
  { id: 1, name: "Алек Мурадов",    initials: "АМ", role: "TRADER",        status: "BLOCKED",  pnl: -1240,  winRate: 42, trades: 7,  deposit: 46200, joined: "01.01.2026", color: "from-blue-500 to-purple-500"  },
  { id: 2, name: "Дмитрий Левин",   initials: "ДЛ", role: "SENIOR_TRADER", status: "BLOCKED",  pnl: -3200,  winRate: 38, trades: 12, deposit: 52000, joined: "15.12.2025", color: "from-orange-500 to-red-500"   },
  { id: 3, name: "Екатерина Нова",  initials: "ЕН", role: "TRADER",        status: "ACTIVE",   pnl: +4800,  winRate: 61, trades: 5,  deposit: 38500, joined: "10.01.2026", color: "from-emerald-500 to-teal-500" },
  { id: 4, name: "Игорь Попов",     initials: "ИП", role: "TRADER",        status: "ACTIVE",   pnl: +1200,  winRate: 55, trades: 8,  deposit: 41000, joined: "20.01.2026", color: "from-pink-500 to-rose-500"    },
  { id: 5, name: "Анна Смирнова",   initials: "АС", role: "SENIOR_TRADER", status: "ACTIVE",   pnl: +6700,  winRate: 68, trades: 6,  deposit: 75000, joined: "01.11.2025", color: "from-violet-500 to-purple-500"},
  { id: 6, name: "Роман Козлов",    initials: "РК", role: "TRADER",        status: "INACTIVE", pnl: 0,      winRate: 0,  trades: 0,  deposit: 25000, joined: "25.01.2026", color: "from-slate-500 to-slate-600"  },
];

const roleLabel = (r: string) => {
  if (r === "SENIOR_TRADER") return "Ст. трейдер";
  if (r === "MANAGER")       return "Менеджер";
  return "Трейдер";
};

const statusBadge = (s: string) => {
  if (s === "ACTIVE")   return "bg-emerald-500/15 text-emerald-400";
  if (s === "BLOCKED")  return "bg-red-500/15 text-red-400";
  return "bg-slate-500/15 text-slate-400";
};

const statusLabel = (s: string) => {
  if (s === "ACTIVE")   return "Активен";
  if (s === "BLOCKED")  return "Заблокирован";
  return "Неактивен";
};

export default function TradersPage() {
  const [view, setView] = useState<"grid" | "table">("grid");
  const [search, setSearch] = useState("");

  const filtered = traders.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex min-h-screen bg-[#0f1117] text-slate-200 font-[family-name:var(--font-geist-sans)]">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-white/5 px-6 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-sm font-semibold text-white">Трейдеры</h1>
            <p className="text-xs text-slate-500">Управление командой</p>
          </div>
          <button className="text-xs bg-emerald-500 hover:bg-emerald-400 text-black font-semibold px-4 py-1.5 rounded-lg transition-colors">
            + Добавить трейдера
          </button>
        </header>

        <main className="flex-1 overflow-auto p-6 space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "Всего трейдеров", value: traders.length.toString(),                                   icon: "👥" },
              { label: "Активных",        value: traders.filter(t => t.status === "ACTIVE").length.toString(), icon: "🟢", color: "text-emerald-400" },
              { label: "Заблокированных", value: traders.filter(t => t.status === "BLOCKED").length.toString(),icon: "🔴", color: "text-red-400" },
              { label: "Общий P&L",       value: (traders.reduce((s, t) => s + t.pnl, 0) >= 0 ? "+" : "") + "$" + Math.abs(traders.reduce((s, t) => s + t.pnl, 0)).toLocaleString(), icon: "💰", color: traders.reduce((s, t) => s + t.pnl, 0) >= 0 ? "text-emerald-400" : "text-red-400" },
            ].map(s => (
              <div key={s.label} className="bg-[#161b27] border border-white/5 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span>{s.icon}</span>
                  <p className="text-xs text-slate-500">{s.label}</p>
                </div>
                <p className={`text-2xl font-bold ${s.color ?? "text-white"}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Поиск трейдера..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-[#161b27] border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 w-52"
            />
            <div className="ml-auto flex gap-1">
              <button
                onClick={() => setView("grid")}
                className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${view === "grid" ? "bg-white/10 text-white border-white/20" : "text-slate-500 border-white/5 hover:text-slate-300"}`}
              >⊞ Карточки</button>
              <button
                onClick={() => setView("table")}
                className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${view === "table" ? "bg-white/10 text-white border-white/20" : "text-slate-500 border-white/5 hover:text-slate-300"}`}
              >☰ Таблица</button>
            </div>
          </div>

          {/* Grid view */}
          {view === "grid" && (
            <div className="grid grid-cols-3 gap-4">
              {filtered.map(t => (
                <div key={t.id} className="bg-[#161b27] border border-white/5 rounded-xl p-5 hover:border-white/10 transition-colors">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${t.color} flex items-center justify-center text-sm font-bold text-white`}>
                        {t.initials}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{t.name}</p>
                        <p className="text-xs text-slate-500">{roleLabel(t.role)}</p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${statusBadge(t.status)}`}>
                      {statusLabel(t.status)}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className={`text-base font-bold ${t.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {t.pnl >= 0 ? "+" : ""}${Math.abs(t.pnl).toLocaleString()}
                      </p>
                      <p className="text-[10px] text-slate-600 mt-0.5">P&L</p>
                    </div>
                    <div>
                      <p className={`text-base font-bold ${t.winRate >= 50 ? "text-emerald-400" : "text-red-400"}`}>
                        {t.winRate}%
                      </p>
                      <p className="text-[10px] text-slate-600 mt-0.5">Винрейт</p>
                    </div>
                    <div>
                      <p className="text-base font-bold text-white">{t.trades}</p>
                      <p className="text-[10px] text-slate-600 mt-0.5">Сделок</p>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                    <span className="text-[10px] text-slate-600">С {t.joined}</span>
                    <button className="text-xs text-slate-400 hover:text-white transition-colors">Подробнее →</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Table view */}
          {view === "table" && (
            <div className="bg-[#161b27] border border-white/5 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/5">
                    {["Трейдер", "Роль", "Статус", "P&L", "Винрейт", "Сделок", "Депозит", ""].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-slate-500 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t, i) => (
                    <tr key={t.id} className={`border-b border-white/5 hover:bg-white/[0.02] transition-colors ${i === filtered.length - 1 ? "border-0" : ""}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${t.color} flex items-center justify-center text-[10px] font-bold text-white`}>
                            {t.initials}
                          </div>
                          <span className="font-medium text-white">{t.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-400">{roleLabel(t.role)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${statusBadge(t.status)}`}>
                          {statusLabel(t.status)}
                        </span>
                      </td>
                      <td className={`px-4 py-3 font-semibold font-mono ${t.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {t.pnl >= 0 ? "+" : ""}${Math.abs(t.pnl).toLocaleString()}
                      </td>
                      <td className={`px-4 py-3 ${t.winRate >= 50 ? "text-emerald-400" : "text-red-400"}`}>{t.winRate}%</td>
                      <td className="px-4 py-3 text-slate-300">{t.trades}</td>
                      <td className="px-4 py-3 text-slate-300 font-mono">${t.deposit.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <button className="text-xs text-slate-400 hover:text-white transition-colors">Подробнее →</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
