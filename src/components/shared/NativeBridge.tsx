import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { PushNotifications } from "@capacitor/push-notifications";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/use-toast";

export default function NativeBridge() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    void StatusBar.setStyle({ style: Style.Default });
    void StatusBar.setBackgroundColor({ color: "#0891b2" });
    void SplashScreen.hide();

    const handles = [
      CapacitorApp.addListener("backButton", ({ canGoBack }) => {
        if (canGoBack && location.pathname !== "/" && location.pathname !== "/auth") navigate(-1);
        else void CapacitorApp.exitApp();
      }),
      PushNotifications.addListener("pushNotificationReceived", (notification) => {
        toast({ title: notification.title || "New notification", description: notification.body });
      }),
      PushNotifications.addListener("pushNotificationActionPerformed", () => navigate("/notifications")),
      PushNotifications.addListener("registrationError", () => console.warn("Native push registration failed")),
    ];

    const registerPush = async () => {
      const current = await PushNotifications.checkPermissions();
      const permission = current.receive === "prompt" ? await PushNotifications.requestPermissions() : current;
      if (permission.receive === "granted") await PushNotifications.register();
    };
    void registerPush();

    return () => { void Promise.all(handles.map(async (handle) => (await handle).remove())); };
  }, [location.pathname, navigate]);

  return null;
}