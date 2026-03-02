"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useLang } from "@/context/language";

// ─── Animated counter ─────────────────────────────────────────────────────────
function Counter({ to, prefix = "", suffix = "", duration = 2000 }: { to: number; prefix?: string; suffix?: string; duration?: number }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const start = performance.now();
        const tick = (now: number) => {
          const progress = Math.min((now - start) / duration, 1);
          const ease = 1 - Math.pow(1 - progress, 3);
          setVal(Math.round(ease * to));
          if (progress < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [to, duration]);

  return <span ref={ref}>{prefix}{val.toLocaleString()}{suffix}</span>;
}

// ─── FAQ Accordion Item ────────────────────────────────────────────────────────
function FaqItem({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  return (
    <div className="border border-white/10 rounded-xl overflow-hidden transition-colors hover:border-white/20">
      <button
        onClick={onToggle}
        className="w-full px-6 py-4 text-left flex items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors"
      >
        <span className="text-sm font-semibold text-white">{q}</span>
        <span
          className="text-slate-400 text-lg shrink-0 transition-transform duration-200"
          style={{ transform: open ? "rotate(45deg)" : "none" }}
        >+</span>
      </button>
      {open && (
        <div className="px-6 pb-5 pt-3 text-sm text-slate-400 leading-relaxed border-t border-white/5">
          {a}
        </div>
      )}
    </div>
  );
}

// ─── Translations ─────────────────────────────────────────────────────────────
const t = {
  ru: {
    nav: {
      features: "Возможности",
      how: "Как это работает",
      pricing: "Цены",
      waitlist: "Вейтлист",
      login: "Войти",
      cta: "Начать бесплатно",
    },
    hero: {
      badge: "Перестань сливать. Начни торговать по правилам.",
      h1a: "Твой злейший враг —",
      h1b: "это ты сам.",
      sub: "TradeGuard — личный страж дисциплины для трейдера. Эмоции, месть рынку, азарт, оверторговля — мы останавливаем это до того, как ты теряешь деньги.",
      cta1: "Начать бесплатно",
      cta2: "Как это работает",
      trust1: "Без кредитной карты",
      trust2: "14 дней бесплатно",
      trust3: "Отмена в любой момент",
    },
    painTitle: "Узнаёшь себя?",
    painSub: "Большинство трейдеров теряют деньги не из-за плохой стратегии — а из-за себя",
    pains: [
      { icon: "😤", title: "Месть рынку",             desc: "После убытка открываешь следующую сделку в 2 раза больше, чтобы «отбить». И теряешь ещё больше." },
      { icon: "📱", title: "Оверторговля",             desc: "Сидишь у экрана и ищешь вход, когда входа нет. 15 сделок вместо 3 — и счёт в минусе." },
      { icon: "💸", title: "Нет стоп-лосса",           desc: "«Выйдет, подожду» — и держишь убыточную позицию часами, пока потеря не становится критической." },
      { icon: "😨", title: "ФОМО и панические выходы", desc: "Входишь на хайпе и выходишь от страха. Покупаешь дорого, продаёшь дёшево — снова и снова." },
      { icon: "🎲", title: "Рискуешь слишком много",   desc: "«Это точно выстрелит» — и ставишь 50% депозита на одну сделку. Потом несколько месяцев восстановления." },
      { icon: "📉", title: "Игнорируешь лимиты",       desc: "Знаешь, что надо остановиться, но продолжаешь. Один плохой день съедает прибыль за неделю." },
    ],
    preview: {
      url: "app.tradeguard.io/dashboard",
      alert: "3 убыточные сделки подряд — торговля приостановлена",
      breach: "Стоп!",
      breachSub: "Дневной лимит убытка достигнут",
      confirmed: "Защита сработала",
      confirmedSub: "Ты в безопасности",
      cols: ["Инструмент", "Тип", "P&L", "Статус"],
      statuses: ["Закрыта", "Закрыта", "Открыта"],
      statLabels: ["P&L сегодня", "Просадка", "Сделок", "Депозит"],
      sidebar: ["Дашборд", "Аналитика", "Лимиты", "Нарушения", "Настройки"],
    },
    stats: [
      { label: "В вейтлисте" },
      { label: "Шифрование ключей" },
      { label: "Мониторинг" },
      { label: "Минут на настройку" },
    ],
    featuresTitle: "TradeGuard — твой второй мозг",
    featuresSub: "Когда эмоции берут верх, система берёт контроль. Никаких человеческих слабостей.",
    featuresBadge: "Возможности",
    features: [
      { icon: "🚫", title: "Автоблокировка торговли",    desc: "При достижении дневного лимита убытка или серии проигрышей — платформа физически не даёт открыть новую сделку.", glow: "emerald" },
      { icon: "📏", title: "Персональные лимиты риска",  desc: "Ты сам задаёшь правила: максимальный убыток за день, максимальная просадка, количество сделок. Холодной головой, заранее.", glow: "blue" },
      { icon: "🔔", title: "Алерты в реальном времени",  desc: "При приближении к лимиту — мгновенный сигнал в Telegram или на экране. Ты знаешь об опасности до катастрофы.", glow: "purple" },
      { icon: "📊", title: "Журнал сделок и аналитика",  desc: "Видишь паттерны своих ошибок: в какое время ты торгуешь хуже всего, после каких ситуаций сливаешь, где теряешь.", glow: "orange" },
      { icon: "🔐", title: "AES-256 шифрование",         desc: "API-ключи хранятся в зашифрованном виде. Мы не можем прочитать твои ключи — только использовать их для запросов к бирже.", glow: "pink" },
      { icon: "📈", title: "Отчёты по дисциплине",       desc: "Еженедельная статистика: соблюдение правил, лучшие и худшие сессии, прогресс по сравнению с прошлой неделей.", glow: "red" },
    ],
    howBadge: "Как это работает",
    howTitle: "Просто. Честно. Эффективно.",
    howSub: "Настройка занимает 3 минуты. Первый результат — с первого торгового дня",
    steps: [
      { num: "01", title: "Устанавливаешь правила",     desc: "Ты задаёшь свои лимиты: максимальный убыток за день, сколько сделок, какую просадку можешь пережить. Одноразово, на трезвую голову." },
      { num: "02", title: "TradeGuard следит за тобой", desc: "Каждая сделка отслеживается в реальном времени. При нарушении правил — мгновенный алерт и блокировка." },
      { num: "03", title: "Ты растёшь как трейдер",     desc: "Смотришь на статистику, видишь паттерны ошибок, улучшаешь дисциплину. Убытки уменьшаются, прибыль растёт." },
    ],
    pricingBadge: "Цены",
    pricingTitle: "Дешевле одного убыточного дня",
    pricingSub: "Одна предотвращённая ошибка окупает подписку на месяц вперёд.",
    pricingPopular: "ПОПУЛЯРНЫЙ",
    pricing: [
      { name: "Личный",    price: "9",  period: "мес", desc: "Для трейдеров-одиночек",             features: ["Все лимиты риска", "Автоблокировка", "Telegram алерты", "Журнал сделок", "Еженедельные отчёты"],                              cta: "Начать бесплатно",   highlight: false },
      { name: "Трейдер+",  price: "19", period: "мес", desc: "Для серьёзного роста",               features: ["Всё из Личного", "Расширенная аналитика", "Паттерны ошибок", "Экспорт данных", "Приоритетная поддержка"],                       cta: "14 дней бесплатно",  highlight: true  },
      { name: "Наставник", price: "49", period: "мес", desc: "Для тех, кто обучает или в группе", features: ["До 5 аккаунтов", "Совместный дашборд", "Отчёты для ментора", "Сравнение статистики", "Поддержка 24/7"],                         cta: "Попробовать",        highlight: false },
    ],
    pricingCustom: "По запросу",
    waitlistBadge: "Ранний доступ",
    waitlistTitle: "500+ трейдеров уже в очереди",
    waitlistSub: "Будь среди первых, кто получит доступ к TradeGuard. Оставь email — мы сообщим при запуске.",
    waitlistPlaceholder: "твой@email.com",
    waitlistCta: "Получить ранний доступ",
    waitlistSuccess: "Ты в списке! Сообщим, когда откроемся. 🎉",
    waitlistDuplicate: "Этот email уже в списке. Спасибо!",
    faqBadge: "FAQ",
    faqTitle: "Часто задаваемые вопросы",
    faqItems: [
      { q: "Как хранятся мои API-ключи?",                     a: "Все API-ключи шифруются с помощью AES-256-GCM перед сохранением в базе данных. Ключ шифрования хранится отдельно в защищённой среде. Мы не можем прочитать твои ключи — только использовать их для запросов к бирже." },
      { q: "Могу ли я закрыть позиции вручную?",              a: "Да. TradeGuard блокирует только открытие новых позиций. Ты всегда можешь закрыть существующие позиции вручную прямо на бирже." },
      { q: "Какие брокеры поддерживаются?",                   a: "На данный момент поддерживаются Bybit и Binance (фьючерсы). Больше брокеров — скоро." },
      { q: "Что происходит после истечения блокировки?",      a: "Торговля автоматически разблокируется в 00:00 UTC следующего дня. Ты также можешь разблокировать вручную через настройки." },
    ],
    ctaBadge: "Начни сегодня",
    ctaTitle: "Хватит терять деньги на эмоциях.",
    ctaSub: "Настройся за 3 минуты. Первый месяц бесплатно.\nБез кредитной карты.",
    ctaBtn: "Защитить свой депозит →",
    ctaFootnote: "Уже 500+ трейдеров в вейтлисте TradeGuard",
    footer: {
      desc: "Личный страж торговой дисциплины. Помогаем трейдерам перестать терять деньги на эмоциях.",
      cols: [
        { title: "Продукт",   links: [{ label: "Возможности", href: "#features" }, { label: "Цены", href: "#pricing" }, { label: "FAQ", href: "#faq" }] },
        { title: "Поддержка", links: [{ label: "Telegram", href: "https://t.me/tradeguard" }, { label: "Email", href: "mailto:support@tradeguard.io" }] },
      ],
      copy: "© 2026 TradeGuard. Все права защищены.",
      legal: [
        { label: "Политика конфиденциальности", href: "/privacy" },
        { label: "Условия использования",       href: "/terms" },
      ],
    },
  },
  en: {
    nav: {
      features: "Features",
      how: "How it works",
      pricing: "Pricing",
      waitlist: "Waitlist",
      login: "Log in",
      cta: "Start for free",
    },
    hero: {
      badge: "Stop blowing up. Start trading with discipline.",
      h1a: "Your biggest enemy",
      h1b: "is yourself.",
      sub: "TradeGuard is your personal discipline guardian. Revenge trading, FOMO, overtrading, no stop-loss — we stop you before you blow your account.",
      cta1: "Start for free",
      cta2: "How it works",
      trust1: "No credit card required",
      trust2: "14-day free trial",
      trust3: "Cancel anytime",
    },
    painTitle: "Sound familiar?",
    painSub: "Most traders lose money not because of a bad strategy — but because of themselves",
    pains: [
      { icon: "😤", title: "Revenge trading",       desc: "After a loss you open the next trade 2x bigger to 'make it back'. And lose even more." },
      { icon: "📱", title: "Overtrading",            desc: "You sit at the screen searching for entries when there are none. 15 trades instead of 3 — account in red." },
      { icon: "💸", title: "No stop-loss",           desc: "'It'll recover, I'll wait' — and you hold a losing position for hours until the loss becomes critical." },
      { icon: "😨", title: "FOMO & panic exits",    desc: "You enter on hype and exit out of fear. Buy high, sell low — again and again." },
      { icon: "🎲", title: "Risking too much",       desc: "'This one is certain' — and you put 50% of your deposit on one trade. Then months of recovery." },
      { icon: "📉", title: "Ignoring your limits",   desc: "You know you should stop but keep going. One bad day wipes out a week of profit." },
    ],
    preview: {
      url: "app.tradeguard.io/dashboard",
      alert: "3 consecutive losses — trading has been paused",
      breach: "Stop!",
      breachSub: "Daily loss limit reached",
      confirmed: "Protection triggered",
      confirmedSub: "You're safe",
      cols: ["Instrument", "Type", "P&L", "Status"],
      statuses: ["Closed", "Closed", "Open"],
      statLabels: ["Today's P&L", "Drawdown", "Trades", "Deposit"],
      sidebar: ["Dashboard", "Analytics", "Limits", "Breaches", "Settings"],
    },
    stats: [
      { label: "On the waitlist" },
      { label: "Key encryption" },
      { label: "Monitoring" },
      { label: "Minutes to setup" },
    ],
    featuresTitle: "TradeGuard is your second brain",
    featuresSub: "When emotions take over, the system takes control. No human weaknesses.",
    featuresBadge: "Features",
    features: [
      { icon: "🚫", title: "Auto-block trading",      desc: "When you hit your daily loss limit or a losing streak — the platform physically prevents you from opening a new trade.", glow: "emerald" },
      { icon: "📏", title: "Personal risk limits",     desc: "You set the rules yourself: max daily loss, max drawdown, number of trades. With a clear head, in advance.", glow: "blue" },
      { icon: "🔔", title: "Real-time alerts",         desc: "As you approach your limit — instant notification via Telegram or on screen. Know the danger before disaster strikes.", glow: "purple" },
      { icon: "📊", title: "Trade journal & analytics",desc: "See patterns in your mistakes: when you trade worst, after which situations you blow up, where you lose the most.", glow: "orange" },
      { icon: "🔐", title: "AES-256 encryption",       desc: "API keys are stored encrypted. We cannot read your keys — only use them to make requests to the exchange.", glow: "pink" },
      { icon: "📈", title: "Discipline reports",       desc: "Weekly stats: rule compliance, best and worst sessions, progress compared to last week.", glow: "red" },
    ],
    howBadge: "How it works",
    howTitle: "Simple. Honest. Effective.",
    howSub: "Setup takes 3 minutes. First results from your very first trading day",
    steps: [
      { num: "01", title: "You set the rules",          desc: "You define your limits: max daily loss, number of trades, drawdown you can handle. Once, with a clear head." },
      { num: "02", title: "TradeGuard watches you",     desc: "Every trade is tracked in real time. When you break your rules — instant alert and trading block." },
      { num: "03", title: "You grow as a trader",       desc: "Review your stats, spot error patterns, improve discipline. Losses shrink, profits grow." },
    ],
    pricingBadge: "Pricing",
    pricingTitle: "Cheaper than one bad trading day",
    pricingSub: "One prevented mistake pays for a month of subscription.",
    pricingPopular: "POPULAR",
    pricing: [
      { name: "Personal",  price: "9",  period: "mo", desc: "For solo traders",              features: ["All risk limits", "Auto-block", "Telegram alerts", "Trade journal", "Weekly reports"],                                      cta: "Start for free",   highlight: false },
      { name: "Trader+",   price: "19", period: "mo", desc: "For serious growth",            features: ["Everything in Personal", "Advanced analytics", "Error patterns", "Data export", "Priority support"],                        cta: "14 days free",     highlight: true  },
      { name: "Mentor",    price: "49", period: "mo", desc: "For mentors & accountability",  features: ["Up to 5 accounts", "Shared dashboard", "Mentor reports", "Stats comparison", "24/7 support"],                             cta: "Try it",           highlight: false },
    ],
    pricingCustom: "Custom pricing",
    waitlistBadge: "Early Access",
    waitlistTitle: "Join 500+ traders on the waitlist",
    waitlistSub: "Be among the first to access TradeGuard when we launch. Leave your email and we'll notify you.",
    waitlistPlaceholder: "your@email.com",
    waitlistCta: "Get Early Access",
    waitlistSuccess: "You're on the list! We'll notify you when we launch. 🎉",
    waitlistDuplicate: "This email is already on the list. Thanks!",
    faqBadge: "FAQ",
    faqTitle: "Frequently Asked Questions",
    faqItems: [
      { q: "Do you store my API keys securely?",       a: "Yes, all API keys are encrypted with AES-256-GCM before being stored. The encryption key is stored separately in a secure environment. We cannot read your keys — only use them to make requests to the exchange." },
      { q: "Can I still close positions manually?",    a: "Yes, you can always close positions manually directly on your broker platform. TradeGuard only blocks opening NEW positions when your limits are triggered." },
      { q: "Which brokers are supported?",             a: "Bybit and Binance (Futures) are currently supported. More brokers are coming soon." },
      { q: "What happens after the block period ends?", a: "Trading is automatically unblocked at 00:00 UTC next day. You can also manually unblock through the settings page." },
    ],
    ctaBadge: "Start today",
    ctaTitle: "Stop losing money to your emotions.",
    ctaSub: "Set up in 3 minutes. First month free.\nNo credit card required.",
    ctaBtn: "Protect my account →",
    ctaFootnote: "500+ traders already on the TradeGuard waitlist",
    footer: {
      desc: "Your personal trading discipline guardian. We help traders stop losing money to emotions.",
      cols: [
        { title: "Product",  links: [{ label: "Features", href: "#features" }, { label: "Pricing", href: "#pricing" }, { label: "FAQ", href: "#faq" }] },
        { title: "Support",  links: [{ label: "Telegram", href: "https://t.me/tradeguard" }, { label: "Email", href: "mailto:support@tradeguard.io" }] },
      ],
      copy: "© 2026 TradeGuard. All rights reserved.",
      legal: [
        { label: "Privacy Policy",    href: "/privacy" },
        { label: "Terms of Service",  href: "/terms" },
      ],
    },
  },
} as const;

// ─── Style helpers ─────────────────────────────────────────────────────────────
const glowColors: Record<string, string> = {
  emerald: "shadow-emerald-500/20 border-emerald-500/20 group-hover:border-emerald-500/40",
  blue:    "shadow-blue-500/20 border-blue-500/20 group-hover:border-blue-500/40",
  purple:  "shadow-purple-500/20 border-purple-500/20 group-hover:border-purple-500/40",
  orange:  "shadow-orange-500/20 border-orange-500/20 group-hover:border-orange-500/40",
  pink:    "shadow-pink-500/20 border-pink-500/20 group-hover:border-pink-500/40",
  red:     "shadow-red-500/20 border-red-500/20 group-hover:border-red-500/40",
};

const iconBg: Record<string, string> = {
  emerald: "bg-emerald-500/10 text-emerald-400",
  blue:    "bg-blue-500/10 text-blue-400",
  purple:  "bg-purple-500/10 text-purple-400",
  orange:  "bg-orange-500/10 text-orange-400",
  pink:    "bg-pink-500/10 text-pink-400",
  red:     "bg-red-500/10 text-red-400",
};

// ─── Particle config ──────────────────────────────────────────────────────────
const PARTICLES = [
  { top: "18%", left: "12%",  size: 5, delay: 0,   dur: 3.5, color: "#10b981", anim: "floatY" },
  { top: "65%", left: "7%",   size: 3, delay: 1.2, dur: 4.2, color: "#6366f1", anim: "floatXY" },
  { top: "28%", right: "10%", size: 4, delay: 0.6, dur: 3.8, color: "#10b981", anim: "floatY" },
  { top: "72%", right: "14%", size: 3, delay: 1.8, dur: 5,   color: "#22d3ee", anim: "floatXY" },
  { top: "48%", left: "48%",  size: 2, delay: 0.9, dur: 4.5, color: "#a78bfa", anim: "floatY" },
  { top: "12%", right: "32%", size: 3, delay: 2.1, dur: 3.2, color: "#10b981", anim: "floatXY" },
  { top: "85%", left: "38%",  size: 2, delay: 1.5, dur: 4.8, color: "#34d399", anim: "floatY" },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const { lang, setLang }         = useLang();
  const [menuOpen, setMenuOpen]   = useState(false);
  const [scrolled, setScrolled]   = useState(false);
  const [waitlistEmail, setWaitlistEmail]   = useState("");
  const [waitlistLoading, setWaitlistLoading] = useState(false);
  const [waitlistStatus, setWaitlistStatus]   = useState<"idle" | "success" | "duplicate">("idle");
  const [openFaq, setOpenFaq]     = useState<number | null>(null);

  const T = t[lang];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  async function handleWaitlist(e: React.FormEvent) {
    e.preventDefault();
    if (!waitlistEmail.trim()) return;
    setWaitlistLoading(true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: waitlistEmail.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        setWaitlistStatus(data.isNew ? "success" : "duplicate");
        setWaitlistEmail("");
      }
    } catch {
      /* silent fail — show success anyway */
      setWaitlistStatus("success");
      setWaitlistEmail("");
    } finally {
      setWaitlistLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen text-slate-200 overflow-x-hidden"
      style={{
        fontFamily: "var(--font-geist-sans)",
        background: "linear-gradient(135deg, #0f1117 0%, #1a1f35 50%, #0f1117 100%)",
      }}
    >

      {/* ── Background grid + orbs ── */}
      <div className="fixed inset-0 pointer-events-none z-0" aria-hidden>
        <div className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(rgba(16,185,129,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,0.03) 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />
        <div className="absolute top-[-20%] left-[10%]  w-[600px] h-[600px] rounded-full bg-emerald-500/5  blur-[120px]" />
        <div className="absolute top-[30%]  right-[-10%] w-[500px] h-[500px] rounded-full bg-blue-500/5    blur-[120px]" />
        <div className="absolute bottom-[10%] left-[30%] w-[400px] h-[400px] rounded-full bg-purple-500/4  blur-[100px]" />
        <div className="absolute top-[55%]  left-[-5%]  w-[300px] h-[300px] rounded-full bg-indigo-500/4   blur-[80px]" />
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* NAVBAR                                                                */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <header className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? "bg-[#0f1117]/90 backdrop-blur-xl border-b border-white/5" : ""}`}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-sm font-bold text-black shadow-lg shadow-emerald-500/30">
              TG
            </div>
            <span className="font-bold text-white text-lg tracking-tight">TradeGuard</span>
          </Link>

          {/* Nav links — desktop */}
          <nav className="hidden md:flex items-center gap-8">
            {([["#features", T.nav.features], ["#how", T.nav.how], ["#pricing", T.nav.pricing], ["#waitlist", T.nav.waitlist]] as [string, string][]).map(([href, label]) => (
              <a key={href} href={href} className="text-sm text-slate-400 hover:text-white transition-colors">
                {label}
              </a>
            ))}
          </nav>

          {/* Right side */}
          <div className="hidden md:flex items-center gap-3">
            {/* Language toggle */}
            <button
              onClick={() => setLang(lang === "ru" ? "en" : "ru")}
              className="flex items-center gap-1 text-xs font-semibold border border-white/10 hover:border-white/25 rounded-lg px-3 py-1.5 transition-colors text-slate-400 hover:text-white"
            >
              <span className={lang === "ru" ? "text-white" : "text-slate-600"}>RU</span>
              <span className="text-slate-700 mx-0.5">/</span>
              <span className={lang === "en" ? "text-white" : "text-slate-600"}>EN</span>
            </button>
            <Link href="/login" className="text-sm text-slate-400 hover:text-white transition-colors px-4 py-2">
              {T.nav.login}
            </Link>
            <Link
              href="/login"
              className="text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-black px-5 py-2 rounded-lg transition-colors shadow-lg shadow-emerald-500/20"
            >
              {T.nav.cta}
            </Link>
          </div>

          {/* Mobile: lang toggle + menu btn */}
          <div className="md:hidden flex items-center gap-2">
            <button
              onClick={() => setLang(lang === "ru" ? "en" : "ru")}
              className="text-xs font-semibold border border-white/10 rounded-lg px-2.5 py-1.5 text-slate-400"
            >
              {lang === "ru" ? "EN" : "RU"}
            </button>
            <button onClick={() => setMenuOpen(!menuOpen)} className="text-slate-400 hover:text-white p-1">
              {menuOpen ? "✕" : "☰"}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden bg-[#0d1117] border-t border-white/5 px-6 py-4 space-y-3">
            {([["#features", T.nav.features], ["#how", T.nav.how], ["#pricing", T.nav.pricing], ["#waitlist", T.nav.waitlist]] as [string, string][]).map(([href, label]) => (
              <a key={href} href={href} onClick={() => setMenuOpen(false)} className="block text-sm text-slate-400 py-2">
                {label}
              </a>
            ))}
            <Link href="/login" className="block w-full text-center text-sm font-semibold bg-emerald-500 text-black px-5 py-2.5 rounded-lg mt-2">
              {T.nav.cta}
            </Link>
          </div>
        )}
      </header>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* HERO                                                                  */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section className="relative z-10 pt-40 pb-24 px-6 overflow-hidden">
        {/* Animated particles */}
        {PARTICLES.map((p, i) => (
          <div
            key={i}
            className="absolute rounded-full pointer-events-none"
            style={{
              top: p.top,
              left: ("left" in p ? p.left : undefined),
              right: ("right" in p ? p.right : undefined),
              width:  p.size * 4 + "px",
              height: p.size * 4 + "px",
              backgroundColor: p.color,
              animation: `${p.anim} ${p.dur}s ease-in-out ${p.delay}s infinite`,
              boxShadow: `0 0 ${p.size * 6}px ${p.color}60`,
            }}
          />
        ))}

        <div className="max-w-5xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-medium text-emerald-400 tracking-wide">{T.hero.badge}</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-black text-white leading-[1.05] tracking-tight mb-6">
            {T.hero.h1a}<br />
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
              {T.hero.h1b}
            </span>
          </h1>

          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            {T.hero.sub}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/login"
              className="group relative inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-8 py-4 rounded-xl text-base transition-all shadow-2xl shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:scale-105"
            >
              {T.hero.cta1}
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </Link>
            <a
              href="#how"
              className="inline-flex items-center gap-2 text-slate-300 hover:text-white border border-white/10 hover:border-white/20 px-8 py-4 rounded-xl text-base transition-all hover:bg-white/5"
            >
              {T.hero.cta2}
              <span className="text-slate-500">↓</span>
            </a>
          </div>

          <div className="mt-8 flex items-center justify-center gap-6 text-xs text-slate-600">
            <span className="flex items-center gap-1.5"><span className="text-emerald-500">✓</span> {T.hero.trust1}</span>
            <span className="flex items-center gap-1.5"><span className="text-emerald-500">✓</span> {T.hero.trust2}</span>
            <span className="flex items-center gap-1.5"><span className="text-emerald-500">✓</span> {T.hero.trust3}</span>
          </div>
        </div>

        {/* Dashboard preview */}
        <div className="max-w-6xl mx-auto mt-20 relative">
          <div className="absolute inset-x-20 top-10 h-40 bg-emerald-500/10 blur-3xl rounded-full" />

          <div className="relative rounded-2xl border border-white/10 bg-[#0d1117] overflow-hidden shadow-2xl shadow-black/60">
            {/* Browser bar */}
            <div className="flex items-center gap-2 px-4 py-3 bg-[#161b27] border-b border-white/5">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/60" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/60" />
              </div>
              <div className="flex-1 mx-4 bg-white/5 rounded px-3 py-1 text-[11px] text-slate-500 text-center">
                {T.preview.url}
              </div>
            </div>

            {/* Mini dashboard */}
            <div className="flex h-[420px]">
              {/* Mini sidebar */}
              <div className="w-44 bg-[#161b27] border-r border-white/5 p-3 shrink-0">
                <div className="flex items-center gap-2 px-2 py-3 mb-3">
                  <div className="w-6 h-6 rounded bg-emerald-500 flex items-center justify-center text-[9px] font-bold text-black">TG</div>
                  <span className="text-xs font-semibold text-white">TradeGuard</span>
                </div>
                {(["◼","📊","🛡","⚠","⚙"] as const).map((icon, i) => (
                  <div key={i} className={`flex items-center gap-2 px-2 py-2 rounded-lg mb-0.5 text-[11px] ${i === 0 ? "bg-emerald-500/10 text-emerald-400" : "text-slate-500"}`}>
                    <span className="text-xs">{icon}</span>{T.preview.sidebar[i]}
                  </div>
                ))}
              </div>

              {/* Mini content */}
              <div className="flex-1 p-4 overflow-hidden">
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2.5 mb-3 flex items-center gap-2">
                  <span className="text-red-400 text-xs">🚨</span>
                  <span className="text-[10px] text-red-400 font-medium">{T.preview.alert}</span>
                </div>

                <div className="grid grid-cols-4 gap-2 mb-3">
                  {(["-$1 240","-$3 800","7 / 10","$46 200"] as const).map((v, i) => (
                    <div key={i} className="bg-[#1e2534] border border-white/5 rounded-lg p-2">
                      <p className="text-[8px] text-slate-500 mb-1">{T.preview.statLabels[i]}</p>
                      <p className={`text-xs font-bold ${["text-red-400","text-yellow-400","text-blue-400","text-emerald-400"][i]}`}>{v}</p>
                    </div>
                  ))}
                </div>

                <div className="bg-[#1e2534] border border-white/5 rounded-lg p-3 mb-3">
                  <p className="text-[9px] text-slate-500 mb-2">P&L</p>
                  <svg viewBox="0 0 400 60" className="w-full h-12" preserveAspectRatio="none">
                    <path d="M0,30 C40,30 60,10 100,8 S160,12 190,14 S240,5 270,4 S310,20 340,30 S370,45 400,50"
                      fill="none" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round"/>
                    <path d="M0,30 C40,30 60,10 100,8 S160,12 190,14 S240,5 270,4 S310,20 340,30 L340,60 L0,60Z" fill="url(#gGrad)"/>
                    <defs>
                      <linearGradient id="gGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.2"/>
                        <stop offset="100%" stopColor="#10b981" stopOpacity="0"/>
                      </linearGradient>
                    </defs>
                    <path d="M340,30 S370,45 400,50 L400,30 L340,30Z" fill="rgba(239,68,68,0.1)"/>
                  </svg>
                </div>

                <div className="bg-[#1e2534] border border-white/5 rounded-lg overflow-hidden">
                  <div className="grid grid-cols-4 gap-0 border-b border-white/5 px-3 py-1.5">
                    {T.preview.cols.map(h => <span key={h} className="text-[8px] text-slate-600">{h}</span>)}
                  </div>
                  {(["EURUSD","BTCUSD","XAUUSD"] as const).map((sym, i) => (
                    <div key={sym} className="grid grid-cols-4 px-3 py-1.5 border-b border-white/[0.03] last:border-0">
                      <span className="text-[9px] font-semibold text-white">{sym}</span>
                      <span className={`text-[9px] ${i === 1 ? "text-red-400" : "text-emerald-400"}`}>{i === 1 ? "SHORT" : "LONG"}</span>
                      <span className={`text-[9px] font-mono ${["-$440","+$115","-$290"][i].startsWith("+") ? "text-emerald-400" : "text-red-400"}`}>{["-$440","+$115","-$290"][i]}</span>
                      <span className="text-[9px] text-slate-500">{T.preview.statuses[i]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Floating badges */}
          <div className="absolute -left-4 top-1/3 bg-[#161b27] border border-white/10 rounded-xl p-3 shadow-2xl hidden md:flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center text-base">🚨</div>
            <div>
              <p className="text-[10px] font-semibold text-white">{T.preview.breach}</p>
              <p className="text-[9px] text-slate-500">{T.preview.breachSub}</p>
            </div>
          </div>
          <div className="absolute -right-4 bottom-1/3 bg-[#161b27] border border-white/10 rounded-xl p-3 shadow-2xl hidden md:flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-base">✅</div>
            <div>
              <p className="text-[10px] font-semibold text-white">{T.preview.confirmed}</p>
              <p className="text-[9px] text-slate-500">{T.preview.confirmedSub}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* PAIN SECTION                                                          */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section className="relative z-10 py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold text-red-400 uppercase tracking-widest mb-3">😔</p>
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4">{T.painTitle}</h2>
            <p className="text-slate-400 max-w-xl mx-auto">{T.painSub}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {T.pains.map((p) => (
              <div key={p.title} className="group bg-[#0d1117] border border-red-500/10 hover:border-red-500/25 rounded-2xl p-5 transition-all">
                <div className="flex items-start gap-4">
                  <span className="text-3xl shrink-0 mt-0.5">{p.icon}</span>
                  <div>
                    <h3 className="text-sm font-bold text-white mb-1.5">{p.title}</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">{p.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {/* Bridge text */}
          <div className="mt-12 text-center">
            <div className="inline-flex items-center gap-3 bg-emerald-500/5 border border-emerald-500/15 rounded-2xl px-8 py-5">
              <span className="text-2xl">💡</span>
              <p className="text-sm text-slate-300 text-left max-w-md">
                <span className="font-bold text-white">{lang === "ru" ? "TradeGuard не изменит твою стратегию." : "TradeGuard won't change your strategy."}</span>{" "}
                {lang === "ru"
                  ? "Он изменит твоё поведение. И именно это сделает тебя прибыльным."
                  : "It will change your behavior. And that's what will make you profitable."}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* STATS                                                                 */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section className="relative z-10 py-16 border-y border-white/5">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <p className="text-4xl md:text-5xl font-black text-white mb-2"><Counter to={500} suffix="+" /></p>
            <p className="text-sm text-slate-500">{T.stats[0].label}</p>
          </div>
          <div>
            <p className="text-4xl md:text-5xl font-black text-emerald-400 mb-2">AES-256</p>
            <p className="text-sm text-slate-500">{T.stats[1].label}</p>
          </div>
          <div>
            <p className="text-4xl md:text-5xl font-black text-white mb-2">24/7</p>
            <p className="text-sm text-slate-500">{T.stats[2].label}</p>
          </div>
          <div>
            <p className="text-4xl md:text-5xl font-black text-white mb-2">
              {"< "}<Counter to={3} suffix={lang === "ru" ? " мин" : " min"} />
            </p>
            <p className="text-sm text-slate-500">{T.stats[3].label}</p>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* FEATURES                                                              */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section id="features" className="relative z-10 py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold text-emerald-400 uppercase tracking-widest mb-3">{T.featuresBadge}</p>
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4">{T.featuresTitle}</h2>
            <p className="text-slate-400 max-w-xl mx-auto">{T.featuresSub}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {T.features.map((f) => (
              <div key={f.title} className={`group relative bg-[#0d1117] border rounded-2xl p-6 transition-all duration-300 hover:shadow-2xl ${glowColors[f.glow]}`}>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-5 ${iconBg[f.glow]}`}>{f.icon}</div>
                <h3 className="text-base font-bold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* HOW IT WORKS                                                          */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section id="how" className="relative z-10 py-28 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-3">{T.howBadge}</p>
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4">{T.howTitle}</h2>
            <p className="text-slate-400">{T.howSub}</p>
          </div>
          <div className="space-y-6">
            {T.steps.map((s) => (
              <div key={s.num} className="flex gap-6 items-start group">
                <div className="shrink-0 w-16 h-16 rounded-2xl bg-[#0d1117] border border-white/10 group-hover:border-emerald-500/30 flex items-center justify-center transition-colors">
                  <span className="text-2xl font-black text-emerald-500/40 group-hover:text-emerald-400 transition-colors font-mono">{s.num}</span>
                </div>
                <div className="flex-1 pt-2">
                  <h3 className="text-lg font-bold text-white mb-2">{s.title}</h3>
                  <p className="text-slate-400 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* PRICING                                                               */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section id="pricing" className="relative z-10 py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold text-purple-400 uppercase tracking-widest mb-3">{T.pricingBadge}</p>
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4">{T.pricingTitle}</h2>
            <p className="text-slate-400">{T.pricingSub}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {T.pricing.map((p) => (
              <div key={p.name} className={`relative rounded-2xl p-7 transition-all ${p.highlight ? "bg-gradient-to-b from-emerald-500/10 to-[#0d1117] border-2 border-emerald-500/40 shadow-2xl shadow-emerald-500/10" : "bg-[#0d1117] border border-white/10"}`}>
                {p.highlight && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-emerald-500 text-black text-[10px] font-bold px-4 py-1 rounded-full tracking-wide">
                    {T.pricingPopular}
                  </div>
                )}
                <h3 className="text-lg font-bold text-white mb-1">{p.name}</h3>
                <p className="text-xs text-slate-500 mb-5">{p.desc}</p>
                <div className="mb-6">
                  <div className="flex items-end gap-1">
                    <span className="text-4xl font-black text-white">${p.price}</span>
                    {p.period && <span className="text-slate-500 text-sm mb-1">/{p.period}</span>}
                  </div>
                </div>
                <ul className="space-y-3 mb-7">
                  {p.features.map(f => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-slate-300">
                      <span className="w-4 h-4 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center text-[10px] shrink-0">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/login" className={`block w-full text-center py-3 rounded-xl text-sm font-semibold transition-all ${p.highlight ? "bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/20" : "bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10"}`}>
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* WAITLIST (replaces Testimonials)                                      */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section id="waitlist" className="relative z-10 py-28 px-6">
        <div className="max-w-3xl mx-auto text-center relative">
          <div className="absolute inset-0 bg-blue-500/5 blur-3xl rounded-full" />
          <div className="relative">
            <p className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-4">{T.waitlistBadge}</p>
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4">{T.waitlistTitle}</h2>
            <p className="text-slate-400 max-w-xl mx-auto mb-10">{T.waitlistSub}</p>

            {waitlistStatus === "idle" ? (
              <form onSubmit={handleWaitlist} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                <input
                  type="email"
                  value={waitlistEmail}
                  onChange={e => setWaitlistEmail(e.target.value)}
                  placeholder={T.waitlistPlaceholder}
                  required
                  className="flex-1 bg-[#161b27] border border-white/10 rounded-xl px-5 py-3.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/40 transition-colors"
                />
                <button
                  type="submit"
                  disabled={waitlistLoading || !waitlistEmail.trim()}
                  className="shrink-0 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-semibold px-7 py-3.5 rounded-xl text-sm transition-all shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:scale-105 whitespace-nowrap"
                >
                  {waitlistLoading ? "…" : T.waitlistCta}
                </button>
              </form>
            ) : (
              <div className="inline-flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl px-8 py-5 max-w-md mx-auto">
                <span className="text-2xl">🎉</span>
                <p className="text-sm font-semibold text-emerald-400 text-left">
                  {waitlistStatus === "success" ? T.waitlistSuccess : T.waitlistDuplicate}
                </p>
              </div>
            )}

            {/* Trust indicators */}
            <div className="mt-8 flex items-center justify-center gap-6 text-xs text-slate-600">
              <span className="flex items-center gap-1.5"><span className="text-emerald-500">✓</span> {lang === "ru" ? "Без спама" : "No spam"}</span>
              <span className="flex items-center gap-1.5"><span className="text-emerald-500">✓</span> {lang === "ru" ? "Отписка в 1 клик" : "Unsubscribe anytime"}</span>
              <span className="flex items-center gap-1.5"><span className="text-emerald-500">✓</span> {lang === "ru" ? "Ранний доступ" : "Early access"}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* CTA                                                                   */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section className="relative z-10 py-28 px-6">
        <div className="max-w-3xl mx-auto text-center relative">
          <div className="absolute inset-0 bg-emerald-500/5 blur-3xl rounded-full" />
          <div className="relative bg-gradient-to-b from-[#161b27] to-[#0d1117] border border-white/10 rounded-3xl p-14">
            <p className="text-xs font-semibold text-emerald-400 uppercase tracking-widest mb-4">{T.ctaBadge}</p>
            <h2 className="text-4xl md:text-5xl font-black text-white mb-5">{T.ctaTitle}</h2>
            <p className="text-slate-400 mb-10 text-lg leading-relaxed whitespace-pre-line">{T.ctaSub}</p>
            <Link href="/login" className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-10 py-4 rounded-xl text-base transition-all shadow-2xl shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:scale-105">
              {T.ctaBtn}
            </Link>
            <p className="text-xs text-slate-600 mt-6">{T.ctaFootnote}</p>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* FAQ                                                                   */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section id="faq" className="relative z-10 py-28 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold text-purple-400 uppercase tracking-widest mb-3">{T.faqBadge}</p>
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4">{T.faqTitle}</h2>
          </div>
          <div className="space-y-3">
            {T.faqItems.map((item, i) => (
              <FaqItem
                key={i}
                q={item.q}
                a={item.a}
                open={openFaq === i}
                onToggle={() => setOpenFaq(openFaq === i ? null : i)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* FOOTER                                                                */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <footer className="relative z-10 border-t border-white/5 py-12 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            <div className="col-span-2 md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center text-xs font-bold text-black">TG</div>
                <span className="font-bold text-white">TradeGuard</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed max-w-xs">{T.footer.desc}</p>
            </div>
            {T.footer.cols.map(col => (
              <div key={col.title}>
                <h4 className="text-xs font-semibold text-white uppercase tracking-widest mb-4">{col.title}</h4>
                <ul className="space-y-2.5">
                  {col.links.map(l => (
                    <li key={l.label}>
                      <a href={l.href} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-slate-600">{T.footer.copy}</p>
            <div className="flex gap-6">
              {T.footer.legal.map(l => (
                <Link key={l.label} href={l.href} className="text-xs text-slate-600 hover:text-slate-400 transition-colors">
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
