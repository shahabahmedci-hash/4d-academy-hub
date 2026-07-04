import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/shared/BottomNav";
import AdBanner from "@/components/shared/AdBanner";
import PageSkeleton from "@/components/shared/PageSkeleton";
import NotificationBell from "@/components/shared/NotificationBell";
import ThemeToggle from "@/components/shared/ThemeToggle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Calendar, ClipboardCheck, IndianRupee, FileText, LogOut, User, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const StudentDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [profileCompleted, setProfileCompleted] = useState(true);
  const [stats, setStats] = useState({ pendingFees: 0, attendanceRate: 0, todaysClasses: 0 });

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/"); return; }

    const [{ data: isAdmin }, { data: isCoAdmin }, { data: isTeacher }] = await Promise.all([
      supabase.rpc("is_admin"),
      supabase.rpc("is_co_admin"),
      supabase.rpc("is_teacher"),
    ]);
    if (isAdmin || isCoAdmin) { navigate("/admin/dashboard"); return; }
    if (isTeacher) { navigate("/teacher/dashboard"); return; }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, approved, archived, profile_completed")
      .eq("id", user.id)
      .single();

    if (!profile?.approved || profile?.archived) {
      toast({ title: "Pending approval", description: "Your account is awaiting admin approval.", variant: "destructive" });
      await supabase.auth.signOut();
      navigate("/");
      return;
    }

    setUserName(profile?.full_name || "");
    setProfileCompleted(!!profile?.profile_completed);

    const { data: student } = await supabase
      .from("students")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (student) {
      const [feesRes, attRes, enrollRes] = await Promise.all([
        supabase.from("fees").select("id", { count: "exact", head: true }).eq("student_id", student.id).eq("status", "pending"),
        supabase.from("attendance").select("status").eq("student_id", student.id),
        supabase.from("class_enrollments").select("class_id").eq("student_id", student.id),
      ]);

      const att = attRes.data || [];
      const present = att.filter((a) => a.status === "present").length;
      const rate = att.length > 0 ? Math.round((present / att.length) * 100) : 0;

      const classIds = (enrollRes.data || []).map((e) => e.class_id);
      let todays = 0;
      if (classIds.length > 0) {
        const dow = new Date().getDay();
        const { count } = await supabase
          .from("classes")
          .select("id", { count: "exact", head: true })
          .in("id", classIds)
          .eq("day_of_week", dow);
        todays = count || 0;
      }

      setStats({ pendingFees: feesRes.count || 0, attendanceRate: rate, todaysClasses: todays });
    }
    setLoading(false);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading) return <PageSkeleton />;

  const tiles = [
    { label: "Schedule", icon: Calendar, path: "/student/schedule", color: "text-blue-500", gated: true },
    { label: "Attendance", icon: ClipboardCheck, path: "/student/attendance", color: "text-green-500", gated: true },
    { label: "Fees", icon: IndianRupee, path: "/student/fees", color: "text-amber-500", gated: true },
    { label: "Documents", icon: FileText, path: "/student/documents", color: "text-purple-500", gated: true },
    { label: "Profile", icon: User, path: "/student/profile", color: "text-cyan-500", gated: false },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Welcome, {userName}</h1>
            <p className="text-sm text-muted-foreground">Student Portal</p>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={logout}><LogOut className="h-5 w-5" /></Button>
          </div>
        </div>
      </header>

      <main className="container max-w-5xl mx-auto px-4 py-6 space-y-6">
        {!profileCompleted && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Your profile is incomplete. Please complete your{" "}
              <button className="underline font-medium" onClick={() => navigate("/student/profile")}>profile</button>
              {" "}to unlock the rest of the portal.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-3 gap-3">
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Pending Fees</p><p className="text-2xl font-bold">{stats.pendingFees}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Attendance</p><p className="text-2xl font-bold">{stats.attendanceRate}%</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Today's Classes</p><p className="text-2xl font-bold">{stats.todaysClasses}</p></CardContent></Card>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {tiles.map((t) => {
            const disabled = t.gated && !profileCompleted;
            return (
              <Card
                key={t.path}
                className={`transition ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-accent"}`}
                onClick={() => {
                  if (disabled) {
                    toast({ title: "Complete your profile first", description: "Finish required fields on your profile." });
                    return;
                  }
                  navigate(t.path);
                }}
              >
                <CardContent className="p-6 flex flex-col items-center gap-2">
                  <t.icon className={`h-8 w-8 ${t.color}`} />
                  <span className="font-medium">{t.label}</span>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>
      <BottomNav role="student" />
      <AdBanner />
    </div>
  );
};

export default StudentDashboard;
