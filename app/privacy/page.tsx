import Link from "next/link";

const sections = [
  {
    title: "1. Data We Collect",
    content:
      "We collect your email address for authentication, your broker API keys (encrypted with AES-256-GCM), and trading activity data synced from your connected broker accounts. We do not collect payment card data directly — payments are handled by third-party processors.",
  },
  {
    title: "2. How We Use Your Data",
    content:
      "Your data is used solely to provide the TradeGuard service: monitoring trading limits, storing trade history, sending breach alerts, and displaying analytics. We do not sell, rent, or share your data with third parties for advertising or marketing purposes.",
  },
  {
    title: "3. API Key Security",
    content:
      "All broker API keys are encrypted using AES-256-GCM encryption before being stored in our database. The encryption key is stored separately in a secure environment. We only request the minimum permissions needed (read-only where possible) and never withdraw funds from your account.",
  },
  {
    title: "4. Data Retention",
    content:
      "Trade history and account data are retained for the duration of your subscription. Upon account deletion, all personal data and API keys are permanently removed within 30 days. You can request deletion at any time by contacting support.",
  },
  {
    title: "5. Cookies",
    content:
      "We use a single session cookie (tg_uid) to maintain your authentication session. This is a strictly necessary httpOnly cookie and cannot be used for tracking. We do not use advertising or analytics cookies.",
  },
  {
    title: "6. Third-Party Services",
    content:
      "We may use third-party services such as Supabase (database hosting) and Vercel (cloud hosting). These providers are bound by their own privacy policies and process data only as necessary to provide their services.",
  },
  {
    title: "7. Your Rights",
    content:
      "You have the right to access, correct, or delete your personal data. You may also request a copy of your data in a portable format. To exercise these rights, contact us at privacy@tradeguard.io.",
  },
  {
    title: "8. Contact",
    content:
      "For privacy questions or data requests, contact us at privacy@tradeguard.io. We aim to respond within 5 business days.",
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0f1117] text-slate-200" style={{ fontFamily: "var(--font-geist-sans)" }}>
      <div className="max-w-3xl mx-auto px-6 py-16">
        {/* Logo */}
        <Link href="/" className="inline-flex items-center gap-2.5 mb-12 hover:opacity-80 transition-opacity">
          <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center text-xs font-bold text-black">TG</div>
          <span className="font-bold text-white">TradeGuard</span>
        </Link>

        <h1 className="text-4xl font-black text-white mb-2">Privacy Policy</h1>
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
          <Link href="/terms" className="hover:text-slate-400 transition-colors">Terms of Service</Link>
        </div>
      </div>
    </div>
  );
}
