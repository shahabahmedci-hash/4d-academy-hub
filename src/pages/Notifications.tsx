import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/shared/BottomNav";
import PageSkeleton from "@/components/shared/PageSkeleton";
import ThemeToggle from "@/components/shared/ThemeToggle";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Bell, CheckCheck, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
  user_id: string;
}

const Notifications = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [role, setRole] = useState<"admin" | "student" | "teacher">("student");

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const userRole = profile?.role as string | undefined;
    if (userRole === "admin" || userRole === "co_admin") setRole("admin");
    else if (userRole === "teacher") setRole("teacher");
    else setRole("student");

    await loadNotifications(user.id);

    const channel = supabase
      .channel("notifications-page")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => loadNotifications(user.id)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const loadNotifications = async (userId: string) => {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setNotifications(data || []);
    }
    setLoading(false);
  };

  const markAsRead = async (id: string) => {
    const { error } = await supabase.from("notifications").update({ read: true }).eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    }
  };

  const markAllAsRead = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      toast({ title: "All notifications marked as read" });
    }
  };

  const dashboardPath =
    role === "admin" ? "/admin/dashboard" : role === "teacher" ? "/teacher/dashboard" : "/student/dashboard";

  const unreadCount = notifications.filter((n) => !n.read).length;

  if (loading) return <PageSkeleton />;

  const typeColor = (type: string) => {
    switch (type) {
      case "success":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "warning":
        return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      case "error":
        return "bg-destructive/10 text-destructive border-destructive/20";
      default:
        return "bg-primary/10 text-primary border-primary/20";
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => navigate(dashboardPath)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-xl font-bold truncate">Notifications</h1>
              <p className="text-sm text-muted-foreground">
                {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" onClick={markAllAsRead}>
                <CheckCheck className="h-4 w-4 mr-1" />
                Mark all
              </Button>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container max-w-3xl mx-auto px-4 py-6 space-y-3">
        {notifications.length === 0 ? (
          <Card>
            <CardContent className="p-12 flex flex-col items-center gap-3 text-center">
              <Bell className="h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">No notifications yet</p>
            </CardContent>
          </Card>
        ) : (
          notifications.map((n) => (
            <Card
              key={n.id}
              className={`cursor-pointer transition hover:bg-accent ${!n.read ? "border-primary/40" : ""}`}
              onClick={() => !n.read && markAsRead(n.id)}
            >
              <CardContent className="p-4 flex items-start gap-3">
                <div className={`h-10 w-10 rounded-full border flex items-center justify-center shrink-0 ${typeColor(n.type)}`}>
                  <Bell className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className={`font-medium ${!n.read ? "font-semibold" : ""}`}>{n.title}</h3>
                    {!n.read && <Badge variant="default" className="text-[10px]">New</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{n.message}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </main>
      <BottomNav role={role} />
    </div>
  );
};

export default Notifications;
