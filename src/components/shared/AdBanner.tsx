import { useEffect, useRef, useState } from "react";
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
  const containerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const [dismissed, setDismissed] = useState(false);
  const [cycleKey, setCycleKey] = useState(0);
  const [adLoaded, setAdLoaded] = useState(false);
  const location = useLocation();

  const hasBottomNav = isMobile && BOTTOM_NAV_ROUTES.some((r) => location.pathname.startsWith(r));

  // Load ad script whenever cycleKey changes (and not dismissed)
  useEffect(() => {
    if (!AD_CONFIG.enabled || dismissed || !containerRef.current || !isAdConfigured()) return;

    setAdLoaded(false);

    const container = containerRef.current;
    container.innerHTML = "";

    const config = isMobile ? AD_CONFIG.banner.mobile : AD_CONFIG.banner.desktop;

    const optionsScript = document.createElement("script");
    optionsScript.type = "text/javascript";
    optionsScript.text = `atOptions = ${JSON.stringify(config.atOptions)};`;
    container.appendChild(optionsScript);

    const invokeScript = document.createElement("script");
    invokeScript.type = "text/javascript";
    invokeScript.src = config.scriptSrc;
    invokeScript.async = true;
    container.appendChild(invokeScript);

    const observer = new MutationObserver(() => {
      if (container.querySelector("iframe") || container.querySelector("ins") || container.querySelector("img")) {
        setAdLoaded(true);
        observer.disconnect();
      }
    });
    observer.observe(container, { childList: true, subtree: true });

    const timeout = setTimeout(() => {
      observer.disconnect();
    }, 5000);

    return () => {
      observer.disconnect();
      clearTimeout(timeout);
    };
  }, [isMobile, dismissed, cycleKey]);

  // Auto-close timer (disabled when autoCloseSeconds is 0)
  useEffect(() => {
    if (dismissed || !AD_CONFIG.autoCloseSeconds) return;
    const timer = setTimeout(() => {
      setDismissed(true);
    }, AD_CONFIG.autoCloseSeconds * 1000);
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

  if (inline) {
    return (
      <div
        ref={containerRef}
        className={`flex items-center justify-center w-full overflow-hidden ${className}`}
        style={{ minHeight: isMobile ? 50 : 90 }}
      >
        {!isAdConfigured() && (
          <div
            className="flex items-center justify-center rounded border border-dashed border-border bg-muted/30 text-xs text-muted-foreground"
            style={{ width: isMobile ? 320 : 728, height: isMobile ? 50 : 90 }}
          >
            Ad Space — Configure Adsterra keys in adConfig.ts
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`fixed left-0 right-0 z-40 flex items-center justify-center ${className}`}
      style={{ bottom: hasBottomNav ? 64 : 0, display: adLoaded ? undefined : "none" }}
    >
      <div className="relative">
        <div
          ref={containerRef}
          className="flex items-center justify-center overflow-hidden"
          style={{ minHeight: 50 }}
        >
          {!isAdConfigured() && (
            <div
              className="flex items-center justify-center rounded border border-dashed border-border bg-muted/30 text-xs text-muted-foreground"
              style={{ width: 320, height: 50 }}
            >
              Ad Space — Configure Adsterra keys
            </div>
          )}
        </div>
        {adLoaded && (
          <button
            onClick={() => setDismissed(true)}
            className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-muted border border-border flex items-center justify-center text-muted-foreground hover:text-foreground"
            aria-label="Dismiss ad"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
};

export default AdBanner;
