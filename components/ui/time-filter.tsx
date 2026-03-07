"use client";

export type TimeRange = "today" | "week" | "month" | "3months" | "all";

const OPTIONS: { key: TimeRange; en: string; ru: string }[] = [
  { key: "today",   en: "Today",    ru: "День"    },
  { key: "week",    en: "Week",     ru: "Неделя"  },
  { key: "month",   en: "Month",    ru: "Месяц"   },
  { key: "3months", en: "3 Months", ru: "3 мес."  },
  { key: "all",     en: "All Time", ru: "Всё"     },
];

export function getDateRange(range: TimeRange): { from: Date; to: Date } {
  const to  = new Date();
  const from = new Date();

  switch (range) {
    case "today":
      from.setUTCHours(0, 0, 0, 0);
      break;
    case "week":
      from.setUTCDate(from.getUTCDate() - 7);
      from.setUTCHours(0, 0, 0, 0);
      break;
    case "month":
      from.setUTCDate(1);
      from.setUTCHours(0, 0, 0, 0);
      break;
    case "3months":
      from.setUTCMonth(from.getUTCMonth() - 3);
      from.setUTCHours(0, 0, 0, 0);
      break;
    case "all":
    default:
      from.setFullYear(2020, 0, 1);
      from.setUTCHours(0, 0, 0, 0);
  }

  return { from, to };
}

interface Props {
  value: TimeRange;
  onChange: (v: TimeRange) => void;
  lang?: "en" | "ru";
  compact?: boolean;
}

export function TimeFilter({ value, onChange, lang = "en", compact = false }: Props) {
  const opts = compact ? OPTIONS.slice(0, 3) : OPTIONS;

  return (
    <div className="flex gap-1 bg-white/[0.03] border border-white/5 rounded-lg p-1">
      {opts.map(opt => (
        <button
          key={opt.key}
          onClick={() => onChange(opt.key)}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
            value === opt.key
              ? "bg-white/10 text-white"
              : "text-slate-500 hover:text-slate-300"
          }`}
        >
          {lang === "en" ? opt.en : opt.ru}
        </button>
      ))}
    </div>
  );
}
