import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, IndianRupee, Calendar, TrendingUp, LogOut, Receipt, User, FileText, Archive, GraduationCap, ShieldCheck, Lock, ClipboardCheck, Zap } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/logo.png";
import NotificationBell from "@/components/shared/NotificationBell";
import ThemeToggle from "@/components/shared/ThemeToggle";
import BottomNav from "@/components/shared/BottomNav";
import AdBanner from "@/components/shared/AdBanner";
import { Skeleton } from "@/components/ui/skeleton";
import AIInsightsPanel from "@/components/admin/AIInsightsPanel";
import DashboardAutomationCard from "@/components/admin/DashboardAutomationCard";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [stats, setStats] = useState({
    totalStudents: 0,
    pendingFees: 0,
    todaysClasses: 0,
    pendingApprovals: 0,
  });

  useEffect(() => {
    const init = async () => {
      await checkAuth();
      await loadDashboardData();
    };
    init();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/"); return; }

      const [adminResult, coAdminResult] = await Promise.all([
        supabase.rpc("is_admin"),
        supabase.rpc("is_co_admin"),
      ]);

      if (!adminResult.data && !coAdminResult.data) {
        navigate("/student/dashboard");
        return;
      }

      setIsAdminUser(adminResult.data || false);

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

      setUserName(profile?.full_name || "");
      setUserId(user.id);
    } catch (error) {
      console.error("Error in checkAuth:", error);
      navigate("/");
    }
  };

  const loadDashboardData = async () => {
    try {
      const { data, error } = await supabase.rpc("get_admin_dashboard_stats");
      if (error) throw error;
      if (data && data.length > 0) {
        setStats({
          totalStudents: Number(data[0].total_students) || 0,
          pendingFees: Number(data[0].pending_fees) || 0,
          todaysClasses: Number(data[0].todays_classes) || 0,
          pendingApprovals: Number(data[0].pending_approvals) || 0,
        });
      }
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({ title: "Logged out", description: "You have been logged out successfully" });
    navigate("/");
  };

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const quickActions = [
    { label: "Manage Students", icon: Users, path: "/admin/students" },
    { label: "Manage Teachers", icon: GraduationCap, path: "/admin/teachers" },
    ...(isAdminUser ? [{ label: "Manage Co-Admins", icon: ShieldCheck, path: "/admin/co-admins" }] : []),
    { label: "Fee Management", icon: IndianRupee, path: "/admin/fees" },
    { label: "Salaries", icon: Receipt, path: "/admin/salaries" },
    { label: "Expenses", icon: Receipt, path: "/admin/expenses" },
    { label: "Teacher Attendance", icon: ClipboardCheck, path: "/admin/teacher-attendance" },
    { label: "Students Attendance", icon: ClipboardCheck, path: "/admin/attendance" },
    { label: "Class Schedule", icon: Calendar, path: "/admin/classes" },
    { label: "Analytics", icon: TrendingUp, path: "/admin/analytics" },
    { label: "User Approvals", icon: Users, path: "/admin/approvals" },
    { label: "Documents", icon: FileText, path: "/admin/documents" },
    { label: "Financial Years", icon: Lock, path: "/admin/financial-years" },
    { label: "Automation Engine", icon: Zap, path: "/admin/automations" },
    { label: "Archived Profiles", icon: Archive, path: "/admin/archived" },
    { label: "My Profile", icon: User, path: userId ? `/admin/profile/${userId}` : "#" },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <img src={logo} alt="4D Academy" className="w-8 h-8" />
            <div>
              <h1 className="text-lg font-bold text-foreground">4D Academy</h1>
              <p className="text-xs text-muted-foreground">Welcome, {userName}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <ThemeToggle />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon"><LogOut className="h-5 w-5" /></Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Logout</AlertDialogTitle>
                  <AlertDialogDescription>Are you sure you want to logout?</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleLogout}>Logout</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardDescription className="flex items-center gap-1"><Users className="h-4 w-4" /> Total Students</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-2xl font-bold">{stats.totalStudents}</p>
              <p className="text-xs text-muted-foreground">Enrolled students</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardDescription className="flex items-center gap-1"><IndianRupee className="h-4 w-4" /> Pending Fees</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-2xl font-bold">{stats.pendingFees}</p>
              <p className="text-xs text-muted-foreground">Payments due</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardDescription className="flex items-center gap-1"><Calendar className="h-4 w-4" /> Today's Classes</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-2xl font-bold">{stats.todaysClasses}</p>
              <p className="text-xs text-muted-foreground">Scheduled today</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardDescription className="flex items-center gap-1"><Users className="h-4 w-4" /> Pending Approvals</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-2xl font-bold">{stats.pendingApprovals}</p>
              <p className="text-xs text-muted-foreground">Awaiting approval</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
            <CardDescription>Manage your tuition center</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {quickActions.map((action) => (
                <Button
                  key={action.label}
                  variant="outline"
                  className="h-auto flex-col gap-2 py-4"
                  onClick={() => navigate(action.path)}
                >
                  <action.icon className="h-5 w-5" />
                  <span className="text-xs text-center">{action.label}</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <DashboardAutomationCard />
        <AIInsightsPanel />
      </div>

      <BottomNav role="admin" />
      <AdBanner />
    </div>
  );
};

export default AdminDashboard;
