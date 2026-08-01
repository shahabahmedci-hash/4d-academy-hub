import { useEffect, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLocation } from "react-router-dom";
import { AD_CONFIG, isAdConfigured } from "@/lib/adConfig";
import { X } from "lucide-react";

interface AdBannerProps {
  className?: string;
  inline?: boolean;
}

const BOTTOM_NAV_ROUTES = ["/admin/", "/student/", "/teacher/"];

const AdBanner = ({ className = "", inline = false }: AdBannerProps) => {
  const isMobile = useIsMobile();
  const [dismissed, setDismissed] = useState(false);
  const [cycleKey, setCycleKey] = useState(0);
  const [filled, setFilled] = useState(false);
  const location = useLocation();

  const hasBottomNav = isMobile && BOTTOM_NAV_ROUTES.some((r) => location.pathname.startsWith(r));

  const config = isMobile ? AD_CONFIG.banner.mobile : AD_CONFIG.banner.desktop;
  const width = config.atOptions.width;
  const height = config.atOptions.height;
  const frameSrc = `/ad-frame.html?key=${encodeURIComponent(config.atOptions.key)}&w=${width}&h=${height}`;

  // Listen for fill status from the ad frame
  useEffect(() => {
    setFilled(false);
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data && e.data.type === "ad-frame-status" && e.data.filled) setFilled(true);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [isMobile, dismissed, cycleKey]);

  // Auto-close timer (disabled when autoCloseSeconds is 0)
  useEffect(() => {
    if (dismissed || !AD_CONFIG.autoCloseSeconds) return;
    const timer = setTimeout(() => setDismissed(true), AD_CONFIG.autoCloseSeconds * 1000);
    return () => clearTimeout(timer);
  }, [dismissed, cycleKey]);

  // Cooldown: re-show after cooldownSeconds
  useEffect(() => {
    if (!dismissed) return;
    const timer = setTimeout(() => {
      setDismissed(false);
      setCycleKey((k) => k + 1);
    }, AD_CONFIG.cooldownSeconds * 1000);
    return () => clearTimeout(timer);
  }, [dismissed]);

  if (!AD_CONFIG.enabled || dismissed) return null;

  const configured = isAdConfigured();

  const placeholder = (
    <div
      className="flex items-center justify-center rounded border border-dashed border-border bg-muted/30 text-xs text-muted-foreground"
      style={{ width, height }}
    >
      Ad Space — Configure Adsterra keys
    </div>
  );

  const frame = (
    <iframe
      key={`${isMobile ? "m" : "d"}-${cycleKey}`}
      title="Advertisement"
      src={frameSrc}
      width={width}
      height={height}
      scrolling="no"
      frameBorder={0}
      style={{
        width,
        height,
        border: 0,
        display: "block",
        overflow: "hidden",
        background: "transparent",
        colorScheme: "normal",
      }}
    />
  );

  if (inline) {
    // Collapse entirely when the network returns no creative — no empty white strip.
    if (configured && !filled) {
      return (
        <div className="w-full overflow-hidden" style={{ height: 0 }}>
          {frame}
        </div>
      );
    }
    return (
      <div
        className={`flex items-center justify-center w-full overflow-hidden ${className}`}
        style={{ minHeight: height }}
      >
        {configured ? frame : placeholder}
      </div>
    );
  }

  return (
    <div
      className={`fixed left-0 right-0 z-40 flex items-center justify-center ${className}`}
      style={{
        bottom: hasBottomNav ? 64 : 0,
        display: !configured || filled ? undefined : "none",
      }}
    >
      <div className="relative">
        <div className="flex items-center justify-center overflow-hidden" style={{ minHeight: height }}>
          {configured ? frame : placeholder}
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-muted border border-border flex items-center justify-center text-muted-foreground hover:text-foreground"
          aria-label="Dismiss ad"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
};

export default AdBanner;
