import Link from "next/link";

const sections = [
  {
    title: "1. Acceptance of Terms",
    content:
      "By accessing or using TradeGuard, you agree to be bound by these Terms of Service. If you do not agree, please do not use our service. We reserve the right to update these terms at any time, with notice provided via email or in-app notification.",
  },
  {
    title: "2. Description of Service",
    content:
      "TradeGuard is a trading discipline monitoring tool that connects to your broker account via API to track trades, enforce risk limits, and send alerts. We do not provide financial advice, investment recommendations, or execute trades on your behalf.",
  },
  {
    title: "3. Account Responsibility",
    content:
      "You are responsible for maintaining the confidentiality of your account credentials. You must immediately notify us of any unauthorized use of your account. You are responsible for all activities that occur under your account.",
  },
  {
    title: "4. API Key Usage",
    content:
      "You grant TradeGuard permission to use the provided API keys to read trading data and (where enabled) place block orders on your behalf. You must ensure the API keys you provide comply with your broker's terms of service. TradeGuard will never withdraw funds from your account.",
  },
  {
    title: "5. No Financial Advice",
    content:
      "TradeGuard does not provide financial, investment, or trading advice. All limit settings and decisions are made by you. Past performance data shown in analytics is for informational purposes only. Trading involves risk and you may lose money.",
  },
  {
    title: "6. Service Availability",
    content:
      "We strive for high availability but do not guarantee uninterrupted service. We are not liable for any losses arising from service downtime, delays in limit enforcement, or technical failures. Critical trading decisions should not rely solely on TradeGuard.",
  },
  {
    title: "7. Acceptable Use",
    content:
      "You may not use TradeGuard to violate applicable laws, broker terms of service, or market regulations. You may not attempt to reverse-engineer, scrape, or abuse our API. Abuse may result in immediate account termination.",
  },
  {
    title: "8. Limitation of Liability",
    content:
      "To the maximum extent permitted by law, TradeGuard shall not be liable for any indirect, incidental, or consequential damages arising from use of the service, including but not limited to trading losses, missed opportunities, or data loss.",
  },
  {
    title: "9. Termination",
    content:
      "You may cancel your account at any time. We may suspend or terminate accounts that violate these terms. Upon termination, your data will be retained for 30 days before deletion, unless you request immediate deletion.",
  },
  {
    title: "10. Governing Law",
    content:
      "These terms are governed by applicable law. Any disputes shall be resolved through binding arbitration. If any provision is found unenforceable, the remaining provisions remain in full effect.",
  },
  {
    title: "11. Contact",
    content:
      "For questions about these terms, contact us at legal@tradeguard.io.",
  },
];

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#0f1117] text-slate-200" style={{ fontFamily: "var(--font-geist-sans)" }}>
      <div className="max-w-3xl mx-auto px-6 py-16">
        {/* Logo */}
        <Link href="/" className="inline-flex items-center gap-2.5 mb-12 hover:opacity-80 transition-opacity">
          <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center text-xs font-bold text-black">TG</div>
          <span className="font-bold text-white">TradeGuard</span>
        </Link>

        <h1 className="text-4xl font-black text-white mb-2">Terms of Service</h1>
        <p className="text-slate-500 text-sm mb-12">Last updated: March 2026</p>

        <div className="space-y-10">
          {sections.map(s => (
            <div key={s.title}>
              <h2 className="text-lg font-bold text-white mb-3">{s.title}</h2>
              <p className="text-slate-400 leading-relaxed">{s.content}</p>
            </div>
          ))}
        </div>

        <div className="mt-16 pt-8 border-t border-white/5 flex gap-6 text-xs text-slate-600">
          <Link href="/" className="hover:text-slate-400 transition-colors">← Back to home</Link>
          <Link href="/privacy" className="hover:text-slate-400 transition-colors">Privacy Policy</Link>
        </div>
      </div>
    </div>
  );
}
