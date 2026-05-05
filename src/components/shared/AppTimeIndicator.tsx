import { useEffect, useMemo, useState } from "react";

const formatIST = (date: Date) => {
  const time = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(date);

  const day = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);

  return { time, day };
};

const AppTimeIndicator = () => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const { time, day } = useMemo(() => formatIST(now), [now]);

  return (
    <div className="pointer-events-none fixed left-1/2 top-0 z-[9999] -translate-x-1/2">
      <div className="flex items-center gap-1.5 rounded-b-lg border border-t-0 border-border bg-card/95 px-3 py-0.5 shadow-sm backdrop-blur-sm sm:px-4 sm:py-1">
        <span className="font-mono text-[11px] font-semibold text-foreground sm:text-xs">{time}</span>
        <span className="text-[10px] text-muted-foreground sm:text-[11px]">·</span>
        <span className="text-[10px] text-muted-foreground sm:text-[11px]">{day}</span>
      </div>
    </div>
  );
};

export default AppTimeIndicator;