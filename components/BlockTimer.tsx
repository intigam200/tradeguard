"use client";

import { useEffect, useState } from "react";

export function BlockTimer({ blockedUntil }: { blockedUntil: string | Date }) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const update = () => {
      const diff = new Date(blockedUntil).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft("00:00:00");
        window.location.reload();
        return;
      }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      setTimeLeft(
        `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
      );
    };
    update();
    const interval = setInterval(update, 1_000);
    return () => clearInterval(interval);
  }, [blockedUntil]);

  return <span className="font-mono text-red-400">{timeLeft}</span>;
}
