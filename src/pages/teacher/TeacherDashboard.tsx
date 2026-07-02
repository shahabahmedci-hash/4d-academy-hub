import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/shared/BottomNav";
import PageSkeleton from "@/components/shared/PageSkeleton";
import NotificationBell from "@/components/shared/NotificationBell";
import ThemeToggle from "@/components/shared/ThemeToggle";
import ProfileAvatar from "@/components/shared/ProfileAvatar";
import { useSignedAvatarUrl } from "@/hooks/useSignedAvatarUrl";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, BookOpen, ClipboardCheck, IndianRupee, FileText, LogOut, User, Users, Award } from "lucide-react";

const TeacherDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [profileIncomplete, setProfileIncomplete] = useState(false);
  const [stats, setStats] = useState({ classes: 0, students: 0, todaysClasses: 0 });
  const avatarUrl = useSignedAvatarUrl(avatarPath);

  useEffect(() => { init(); }, []);

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/"); return; }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, avatar_url, profile_completed")
      .eq("id", user.id)
      .single();
    setUserName(profile?.full_name || "");
    setAvatarPath(profile?.avatar_url || null);
    setProfileIncomplete(!profile?.profile_completed);

    const { data: teacher } = await supabase.from("teachers").select("id").eq("user_id", user.id).maybeSingle();
    if (teacher) {
      const { data: tc } = await supabase.from("teacher_classes").select("class_id").eq("teacher_id", teacher.id);
      const classIds = (tc || []).map((c) => c.class_id);

      let students = 0;
      let todays = 0;
      if (classIds.length > 0) {
        const [{ count: sc }, { count: tdc }] = await Promise.all([
          supabase.from("class_enrollments").select("id", { count: "exact", head: true }).in("class_id", classIds),
          supabase.from("classes").select("id", { count: "exact", head: true }).in("id", classIds).eq("day_of_week", new Date().getDay()),
        ]);
        students = sc || 0;
        todays = tdc || 0;
      }
      setStats({ classes: classIds.length, students, todaysClasses: todays });
    }
    setLoading(false);
  };

  const logout = async () => { await supabase.auth.signOut(); navigate("/"); };

  if (loading) return <PageSkeleton />;

  const tiles = [
    { label: "My Classes", icon: BookOpen, path: "/teacher/classes", color: "text-blue-500" },
    { label: "Mark Attendance", icon: ClipboardCheck, path: "/teacher/attendance", color: "text-green-500" },
    { label: "My Students", icon: Users, path: "/teacher/students", color: "text-purple-500" },
    { label: "Salary", icon: IndianRupee, path: "/teacher/salary", color: "text-amber-500" },
    { label: "Documents", icon: FileText, path: "/teacher/documents", color: "text-pink-500" },
    { label: "My Attendance", icon: Award, path: "/teacher/my-attendance", color: "text-cyan-500" },
    { label: "Profile", icon: User, path: "/teacher/profile", color: "text-indigo-500" },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/teacher/profile")} aria-label="Profile">
              <ProfileAvatar avatarUrl={avatarUrl} fullName={userName} className="h-10 w-10" />
            </button>
            <div>
              <h1 className="text-xl font-bold">Welcome, {userName}</h1>
              <p className="text-sm text-muted-foreground">Teacher Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={logout}><LogOut className="h-5 w-5" /></Button>
          </div>
        </div>
      </header>

      <main className="container max-w-5xl mx-auto px-4 py-6 space-y-6">
        {profileIncomplete && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between gap-3">
              <span>Please complete your profile (phone, address, emergency contact) to unlock all features.</span>
              <Button size="sm" variant="outline" onClick={() => navigate("/teacher/profile")}>
                Complete
              </Button>
            </AlertDescription>
          </Alert>
        )}
        <div className="grid grid-cols-3 gap-3">
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">My Classes</p><p className="text-2xl font-bold">{stats.classes}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Students</p><p className="text-2xl font-bold">{stats.students}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Today</p><p className="text-2xl font-bold">{stats.todaysClasses}</p></CardContent></Card>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {tiles.map((t) => (
            <Card key={t.path} className="cursor-pointer hover:bg-accent transition" onClick={() => navigate(t.path)}>
              <CardContent className="p-6 flex flex-col items-center gap-2">
                <t.icon className={`h-8 w-8 ${t.color}`} />
                <span className="font-medium text-center">{t.label}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
      <BottomNav role="teacher" />
    </div>
  );
};

export default TeacherDashboard;
