"use client";

import { useState } from "react";
import Link from "next/link";

// ─── FAQ Accordion ─────────────────────────────────────────────────────────────

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
      {open && (
        <p className="pb-5 text-sm text-[#6b6b6b] leading-relaxed">{a}</p>
      )}
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#f0f0f0] overflow-x-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ════════════════════════════════════════════════════════════════════
          NAVBAR
      ════════════════════════════════════════════════════════════════════ */}
      <header className="fixed top-0 inset-x-0 z-50 bg-[#0a0a0a]/95 backdrop-blur border-b border-[#1f1f1f]">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          {/* Logo */}
          <span className="font-mono font-bold text-[#f0f0f0] tracking-tight text-sm">
            TRADEMARCO
          </span>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8">
            <a href="#how-it-works" className="text-xs text-[#6b6b6b] hover:text-[#f0f0f0] transition-colors font-mono tracking-wide">
              How it works
            </a>
            <a href="#pricing" className="text-xs text-[#6b6b6b] hover:text-[#f0f0f0] transition-colors font-mono tracking-wide">
              Pricing
            </a>
            <a href="#faq" className="text-xs text-[#6b6b6b] hover:text-[#f0f0f0] transition-colors font-mono tracking-wide">
              FAQ
            </a>
          </nav>

          {/* CTA */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/login"
              className="text-xs font-semibold bg-[#f0f0f0] text-black px-4 py-2 rounded-sm hover:bg-white transition-colors"
            >
              Get started →
            </Link>
          </div>

          {/* Mobile menu btn */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden text-[#6b6b6b] hover:text-[#f0f0f0] font-mono text-sm"
          >
            {menuOpen ? "✕" : "☰"}
          </button>
        </div>

        {/* Mobile menu */}
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


      {/* ════════════════════════════════════════════════════════════════════
          SECTION 1 — HERO
      ════════════════════════════════════════════════════════════════════ */}
      <section className="min-h-screen flex flex-col justify-center items-center px-6 pt-14">
        <div className="max-w-3xl w-full mx-auto text-center">

          {/* Top label */}
          <p className="font-mono text-[10px] text-[#6b6b6b] tracking-widest uppercase mb-10">
            TRADEMARCO — TRADING DISCIPLINE SYSTEM
          </p>

          {/* Headline */}
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-[#f0f0f0] leading-[1.02] mb-6">
            You know the rules.<br />
            You break them anyway.
          </h1>

          {/* Sub */}
          <p className="text-base md:text-lg text-[#6b6b6b] max-w-xl mx-auto mt-4 leading-relaxed">
            TradeMarco automatically blocks your trading when you exceed loss limits — so emotions don&apos;t destroy what strategy built.
          </p>

          {/* CTA buttons */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/login"
              className="font-semibold bg-[#f0f0f0] text-black text-sm px-6 py-2.5 rounded-sm hover:bg-white transition-colors"
            >
              Start protecting capital →
            </Link>
            <a
              href="#how-it-works"
              className="text-sm border border-[#2a2a2a] text-[#f0f0f0] px-6 py-2.5 rounded-sm hover:border-[#404040] transition-colors font-mono"
            >
              See how it works
            </a>
          </div>

          {/* Stats row */}
          <div className="mt-12 pt-8 border-t border-[#1f1f1f] grid grid-cols-1 sm:grid-cols-3 gap-8">
            <div className="text-center">
              <p className="font-mono text-2xl font-bold text-[#f0f0f0]">23%</p>
              <p className="font-mono text-[11px] text-[#6b6b6b] mt-1.5 leading-snug">avg additional loss from<br />revenge trading</p>
            </div>
            <div className="text-center">
              <p className="font-mono text-2xl font-bold text-[#f0f0f0]">67%</p>
              <p className="font-mono text-[11px] text-[#6b6b6b] mt-1.5 leading-snug">of blown accounts trace back<br />to 3 emotional trades</p>
            </div>
            <div className="text-center">
              <p className="font-mono text-2xl font-bold text-[#f0f0f0]">&lt; 3 min</p>
              <p className="font-mono text-[11px] text-[#6b6b6b] mt-1.5 leading-snug">to connect and activate<br />your first block</p>
            </div>
          </div>

        </div>
      </section>


      {/* ════════════════════════════════════════════════════════════════════
          SECTION 2 — PAIN POINTS
      ════════════════════════════════════════════════════════════════════ */}
      <section className="py-24 px-6 bg-[#0a0a0a]">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4">

          {[
            {
              label: "REVENGE TRADING",
              stat:  "-$2,400",
              text:  "One bad trade turns into five. You know this pattern. It keeps happening anyway.",
            },
            {
              label: "FOMO ENTRIES",
              stat:  "3.2× more",
              text:  "Late entries after missing a move. Wider stops, worse R:R, predictable outcome.",
            },
            {
              label: "DAILY LIMIT IGNORED",
              stat:  "67% of blowups",
              text:  "You had a rule. $200 max loss per day. You overrode it 'just this once.'",
            },
          ].map(c => (
            <div key={c.label} className="bg-[#111] border-l-2 border-[#c0392b] pl-5 py-5 pr-4">
              <p className="font-mono text-[10px] text-[#6b6b6b] tracking-widest uppercase mb-3">{c.label}</p>
              <p className="font-mono text-2xl font-bold text-[#c0392b] mb-3">{c.stat}</p>
              <p className="text-sm text-[#6b6b6b] leading-relaxed">{c.text}</p>
            </div>
          ))}

        </div>
      </section>


      {/* ════════════════════════════════════════════════════════════════════
          SECTION 3 — HOW IT WORKS
      ════════════════════════════════════════════════════════════════════ */}
      <section id="how-it-works" className="py-24 px-6 bg-[#0a0a0a]">
        <div className="max-w-2xl mx-auto">

          <p className="font-mono text-[10px] text-[#6b6b6b] tracking-widest uppercase mb-4">HOW IT WORKS</p>
          <h2 className="text-3xl md:text-4xl font-black tracking-tighter text-[#f0f0f0] mb-14">
            Set limits once.<br />The system enforces them.
          </h2>

          {/* Timeline */}
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-[11px] top-2 bottom-2 w-px bg-[#1f1f1f]" />

            <div className="space-y-10">
              {[
                {
                  step: "01",
                  title: "Connect your exchange",
                  text:  "Add your Bybit or Binance Futures account with read + close-only API key. We cannot open trades or touch your funds.",
                },
                {
                  step: "02",
                  title: "Define your rules",
                  text:  "Max daily loss. Max weekly loss. Trade count. Loss streak. Block duration: 1h to 24h. Your rules, your parameters.",
                },
                {
                  step: "03",
                  title: "TradeMarco enforces them",
                  text:  "When a limit is breached, all new positions are blocked. You get a Telegram alert. The block lifts automatically — or you request early removal through support.",
                },
              ].map(s => (
                <div key={s.step} className="flex gap-6">
                  <div className="shrink-0 relative">
                    <div className="w-[22px] h-[22px] rounded-full bg-[#111] border border-[#1f1f1f] flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#e8e8e8]" />
                    </div>
                  </div>
                  <div className="pb-2">
                    <p className="font-semibold text-[#f0f0f0] text-sm mb-1.5">{s.title}</p>
                    <p className="text-sm text-[#6b6b6b] leading-relaxed">{s.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </section>


      {/* ════════════════════════════════════════════════════════════════════
          SECTION 4 — FEATURES
      ════════════════════════════════════════════════════════════════════ */}
      <section className="py-24 px-6 bg-[#0a0a0a]">
        <div className="max-w-5xl mx-auto">

          <p className="font-mono text-[10px] text-[#6b6b6b] tracking-widest uppercase mb-4">WHAT IT DOES</p>
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
                  {["Daily / weekly loss limits","Max trades per day","Loss streak detection","Auto-unblock after timer"].map(item => (
                    <li key={item} className="flex items-center gap-2.5 text-sm text-[#6b6b6b]">
                      <span className="font-mono text-[#e8e8e8] text-xs">✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              {/* Visual placeholder */}
              <div className="p-8 md:p-10 flex items-center justify-center">
                <div className="w-full max-w-[260px] space-y-2">
                  <div className="font-mono text-[10px] text-[#6b6b6b] mb-4 tracking-widest">LIVE STATUS</div>
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
                    <p className="font-mono text-[10px] text-[#c0392b]">⛔ BLOCK ACTIVE — 4h 22m remaining</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Feature 2 — AI Soft Block */}
          <div className="border border-[#1f1f1f] bg-[#111]">
            <div className="grid grid-cols-1 md:grid-cols-2">
              {/* Visual placeholder */}
              <div className="p-8 md:p-10 flex items-center justify-center border-b md:border-b-0 md:border-r border-[#1f1f1f] order-2 md:order-1">
                <div className="w-full max-w-[260px]">
                  <div className="font-mono text-[10px] text-[#6b6b6b] mb-4 tracking-widest">TRADE ANALYSIS</div>
                  <div className="border border-[#1f1f1f] p-3 mb-3">
                    <p className="font-mono text-[10px] text-[#6b6b6b] mb-1">YOUR NOTE</p>
                    <p className="text-xs text-[#f0f0f0]">&quot;BTC long, missed the first move, this feels like a recovery bounce…&quot;</p>
                  </div>
                  <div className="space-y-1.5">
                    {[
                      { label: "Pattern", val: "FOMO entry",    flag: true  },
                      { label: "Context", val: "After 2 losses",flag: true  },
                      { label: "Setup",   val: "No clear level",flag: true  },
                    ].map(r => (
                      <div key={r.label} className="flex justify-between font-mono text-[10px]">
                        <span className="text-[#6b6b6b]">{r.label}</span>
                        <span className={r.flag ? "text-[#c0392b]" : "text-[#16a34a]"}>{r.val}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 border border-[#c0392b]/30 bg-[#c0392b]/5 px-3 py-2">
                    <p className="font-mono text-[10px] text-[#c0392b]">VERDICT: Skip this trade.</p>
                  </div>
                </div>
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
                  {["Trade journal input","Pattern recognition","Bias detection (FOMO, revenge, overconfidence)","AI-generated recommendation"].map(item => (
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


      {/* ════════════════════════════════════════════════════════════════════
          SECTION 5 — REPORTS TEASER
      ════════════════════════════════════════════════════════════════════ */}
      <section className="py-20 px-6 bg-[#111]">
        <div className="max-w-2xl mx-auto">
          <div className="inline-block font-mono text-[9px] tracking-widest border border-[#2a2a2a] text-[#6b6b6b] px-2 py-0.5 mb-6">
            COMING SOON
          </div>
          <h2 className="text-2xl md:text-3xl font-black tracking-tighter text-[#f0f0f0] mb-4">
            Your trading has patterns.<br />Most of them are costing you.
          </h2>
          <p className="text-sm text-[#6b6b6b] leading-relaxed mb-8 max-w-lg">
            Full performance reports — loss distribution by time of day, weekday, asset, trade sequence. See exactly where your discipline breaks down.
          </p>
          <Link
            href="/login"
            className="text-sm font-semibold border border-[#2a2a2a] text-[#f0f0f0] px-5 py-2.5 rounded-sm hover:border-[#404040] transition-colors"
          >
            Join early access →
          </Link>
        </div>
      </section>


      {/* ════════════════════════════════════════════════════════════════════
          SECTION 6 — PRICING
      ════════════════════════════════════════════════════════════════════ */}
      <section id="pricing" className="py-24 px-6 bg-[#0a0a0a]">
        <div className="max-w-3xl mx-auto">

          <p className="font-mono text-[10px] text-[#6b6b6b] tracking-widest uppercase mb-4">PRICING</p>
          <h2 className="text-3xl md:text-4xl font-black tracking-tighter text-[#f0f0f0] mb-14">
            Simple. No tricks.
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Plan 1 — Basic */}
            <div className="bg-[#111] border border-[#1f1f1f] p-7">
              <p className="font-mono text-[10px] text-[#6b6b6b] tracking-widest uppercase mb-4">BASIC</p>
              <div className="mb-6">
                <span className="font-mono text-3xl font-bold text-[#f0f0f0]">$10.99</span>
                <span className="font-mono text-xs text-[#6b6b6b] ml-1">/ mo</span>
              </div>
              <ul className="space-y-3 mb-8">
                {[
                  "1 connected account",
                  "Hard block (all limit types)",
                  "Telegram alerts",
                  "30-day trade history",
                ].map(f => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-[#6b6b6b]">
                    <span className="font-mono text-[#e8e8e8] text-xs mt-0.5">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/login"
                className="block w-full text-center text-sm font-semibold border border-[#2a2a2a] text-[#f0f0f0] py-2.5 rounded-sm hover:border-[#404040] transition-colors"
              >
                Get started
              </Link>
            </div>

            {/* Plan 2 — Pro */}
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
                {[
                  "Up to 3 accounts",
                  "Hard block + Soft block (AI analysis)",
                  "Telegram alerts",
                  "Full history + reports (early access)",
                  "Priority support",
                ].map(f => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-[#6b6b6b]">
                    <span className="font-mono text-[#e8e8e8] text-xs mt-0.5">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/login"
                className="block w-full text-center text-sm font-semibold bg-[#f0f0f0] text-black py-2.5 rounded-sm hover:bg-white transition-colors"
              >
                Get started
              </Link>
            </div>

          </div>

          <p className="font-mono text-[11px] text-[#6b6b6b] mt-6">
            No free trial. If you&apos;re serious about discipline, $9 is not the obstacle.
          </p>

        </div>
      </section>


      {/* ════════════════════════════════════════════════════════════════════
          SECTION 7 — FAQ
      ════════════════════════════════════════════════════════════════════ */}
      <section id="faq" className="py-24 px-6 bg-[#0a0a0a]">
        <div className="max-w-2xl mx-auto">

          <p className="font-mono text-[10px] text-[#6b6b6b] tracking-widest uppercase mb-4">FAQ</p>
          <h2 className="text-3xl md:text-4xl font-black tracking-tighter text-[#f0f0f0] mb-12">
            Common questions.
          </h2>

          <div className="border-t border-[#1f1f1f]">
            {[
              {
                q: "Does TradeMarco actually close my positions?",
                a: "No. We block new entries only. Closing existing trades is always your call.",
              },
              {
                q: "Can I override the block?",
                a: "No override button exists by design. You can request early removal through our support chat — a human reviews it.",
              },
              {
                q: "Is my API key safe?",
                a: "Keys are stored encrypted (AES-256). We request read + close-only permissions. We cannot open trades or withdraw funds.",
              },
              {
                q: "What exchanges are supported?",
                a: "Bybit and Binance Futures. OKX and BingX coming soon.",
              },
              {
                q: "Why is there no free trial?",
                a: "Because people who need this tool know they need it. If $10.99 is the barrier, discipline isn't the real problem.",
              },
            ].map((item, i) => (
              <FaqItem key={i} q={item.q} a={item.a} />
            ))}
          </div>

        </div>
      </section>


      {/* ════════════════════════════════════════════════════════════════════
          SECTION 8 — FINAL CTA
      ════════════════════════════════════════════════════════════════════ */}
      <section className="py-28 px-6 bg-[#111]">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-black tracking-tighter text-[#f0f0f0] mb-4">
            Stop explaining your losses.
          </h2>
          <p className="text-sm text-[#6b6b6b] mb-8 leading-relaxed">
            Set the rules. Let the system hold them.
          </p>
          <Link
            href="/login"
            className="inline-block font-semibold bg-[#f0f0f0] text-black text-sm px-7 py-3 rounded-sm hover:bg-white transition-colors"
          >
            Start now →
          </Link>
          <p className="font-mono text-[10px] text-[#444] mt-5">
            Takes 3 minutes. No card required to start.
          </p>
        </div>
      </section>


      {/* ════════════════════════════════════════════════════════════════════
          FOOTER
      ════════════════════════════════════════════════════════════════════ */}
      <footer className="border-t border-[#1f1f1f] py-6 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-[#444] font-mono text-[10px] tracking-wide">
          <span>TRADEMARCO</span>
          <div className="flex flex-wrap items-center justify-center gap-6">
            <a href="mailto:support@trademarco.com" className="hover:text-[#6b6b6b] transition-colors">
              support@trademarco.com
            </a>
            <a href="https://t.me/trademarco_support" className="hover:text-[#6b6b6b] transition-colors">
              t.me/trademarco_support
            </a>
            <Link href="/privacy" className="hover:text-[#6b6b6b] transition-colors">Privacy</Link>
            <Link href="/terms"   className="hover:text-[#6b6b6b] transition-colors">Terms</Link>
          </div>
          <span>© 2026 TradeMarco.</span>
        </div>
      </footer>

    </div>
  );
}
