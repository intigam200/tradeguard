"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

/* ─── Custom keyframes ───────────────────────────────────────────────────────── */
const GLOBAL_CSS = `
@keyframes pulse-red {
  0%,100% { border-color: #c0392b; box-shadow: 0 0 0 0 rgba(192,57,43,0); }
  50%      { border-color: #ff6b6b; box-shadow: 0 0 10px 2px rgba(192,57,43,0.3); }
}
@keyframes blink-cursor {
  0%,100% { opacity: 1; } 50% { opacity: 0; }
}
.pulse-red    { animation: pulse-red 1.8s ease-in-out infinite; }
.blink-cursor { animation: blink-cursor 1s step-start infinite; }
.step-hidden  { opacity:0; transform:translateY(20px);
                transition:opacity .5s ease, transform .5s ease; }
.step-visible { opacity:1; transform:translateY(0); }
`;

// ─── Logo: two angled rounded bars (approximation of provided mark) ───────────
function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      {/* Top bar */}
      <rect x="4" y="14" width="62" height="24" rx="12" fill="white"
            transform="rotate(-20 35 26)" />
      {/* Bottom bar */}
      <rect x="34" y="56" width="62" height="24" rx="12" fill="white"
            transform="rotate(-20 65 68)" />
      {/* Eye notch */}
      <ellipse cx="49" cy="50" rx="6" ry="4" fill="black"
               transform="rotate(-20 49 50)" />
    </svg>
  );
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-[#1f1f1f]">
      <button
        onClick={() => setOpen(!open)}
        className="w-full py-5 flex items-center justify-between gap-4 text-left"
      >
        <span className="text-sm font-semibold text-[#f0f0f0]">{q}</span>
        <span
          className="text-[#6b6b6b] text-lg shrink-0 font-mono transition-transform duration-200"
          style={{ transform: open ? "rotate(45deg)" : "none" }}
        >
          +
        </span>
      </button>
      {open && <p className="pb-5 text-sm text-[#6b6b6b] leading-relaxed">{a}</p>}
    </div>
  );
}

// ─── VE1: Live Loss Counter ───────────────────────────────────────────────────
function LossCounter() {
  const [loss, setLoss] = useState(0);

  useEffect(() => {
    setLoss(Math.floor(Math.random() * 300_000) + 900_000);
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const delay = 1500 + Math.random() * 1500;
      timer = setTimeout(() => {
        setLoss(v => v + Math.floor(Math.random() * 150) + 50);
        tick();
      }, delay);
    };
    tick();
    return () => clearTimeout(timer);
  }, []);

  const fmt = (n: number) => new Intl.NumberFormat("en-US").format(n);

  return (
    <div className="mt-12 mb-4 flex flex-col items-center gap-3">
      <div className="flex items-center gap-3">
        <span className="w-2.5 h-2.5 rounded-full bg-[#c0392b] animate-pulse shrink-0" />
        <span className="font-mono text-4xl md:text-5xl font-bold text-[#c0392b] tabular-nums">
          -${fmt(loss)}
        </span>
      </div>
      <p className="font-mono text-[11px] text-[#6b6b6b] tracking-wide">
        lost by traders ignoring their rules — today
      </p>
    </div>
  );
}

// ─── VE2: P&L Chart ───────────────────────────────────────────────────────────
function PnLChart() {
  const W = 800, H = 280;
  const pL = 64, pR = 24, pT = 30, pB = 36;
  const cw = W - pL - pR;   // 712
  const ch = H - pT - pB;   // 214

  const yMin = -1000, yMax = 700, yRange = yMax - yMin; // 1700

  const toY = (v: number) => pT + (yMax - v) / yRange * ch;
  const toX = (i: number) => pL + (i / 4) * cw;

  // Main path data (Mon→Fri without TradeMarco)
  const vals   = [400, 550, -200, -650, -800];
  const pts    = vals.map((v, i) => ({ x: toX(i), y: toY(v) }));

  // Alternative path after block (with TradeMarco, from Wed onwards)
  const recov  = [-200, -80, -20];
  const rPts   = recov.map((v, i) => ({ x: toX(i + 2), y: toY(v) }));

  const y0     = toY(0);
  const yLim   = toY(-200);
  const xBlk   = pts[2].x; // block triggers at Wed

  // Zero-crossing between Tue and Wed
  const t0     = 550 / (550 + 200);
  const xCr0   = pts[1].x + t0 * (pts[2].x - pts[1].x);

  // Smooth cubic bezier path through points
  const smooth = (ps: { x: number; y: number }[]) =>
    ps.reduce((acc, p, i) => {
      if (i === 0) return `M ${p.x},${p.y}`;
      const prev = ps[i - 1];
      const cx   = (prev.x + p.x) / 2;
      return acc + ` C ${cx},${prev.y} ${cx},${p.y} ${p.x},${p.y}`;
    }, "");

  const mainPath    = smooth(pts.slice(0, 3));          // Mon→Tue→Wed
  const withoutPath = smooth(pts.slice(2));             // Wed→Thu→Fri (dashed red)
  const recovPath   = smooth(rPts);                     // Wed→Thu→Fri (green)

  // Green fill: above zero line, Mon → zeroCrossing
  const cx01 = (pts[0].x + pts[1].x) / 2;
  const cx12 = (pts[1].x + pts[2].x) / 2;
  const greenFill =
    `M ${pts[0].x},${y0}` +
    ` L ${pts[0].x},${pts[0].y}` +
    ` C ${cx01},${pts[0].y} ${cx01},${pts[1].y} ${pts[1].x},${pts[1].y}` +
    ` C ${cx12},${pts[1].y} ${cx12},${pts[2].y} ${xCr0},${y0} Z`;

  // Red fill: below limit, Wed→Thu→Fri then back along yLim
  const cx23 = (pts[2].x + pts[3].x) / 2;
  const cx34 = (pts[3].x + pts[4].x) / 2;
  const redFill =
    `M ${xBlk},${yLim}` +
    ` C ${cx23},${yLim} ${cx23},${pts[3].y} ${pts[3].x},${pts[3].y}` +
    ` C ${cx34},${pts[3].y} ${cx34},${pts[4].y} ${pts[4].x},${pts[4].y}` +
    ` L ${pts[4].x},${yLim} Z`;

  const days   = ["MON", "TUE", "WED", "THU", "FRI"];
  const yTicks = [500, 200, 0, -200, -500, -800];

  return (
    <div className="w-full overflow-x-auto -mx-1">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        preserveAspectRatio="xMidYMid meet"
        style={{ maxHeight: 280 }}
      >
        {/* Fills */}
        <path d={greenFill} fill="#16a34a" fillOpacity="0.12" />
        <path d={redFill}   fill="#c0392b" fillOpacity="0.15" />

        {/* Zero line */}
        <line x1={pL} y1={y0} x2={W - pR} y2={y0}
              stroke="#333" strokeWidth="1" />
        <text x={pL - 4} y={y0 + 4} fill="#555" fontSize="9"
              fontFamily="monospace" textAnchor="end">0</text>

        {/* Loss-limit dashed line */}
        <line x1={pL} y1={yLim} x2={W - pR} y2={yLim}
              stroke="#c0392b" strokeWidth="1" strokeDasharray="5 4" />
        <text x={pL + 4} y={yLim - 5} fill="#c0392b" fontSize="9"
              fontFamily="monospace">-$200 limit</text>

        {/* Main line Mon→Wed */}
        <path d={mainPath} fill="none" stroke="#e8e8e8" strokeWidth="2.5" />

        {/* Without-TradeMarco continuation (dashed red) */}
        <path d={withoutPath} fill="none" stroke="#c0392b" strokeWidth="1.5"
              strokeDasharray="5 3" opacity="0.55" />

        {/* With-TradeMarco recovery (green) */}
        <path d={recovPath} fill="none" stroke="#16a34a" strokeWidth="2" />

        {/* Block trigger vertical */}
        <line x1={xBlk} y1={pT} x2={xBlk} y2={H - pB}
              stroke="#e8e8e8" strokeWidth="1" strokeDasharray="4 3" opacity="0.3" />
        <text x={xBlk + 5} y={pT + 14} fill="#e8e8e8" fontSize="9"
              fontFamily="monospace" opacity="0.65">Block triggered</text>

        {/* +$180 saved label */}
        <text x={rPts[2].x + 6} y={rPts[2].y + 4} fill="#16a34a"
              fontSize="10" fontFamily="monospace">↑ +$180 saved</text>

        {/* X-axis day labels */}
        {days.map((d, i) => (
          <text key={d} x={toX(i)} y={H - 6} fill="#6b6b6b" fontSize="10"
                fontFamily="monospace" textAnchor="middle">{d}</text>
        ))}

        {/* Y-axis ticks */}
        {yTicks.map(v => (
          <text key={v} x={pL - 5} y={toY(v) + 3} fill="#444" fontSize="9"
                fontFamily="monospace" textAnchor="end">
            {v > 0 ? `+${v}` : v}
          </text>
        ))}

        {/* Key data-point dots */}
        {pts.slice(0, 3).map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3.5"
                  fill={i < 2 ? "#e8e8e8" : "#c0392b"} />
        ))}
        <circle cx={rPts[2].x} cy={rPts[2].y} r="3.5" fill="#16a34a" />
      </svg>
    </div>
  );
}

// ─── VE3: Dashboard mock ──────────────────────────────────────────────────────
function DashboardMock() {
  const [secs,     setSecs]     = useState(4 * 3600 + 32 * 60 + 17);
  const [syncSecs, setSyncSecs] = useState(47);

  useEffect(() => {
    const iv = setInterval(() => {
      setSecs(v     => Math.max(0, v - 1));
      setSyncSecs(v => v > 0 ? v - 1 : 120);
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  const fmt = (s: number) => {
    const h  = Math.floor(s / 3600).toString().padStart(2, "0");
    const m  = Math.floor((s % 3600) / 60).toString().padStart(2, "0");
    const ss = (s % 60).toString().padStart(2, "0");
    return `${h}:${m}:${ss}`;
  };

  const bars = [
    { label: "Daily limit",  val: "$200", pct: 60 },
    { label: "Weekly limit", val: "$800", pct: 40 },
    { label: "Trades today", val: "4/6",  pct: 67 },
    { label: "Loss streak",  val: "1",    pct: 20 },
  ];

  const trades = [
    { sym: "BTC/USDT", dir: "LONG",  pnl: "+$124", warn: false },
    { sym: "ETH/USDT", dir: "SHORT", pnl: "-$89",  warn: false },
    { sym: "BTC/USDT", dir: "LONG",  pnl: "-$156", warn: true  },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Browser chrome */}
      <div className="border border-[#2a2a2a] rounded-lg overflow-hidden bg-[#0d0d0d]">

        {/* Title bar */}
        <div className="flex items-center gap-3 px-4 py-3 bg-[#111] border-b border-[#1f1f1f]">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#c0392b]" />
            <div className="w-3 h-3 rounded-full bg-[#e8a020]" />
            <div className="w-3 h-3 rounded-full bg-[#16a34a]" />
          </div>
          <div className="flex-1 bg-[#1a1a1a] rounded-sm px-3 py-1.5 mx-4">
            <span className="font-mono text-[11px] text-[#555]">
              app.trademarco.com/dashboard
            </span>
          </div>
        </div>

        {/* Dashboard body */}
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#1f1f1f]">

          {/* Left: Account status */}
          <div className="p-6">
            <p className="font-mono text-[10px] text-[#6b6b6b] tracking-widest mb-4">
              ACCOUNT STATUS
            </p>
            <div className="flex items-center gap-2 mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a] animate-pulse" />
              <span className="font-mono text-xs text-[#f0f0f0]">BYBIT FUTURES</span>
              <span className="ml-auto font-mono text-[10px] border border-[#16a34a]/40 text-[#16a34a] px-1.5 py-0.5">
                ACTIVE
              </span>
            </div>

            <div className="space-y-4 mb-5">
              {bars.map(b => (
                <div key={b.label}>
                  <div className="flex justify-between font-mono text-[10px] mb-1.5">
                    <span className="text-[#6b6b6b]">{b.label}</span>
                    <span className="text-[#f0f0f0]">{b.val}</span>
                  </div>
                  <div className="h-1 bg-[#1a1a1a] overflow-hidden">
                    <div
                      className="h-full transition-all"
                      style={{
                        width: `${b.pct}%`,
                        background: b.pct >= 80 ? "#c0392b" : b.pct >= 60 ? "#e8a020" : "#e8e8e8",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between font-mono text-[10px] text-[#6b6b6b]">
              <span>Status: <span className="text-[#16a34a]">MONITORING</span></span>
              <span>Next sync: 0:{syncSecs.toString().padStart(2, "0")}</span>
            </div>
          </div>

          {/* Right: Recent trades */}
          <div className="p-6">
            <p className="font-mono text-[10px] text-[#6b6b6b] tracking-widest mb-4">
              RECENT TRADES
            </p>
            <div className="space-y-2.5">
              {trades.map((tr, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between p-2.5 border ${
                    tr.warn ? "border-[#c0392b]/40 bg-[#c0392b]/5" : "border-[#1f1f1f]"
                  }`}
                >
                  <div>
                    <p className="font-mono text-[11px] text-[#f0f0f0]">
                      {tr.sym}{" "}
                      <span className="text-[#6b6b6b]">{tr.dir}</span>
                    </p>
                    {tr.warn && (
                      <p className="font-mono text-[9px] text-[#c0392b] mt-0.5">
                        ⚠ near limit
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-mono text-xs font-bold ${
                        tr.pnl.startsWith("+") ? "text-[#16a34a]" : "text-[#c0392b]"
                      }`}
                    >
                      {tr.pnl}
                    </span>
                    <span className="text-[#444] text-xs">{tr.warn ? "⚠" : "✓"}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Block banner */}
        <div className="bg-[#c0392b]/10 border-t border-[#c0392b]/30 px-6 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <p className="font-mono text-[11px] text-[#c0392b]">
            🚨 BLOCK ACTIVE — Daily loss limit reached. New positions disabled.
          </p>
          <span className="font-mono text-sm font-bold text-[#c0392b] tabular-nums shrink-0">
            Resets in {fmt(secs)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── VE4: Animated How It Works ───────────────────────────────────────────────
const HOW_STEPS = [
  {
    n: "01",
    pulse: false,
    title: "Connect your exchange",
    text: "Add your Bybit or Binance Futures account with read + close-only API key. We cannot open trades or touch your funds.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
      </svg>
    ),
  },
  {
    n: "02",
    pulse: false,
    title: "Define your rules",
    text: "Max daily loss. Max weekly loss. Trade count. Loss streak. Block duration: 1h to 24h. Your rules, your parameters.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
      </svg>
    ),
  },
  {
    n: "03",
    pulse: true,
    title: "TradeMarco enforces them",
    text: "When a limit is breached, all new positions are blocked. You get a Telegram alert. The block lifts automatically — or you request early removal through support.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
      </svg>
    ),
  },
] as const;

function AnimatedHowItWorks() {
  const [vis, setVis] = useState([false, false, false]);
  const ref0 = useRef<HTMLDivElement>(null);
  const ref1 = useRef<HTMLDivElement>(null);
  const ref2 = useRef<HTMLDivElement>(null);
  const refs = [ref0, ref1, ref2];

  useEffect(() => {
    const observers = refs.map((ref, i) => {
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setTimeout(
              () => setVis(v => { const n = [...v]; n[i] = true; return n; }),
              i * 200
            );
          }
        },
        { threshold: 0.2 }
      );
      if (ref.current) obs.observe(ref.current);
      return obs;
    });
    return () => observers.forEach(o => o.disconnect());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#1f1f1f]">
      {HOW_STEPS.map((s, i) => {
        const ref = refs[i];
        return (
          <div
            key={s.n}
            ref={ref}
            className={[
              "p-6 md:p-8 flex flex-col gap-4 step-hidden",
              vis[i] ? "step-visible" : "",
              s.pulse ? "pulse-red border border-transparent" : "",
            ].join(" ")}
          >
            <div
              className={`w-10 h-10 border flex items-center justify-center text-[#f0f0f0] shrink-0 ${
                s.pulse ? "border-[#c0392b]" : "border-[#2a2a2a]"
              }`}
            >
              {s.icon}
            </div>
            <div>
              <p className="font-mono text-[10px] text-[#6b6b6b] mb-2">{s.n}</p>
              <p className="font-semibold text-[#f0f0f0] text-sm mb-2">{s.title}</p>
              <p className="text-sm text-[#6b6b6b] leading-relaxed">{s.text}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── VE5: Video placeholder ───────────────────────────────────────────────────
function VideoSection() {
  return (
    <section className="py-24 border-t border-[#1f1f1f]">
      <div className="max-w-4xl mx-auto px-6">
        <p className="font-mono text-xs text-[#6b6b6b] mb-4">WALKTHROUGH</p>
        <h2 className="text-3xl font-bold tracking-tight text-white mb-10">
          See it in action
        </h2>
        <div
          className="relative aspect-video bg-[#111] border border-[#2a2a2a]
                     flex items-center justify-center cursor-pointer group
                     hover:border-[#404040] transition-colors"
        >
          {/* Play button */}
          <div
            className="w-16 h-16 rounded-full border-2 border-white flex items-center justify-center
                       group-hover:bg-white group-hover:border-white transition-all duration-200"
          >
            <svg
              width="20" height="20" viewBox="0 0 24 24"
              className="fill-white group-hover:fill-black ml-1 transition-colors duration-200"
            >
              <path d="M8 5.14v14l11-7-11-7z" />
            </svg>
          </div>
          {/* Bottom-left label */}
          <div className="absolute bottom-6 left-6">
            <p className="font-mono text-xs text-[#6b6b6b]">COMING SOON</p>
            <p className="text-white text-sm mt-1">
              Full product walkthrough — setup to first block
            </p>
          </div>
          {/* Duration */}
          <div className="absolute bottom-6 right-6 font-mono text-xs text-[#6b6b6b]">
            ~4:00
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── VE6: Soft Block Analysis (typewriter on scroll) ─────────────────────────
const SB_LINES: { text: string; color: string; delay: number }[] = [
  { text: "  Your trade:",                                          color: "#6b6b6b", delay: 0    },
  { text: '  "BTC long, $500 size, no clear setup,',               color: "#f0f0f0", delay: 320  },
  { text: "   just feels like it's going up\"",                    color: "#f0f0f0", delay: 640  },
  { text: "  ─────────────────────────────────────",               color: "#2a2a2a", delay: 960  },
  { text: "  Analysis:",                                            color: "#6b6b6b", delay: 1150 },
  { text: "  ⚠ FOMO detected — no technical basis described",      color: "#e8a020", delay: 1450 },
  { text: "  ⚠ Size 2.5× your average — elevated risk",           color: "#e8a020", delay: 1950 },
  { text: "  ⚠ Last 3 trades: -$89, -$156, -$43 — loss streak",   color: "#c0392b", delay: 2500 },
  { text: "  ─────────────────────────────────────",               color: "#2a2a2a", delay: 2800 },
  { text: "  Verdict:  ████ SKIP THIS TRADE",                      color: "#c0392b", delay: 3100 },
  { text: "  \"You're trading emotion, not setup.\"",              color: "#6b6b6b", delay: 3700 },
];

function SoftBlockChat() {
  const ref       = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);
  const [shown,   setShown]   = useState<boolean[]>(Array(SB_LINES.length).fill(false));

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStarted(true); },
      { threshold: 0.3 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;
    const timers = SB_LINES.map((line, i) =>
      setTimeout(
        () => setShown(v => { const n = [...v]; n[i] = true; return n; }),
        line.delay
      )
    );
    return () => timers.forEach(clearTimeout);
  }, [started]);

  const allShown = shown.every(Boolean);

  return (
    <div
      ref={ref}
      className="w-full max-w-lg border border-[#2a2a2a] bg-[#0d0d0d] font-mono text-xs"
    >
      {/* Terminal header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1f1f1f] bg-[#111]">
        <span className="text-[10px] text-[#6b6b6b] tracking-widest">
          SOFT BLOCK ANALYSIS
        </span>
        <span className="text-[10px] border border-[#2a2a2a] text-[#f0f0f0] px-2 py-0.5">
          AI
        </span>
      </div>
      {/* Lines */}
      <div className="p-5 space-y-1.5 min-h-[260px]">
        {SB_LINES.map((line, i) => (
          <div
            key={i}
            className="whitespace-pre transition-opacity duration-200"
            style={{
              opacity: shown[i] ? 1 : 0,
              color:   line.color,
            }}
          >
            {line.text}
          </div>
        ))}
        {started && !allShown && (
          <span className="blink-cursor text-[#6b6b6b] inline-block">█</span>
        )}
      </div>
    </div>
  );
}

// ─── VE7: Reports Teaser with blurred mock ────────────────────────────────────
function ReportsTeaser() {
  const [email, setEmail] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const s = typeof window !== "undefined" ? localStorage.getItem("tm_notify_email") : null;
    if (s) { setEmail(s); setSaved(true); }
  }, []);

  const handleNotify = () => {
    if (!email.trim()) return;
    localStorage.setItem("tm_notify_email", email.trim());
    setSaved(true);
  };

  const tableRows = [
    ["May W1", "+$843",   "68%", "22"],
    ["May W2", "-$412",   "41%", "18"],
    ["May W3", "+$1,204", "72%", "25"],
    ["May W4", "-$889",   "38%", "31"],
    ["Jun W1", "+$320",   "55%", "14"],
  ];

  return (
    <section className="py-20 px-6 bg-[#111]">
      <div className="max-w-3xl mx-auto">
        <div className="inline-block font-mono text-[9px] tracking-widest border border-[#2a2a2a] text-[#6b6b6b] px-2 py-0.5 mb-6">
          COMING SOON
        </div>
        <h2 className="text-2xl md:text-3xl font-black tracking-tighter text-[#f0f0f0] mb-4">
          Your trading has patterns.<br />Most of them are costing you.
        </h2>
        <p className="text-sm text-[#6b6b6b] leading-relaxed mb-10 max-w-lg">
          Full performance reports — loss distribution by time of day, weekday, asset, trade sequence. See exactly where your discipline breaks down.
        </p>

        {/* Blurred mock table */}
        <div className="relative border border-[#1f1f1f] overflow-hidden mb-10">
          <div className="pointer-events-none select-none" style={{ filter: "blur(5px)" }}>
            <div className="bg-[#0d0d0d] p-5 font-mono text-[11px]">
              <div className="grid grid-cols-4 gap-4 text-[#6b6b6b] border-b border-[#1f1f1f] pb-2 mb-3">
                <span>WEEK</span>
                <span className="text-right">P&amp;L</span>
                <span className="text-right">WIN%</span>
                <span className="text-right">TRADES</span>
              </div>
              {tableRows.map(([w, p, wr, t]) => (
                <div key={w} className="grid grid-cols-4 gap-4 py-2 border-b border-[#1a1a1a]">
                  <span className="text-[#f0f0f0]">{w}</span>
                  <span className={`text-right ${p.startsWith("+") ? "text-[#16a34a]" : "text-[#c0392b]"}`}>{p}</span>
                  <span className="text-right text-[#f0f0f0]">{wr}</span>
                  <span className="text-right text-[#f0f0f0]">{t}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-[#111]/60">
            <span className="font-mono text-xs border border-[#2a2a2a] bg-[#0a0a0a] text-[#f0f0f0] px-4 py-2.5 tracking-widest">
              REPORTS — COMING SOON Q3 2026
            </span>
          </div>
        </div>

        {/* Email subscribe */}
        {saved ? (
          <p className="font-mono text-xs text-[#16a34a]">
            ✓ You&apos;ll be notified when reports launch.
          </p>
        ) : (
          <div>
            <p className="font-mono text-[11px] text-[#6b6b6b] mb-3">
              Be the first to know
            </p>
            <div className="flex gap-2 max-w-sm">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleNotify()}
                placeholder="your@email.com"
                className="flex-1 bg-[#0d0d0d] border border-[#2a2a2a] px-3 py-2 text-xs font-mono
                           text-[#f0f0f0] placeholder-[#444] focus:outline-none focus:border-[#404040]"
              />
              <button
                onClick={handleNotify}
                className="px-4 py-2 text-xs font-mono font-semibold bg-[#f0f0f0] text-black
                           hover:bg-white transition-colors"
              >
                Notify me
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <div
        className="min-h-screen bg-[#0a0a0a] text-[#f0f0f0] overflow-x-hidden"
        style={{ fontFamily: "'Inter', sans-serif" }}
      >

        {/* ══════════ NAVBAR ══════════ */}
        <header className="fixed top-0 inset-x-0 z-50 bg-[#0a0a0a]/95 backdrop-blur border-b border-[#1f1f1f]">
          <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <LogoMark size={26} />
              <span className="font-mono font-bold text-[#f0f0f0] tracking-tight text-sm">
                TRADEMARCO
              </span>
            </div>
            <nav className="hidden md:flex items-center gap-8">
              <a href="#how-it-works" className="text-xs text-[#6b6b6b] hover:text-[#f0f0f0] transition-colors font-mono tracking-wide">How it works</a>
              <a href="#pricing"      className="text-xs text-[#6b6b6b] hover:text-[#f0f0f0] transition-colors font-mono tracking-wide">Pricing</a>
              <a href="#faq"          className="text-xs text-[#6b6b6b] hover:text-[#f0f0f0] transition-colors font-mono tracking-wide">FAQ</a>
            </nav>
            <div className="hidden md:flex">
              <Link href="/login" className="text-xs font-semibold bg-[#f0f0f0] text-black px-4 py-2 rounded-sm hover:bg-white transition-colors">
                Get started →
              </Link>
            </div>
            <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden text-[#6b6b6b] hover:text-[#f0f0f0] font-mono text-sm">
              {menuOpen ? "✕" : "☰"}
            </button>
          </div>
          {menuOpen && (
            <div className="md:hidden bg-[#0a0a0a] border-t border-[#1f1f1f] px-6 py-4 space-y-4">
              <a href="#how-it-works" onClick={() => setMenuOpen(false)} className="block text-xs font-mono text-[#6b6b6b] py-2">How it works</a>
              <a href="#pricing"      onClick={() => setMenuOpen(false)} className="block text-xs font-mono text-[#6b6b6b] py-2">Pricing</a>
              <a href="#faq"          onClick={() => setMenuOpen(false)} className="block text-xs font-mono text-[#6b6b6b] py-2">FAQ</a>
              <Link href="/login" className="block w-full text-center text-xs font-semibold bg-[#f0f0f0] text-black px-4 py-2.5 rounded-sm">
                Get started →
              </Link>
            </div>
          )}
        </header>

        {/* ══════════ HERO ══════════ */}
        <section className="min-h-screen flex flex-col justify-center items-center px-6 pt-14">
          <div className="max-w-3xl w-full mx-auto text-center">
            <p className="font-mono text-[10px] text-[#6b6b6b] tracking-widest uppercase mb-10">
              TRADEMARCO — TRADING DISCIPLINE SYSTEM
            </p>
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-[#f0f0f0] leading-[1.02] mb-6">
              You know the rules.<br />
              You break them anyway.
            </h1>
            <p className="text-base md:text-lg text-[#6b6b6b] max-w-xl mx-auto mt-4 leading-relaxed">
              TradeMarco automatically blocks your trading when you exceed loss limits — so emotions don&apos;t destroy what strategy built.
            </p>

            {/* VE1: live loss counter */}
            <LossCounter />

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/login" className="font-semibold bg-[#f0f0f0] text-black text-sm px-6 py-2.5 rounded-sm hover:bg-white transition-colors">
                Start protecting capital →
              </Link>
              <a href="#how-it-works" className="text-sm border border-[#2a2a2a] text-[#f0f0f0] px-6 py-2.5 rounded-sm hover:border-[#404040] transition-colors font-mono">
                See how it works
              </a>
            </div>

            <div className="mt-12 pt-8 border-t border-[#1f1f1f] grid grid-cols-1 sm:grid-cols-3 gap-8">
              {[
                { val: "23%",    sub: "avg additional loss from\nrevenge trading" },
                { val: "67%",    sub: "of blown accounts trace back\nto 3 emotional trades" },
                { val: "< 3 min", sub: "to connect and activate\nyour first block" },
              ].map(s => (
                <div key={s.val} className="text-center">
                  <p className="font-mono text-2xl font-bold text-[#f0f0f0]">{s.val}</p>
                  <p className="font-mono text-[11px] text-[#6b6b6b] mt-1.5 leading-snug whitespace-pre-line">{s.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════ PAIN POINTS ══════════ */}
        <section className="py-24 px-6 bg-[#0a0a0a]">
          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: "REVENGE TRADING",      stat: "-$2,400",      text: "One bad trade turns into five. You know this pattern. It keeps happening anyway." },
              { label: "FOMO ENTRIES",          stat: "3.2× more",    text: "Late entries after missing a move. Wider stops, worse R:R, predictable outcome." },
              { label: "DAILY LIMIT IGNORED",   stat: "67% of blowups", text: "You had a rule. $200 max loss per day. You overrode it 'just this once.'" },
            ].map(c => (
              <div key={c.label} className="bg-[#111] border-l-2 border-[#c0392b] pl-5 py-5 pr-4">
                <p className="font-mono text-[10px] text-[#6b6b6b] tracking-widest uppercase mb-3">{c.label}</p>
                <p className="font-mono text-2xl font-bold text-[#c0392b] mb-3">{c.stat}</p>
                <p className="text-sm text-[#6b6b6b] leading-relaxed">{c.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ══════════ VE2: P&L CHART ══════════ */}
        <section className="py-16 px-6 bg-[#0a0a0a] border-t border-[#1f1f1f]">
          <div className="max-w-5xl mx-auto">
            <p className="font-mono text-[10px] text-[#6b6b6b] tracking-widest uppercase mb-2">
              WHAT HAPPENS WITHOUT CONTROL
            </p>
            <h2 className="text-2xl font-black tracking-tighter text-[#f0f0f0] mb-8">
              A typical revenge-trading week — and what TradeMarco changes.
            </h2>
            <PnLChart />
            <div className="mt-5 flex flex-wrap gap-6 font-mono text-[10px] text-[#6b6b6b]">
              <span className="flex items-center gap-2">
                <span className="inline-block w-6 border-t-2 border-[#e8e8e8]" /> actual path
              </span>
              <span className="flex items-center gap-2">
                <span className="inline-block w-6 border-t border-[#c0392b] border-dashed" /> without TradeMarco
              </span>
              <span className="flex items-center gap-2">
                <span className="inline-block w-6 border-t-2 border-[#16a34a]" /> with TradeMarco
              </span>
            </div>
          </div>
        </section>

        {/* ══════════ VE3: DASHBOARD MOCK ══════════ */}
        <section className="py-20 px-6 bg-[#0a0a0a] border-t border-[#1f1f1f]">
          <div className="max-w-5xl mx-auto">
            <p className="font-mono text-[10px] text-[#6b6b6b] tracking-widest uppercase mb-4">
              LIVE MONITOR
            </p>
            <h2 className="text-2xl font-black tracking-tighter text-[#f0f0f0] mb-10">
              Real-time visibility into every limit.
            </h2>
            <DashboardMock />
          </div>
        </section>

        {/* ══════════ VE4: HOW IT WORKS ══════════ */}
        <section id="how-it-works" className="py-24 px-6 bg-[#0a0a0a] border-t border-[#1f1f1f]">
          <div className="max-w-5xl mx-auto">
            <p className="font-mono text-[10px] text-[#6b6b6b] tracking-widest uppercase mb-4">
              HOW IT WORKS
            </p>
            <h2 className="text-3xl md:text-4xl font-black tracking-tighter text-[#f0f0f0] mb-14">
              Set limits once.<br />The system enforces them.
            </h2>
            <div className="border border-[#1f1f1f]">
              <AnimatedHowItWorks />
            </div>
          </div>
        </section>

        {/* ══════════ VE5: VIDEO PLACEHOLDER ══════════ */}
        <VideoSection />

        {/* ══════════ FEATURES ══════════ */}
        <section className="py-24 px-6 bg-[#0a0a0a] border-t border-[#1f1f1f]">
          <div className="max-w-5xl mx-auto">
            <p className="font-mono text-[10px] text-[#6b6b6b] tracking-widest uppercase mb-4">
              WHAT IT DOES
            </p>
            <h2 className="text-3xl md:text-4xl font-black tracking-tighter text-[#f0f0f0] mb-16">
              Two systems. One purpose.
            </h2>

            {/* Feature 1 — Hard Block */}
            <div className="border border-[#1f1f1f] bg-[#111] mb-4">
              <div className="grid grid-cols-1 md:grid-cols-2">
                <div className="p-8 md:p-10 border-b md:border-b-0 md:border-r border-[#1f1f1f]">
                  <div className="inline-block font-mono text-[9px] tracking-widest border border-[#2a2a2a] text-[#f0f0f0] px-2 py-0.5 mb-5">
                    CORE FEATURE
                  </div>
                  <h3 className="text-xl font-bold tracking-tight text-[#f0f0f0] mb-3">
                    Automatic position blocking
                  </h3>
                  <p className="text-sm text-[#6b6b6b] leading-relaxed mb-6">
                    When your account hits a loss limit, TradeMarco closes the loop — no new positions until the block expires. No confirmation dialogs. No override buttons. The rule is the rule.
                  </p>
                  <ul className="space-y-2">
                    {["Daily / weekly loss limits", "Max trades per day", "Loss streak detection", "Auto-unblock after timer"].map(item => (
                      <li key={item} className="flex items-center gap-2.5 text-sm text-[#6b6b6b]">
                        <span className="font-mono text-[#e8e8e8] text-xs">✓</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="p-8 md:p-10 flex items-center justify-center">
                  <div className="w-full max-w-[260px] space-y-2">
                    <div className="font-mono text-[10px] text-[#6b6b6b] mb-4 tracking-widest">
                      LIVE STATUS
                    </div>
                    {[
                      { label: "Daily loss",   val: "$143 / $200", pct: 71, color: "#c0392b" },
                      { label: "Trades today", val: "4 / 5",       pct: 80, color: "#c0392b" },
                      { label: "Loss streak",  val: "1 / 3",       pct: 33, color: "#6b6b6b" },
                    ].map(r => (
                      <div key={r.label}>
                        <div className="flex justify-between font-mono text-[10px] mb-1">
                          <span className="text-[#6b6b6b]">{r.label}</span>
                          <span className="text-[#f0f0f0]">{r.val}</span>
                        </div>
                        <div className="h-px bg-[#1f1f1f] overflow-hidden">
                          <div className="h-full" style={{ width: `${r.pct}%`, background: r.color }} />
                        </div>
                      </div>
                    ))}
                    <div className="mt-5 border border-[#c0392b]/30 bg-[#c0392b]/5 px-3 py-2">
                      <p className="font-mono text-[10px] text-[#c0392b]">
                        ⛔ BLOCK ACTIVE — 4h 22m remaining
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Feature 2 — AI Soft Block (VE6 inside) */}
            <div className="border border-[#1f1f1f] bg-[#111]">
              <div className="grid grid-cols-1 md:grid-cols-2">
                <div className="p-8 md:p-10 flex items-start justify-center border-b md:border-b-0 md:border-r border-[#1f1f1f] order-2 md:order-1">
                  <SoftBlockChat />
                </div>
                <div className="p-8 md:p-10 order-1 md:order-2">
                  <div className="inline-block font-mono text-[9px] tracking-widest border border-[#2a2a2a] text-[#f0f0f0] px-2 py-0.5 mb-5">
                    AI ANALYSIS
                  </div>
                  <h3 className="text-xl font-bold tracking-tight text-[#f0f0f0] mb-3">
                    Before you enter — think
                  </h3>
                  <p className="text-sm text-[#6b6b6b] leading-relaxed mb-6">
                    Describe the trade you&apos;re about to take. Our system analyzes it against your recent performance, emotional patterns, and market context. You get a verdict: take it or skip it.
                  </p>
                  <ul className="space-y-2">
                    {["Trade journal input", "Pattern recognition", "Bias detection (FOMO, revenge, overconfidence)", "AI-generated recommendation"].map(item => (
                      <li key={item} className="flex items-center gap-2.5 text-sm text-[#6b6b6b]">
                        <span className="font-mono text-[#e8e8e8] text-xs">✓</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════ VE7: REPORTS TEASER ══════════ */}
        <ReportsTeaser />

        {/* ══════════ PRICING ══════════ */}
        <section id="pricing" className="py-24 px-6 bg-[#0a0a0a]">
          <div className="max-w-3xl mx-auto">
            <p className="font-mono text-[10px] text-[#6b6b6b] tracking-widest uppercase mb-4">
              PRICING
            </p>
            <h2 className="text-3xl md:text-4xl font-black tracking-tighter text-[#f0f0f0] mb-14">
              Simple. No tricks.
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Basic */}
              <div className="bg-[#111] border border-[#1f1f1f] p-7">
                <p className="font-mono text-[10px] text-[#6b6b6b] tracking-widest uppercase mb-4">BASIC</p>
                <div className="mb-6">
                  <span className="font-mono text-3xl font-bold text-[#f0f0f0]">$10.99</span>
                  <span className="font-mono text-xs text-[#6b6b6b] ml-1">/ mo</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {["1 connected account", "Hard block (all limit types)", "Telegram alerts", "30-day trade history"].map(f => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-[#6b6b6b]">
                      <span className="font-mono text-[#e8e8e8] text-xs mt-0.5">✓</span>{f}
                    </li>
                  ))}
                </ul>
                <Link href="/login" className="block w-full text-center text-sm font-semibold border border-[#2a2a2a] text-[#f0f0f0] py-2.5 rounded-sm hover:border-[#404040] transition-colors">
                  Get started
                </Link>
              </div>
              {/* Pro */}
              <div className="bg-[#111] border border-[#f0f0f0] p-7 relative">
                <div className="absolute -top-3 left-6">
                  <span className="font-mono text-[9px] tracking-widest bg-[#f0f0f0] text-black px-2 py-0.5">
                    MOST POPULAR
                  </span>
                </div>
                <p className="font-mono text-[10px] text-[#6b6b6b] tracking-widest uppercase mb-4">PRO</p>
                <div className="mb-6">
                  <span className="font-mono text-3xl font-bold text-[#f0f0f0]">$19</span>
                  <span className="font-mono text-xs text-[#6b6b6b] ml-1">/ mo</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {["Up to 3 accounts", "Hard block + Soft block (AI analysis)", "Telegram alerts", "Full history + reports (early access)", "Priority support"].map(f => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-[#6b6b6b]">
                      <span className="font-mono text-[#e8e8e8] text-xs mt-0.5">✓</span>{f}
                    </li>
                  ))}
                </ul>
                <Link href="/login" className="block w-full text-center text-sm font-semibold bg-[#f0f0f0] text-black py-2.5 rounded-sm hover:bg-white transition-colors">
                  Get started
                </Link>
              </div>
            </div>
            <p className="font-mono text-[11px] text-[#6b6b6b] mt-6">
              No free trial. If you&apos;re serious about discipline, $9 is not the obstacle.
            </p>
          </div>
        </section>

        {/* ══════════ FAQ ══════════ */}
        <section id="faq" className="py-24 px-6 bg-[#0a0a0a]">
          <div className="max-w-2xl mx-auto">
            <p className="font-mono text-[10px] text-[#6b6b6b] tracking-widest uppercase mb-4">FAQ</p>
            <h2 className="text-3xl md:text-4xl font-black tracking-tighter text-[#f0f0f0] mb-12">
              Common questions.
            </h2>
            <div className="border-t border-[#1f1f1f]">
              {[
                { q: "Does TradeMarco actually close my positions?",  a: "No. We block new entries only. Closing existing trades is always your call." },
                { q: "Can I override the block?",                     a: "No override button exists by design. You can request early removal through our support chat — a human reviews it." },
                { q: "Is my API key safe?",                           a: "Keys are stored encrypted (AES-256). We request read + close-only permissions. We cannot open trades or withdraw funds." },
                { q: "What exchanges are supported?",                 a: "Bybit and Binance Futures. OKX and BingX coming soon." },
                { q: "Why is there no free trial?",                   a: "Because people who need this tool know they need it. If $10.99 is the barrier, discipline isn't the real problem." },
              ].map((item, i) => (
                <FaqItem key={i} q={item.q} a={item.a} />
              ))}
            </div>
          </div>
        </section>

        {/* ══════════ FINAL CTA ══════════ */}
        <section className="py-28 px-6 bg-[#111]">
          <div className="max-w-xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-black tracking-tighter text-[#f0f0f0] mb-4">
              Stop explaining your losses.
            </h2>
            <p className="text-sm text-[#6b6b6b] mb-8 leading-relaxed">
              Set the rules. Let the system hold them.
            </p>
            <Link href="/login" className="inline-block font-semibold bg-[#f0f0f0] text-black text-sm px-7 py-3 rounded-sm hover:bg-white transition-colors">
              Start now →
            </Link>
            <p className="font-mono text-[10px] text-[#444] mt-5">
              Takes 3 minutes. No card required to start.
            </p>
          </div>
        </section>

        {/* ══════════ FOOTER ══════════ */}
        <footer className="border-t border-[#1f1f1f] py-6 px-6">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-[#444] font-mono text-[10px] tracking-wide">
            <div className="flex items-center gap-2">
              <LogoMark size={18} />
              <span>TRADEMARCO</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-6">
              <a href="mailto:support@trademarco.com" className="hover:text-[#6b6b6b] transition-colors">support@trademarco.com</a>
              <a href="https://t.me/trademarco_support" className="hover:text-[#6b6b6b] transition-colors">t.me/trademarco_support</a>
              <Link href="/privacy" className="hover:text-[#6b6b6b] transition-colors">Privacy</Link>
              <Link href="/terms"   className="hover:text-[#6b6b6b] transition-colors">Terms</Link>
            </div>
            <span>© 2026 TradeMarco.</span>
          </div>
        </footer>

      </div>
    </>
  );
}
