import { useEffect, useMemo, useRef, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLocation } from "react-router-dom";
import { AD_CONFIG, isAdConfigured } from "@/lib/adConfig";
import { X } from "lucide-react";

interface AdBannerProps {
  className?: string;
  inline?: boolean;
}

const BOTTOM_NAV_ROUTES = ["/admin/", "/student/", "/teacher/"];

const normalizeSrc = (src: string) => (src.startsWith("//") ? `https:${src}` : src);

const buildSrcDoc = (atOptions: Record<string, unknown>, scriptSrc: string) => `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8" /></head>
  <body style="margin:0;padding:0;overflow:hidden;background:transparent">
    <script type="text/javascript">var atOptions = ${JSON.stringify(atOptions)};</script>
    <script type="text/javascript" src="${normalizeSrc(scriptSrc)}"></script>
  </body>
</html>`;

const AdBanner = ({ className = "", inline = false }: AdBannerProps) => {
  const isMobile = useIsMobile();
  const [dismissed, setDismissed] = useState(false);
  const [cycleKey, setCycleKey] = useState(0);
  const [adLoaded, setAdLoaded] = useState(false);
  const location = useLocation();
  const fallbackTimer = useRef<ReturnType<typeof setTimeout>>();

  const hasBottomNav = isMobile && BOTTOM_NAV_ROUTES.some((r) => location.pathname.startsWith(r));

  const config = isMobile ? AD_CONFIG.banner.mobile : AD_CONFIG.banner.desktop;
  const width = config.atOptions.width;
  const height = config.atOptions.height;

  const srcDoc = useMemo(
    () => buildSrcDoc(config.atOptions as unknown as Record<string, unknown>, config.scriptSrc),
    [config]
  );

  // Reset load state on each cycle / breakpoint change, with a timeout fallback
  // so the fixed banner is never hidden forever if onLoad never fires.
  useEffect(() => {
    setAdLoaded(false);
    fallbackTimer.current = setTimeout(() => setAdLoaded(true), 4000);
    return () => clearTimeout(fallbackTimer.current);
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
      srcDoc={srcDoc}
      width={width}
      height={height}
      scrolling="no"
      frameBorder={0}
      onLoad={() => {
        clearTimeout(fallbackTimer.current);
        setAdLoaded(true);
      }}
      style={{ width, height, border: 0, display: "block", overflow: "hidden" }}
    />
  );

  if (inline) {
    return (
      <div
        className={`flex items-center justify-center w-full overflow-hidden ${className}`}
        style={{ minHeight: height }}
      >
        {isAdConfigured() ? frame : placeholder}
      </div>
    );
  }

  return (
    <div
      className={`fixed left-0 right-0 z-40 flex items-center justify-center ${className}`}
      style={{ bottom: hasBottomNav ? 64 : 0, display: adLoaded || !isAdConfigured() ? undefined : "none" }}
    >
      <div className="relative">
        <div className="flex items-center justify-center overflow-hidden" style={{ minHeight: height }}>
          {isAdConfigured() ? frame : placeholder}
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
