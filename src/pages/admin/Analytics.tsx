import { useEffect, useState } from "react";
import BottomNav from "@/components/shared/BottomNav";
import PageSkeleton from "@/components/shared/PageSkeleton";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingUp, Users, IndianRupee, BookOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import AIInsightsPanel from "@/components/admin/AIInsightsPanel";

const Analytics = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState({
    totalStudents: 0,
    totalRevenue: 0,
    totalExpenses: 0,
    totalClasses: 0,
    averageAttendance: 0,
    pendingAssignments: 0,
  });

  useEffect(() => {
    const init = async () => {
      await checkAuth();
      await loadAnalytics();
    };
    init();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/");
      return;
    }

    const [adminResult, coAdminResult] = await Promise.all([
      supabase.rpc("is_admin"),
      supabase.rpc("is_co_admin")
    ]);
    
    if (!adminResult.data && !coAdminResult.data) {
      navigate("/student/dashboard");
    }
  };

  const loadAnalytics = async () => {
    try {
      const { data: dashStats } = await supabase.rpc("get_admin_dashboard_stats");
      const totalStudents = dashStats?.[0]?.total_students || 0;

      const { data: paidFees } = await supabase
        .from("fees")
        .select("amount")
        .eq("status", "paid");

      const totalRevenue = paidFees?.reduce((sum, fee) => sum + Number(fee.amount), 0) || 0;

      const { data: expenses } = await supabase
        .from("expenses")
        .select("amount");

      const totalExpenses = expenses?.reduce((sum, exp) => sum + Number(exp.amount), 0) || 0;

      const { count: classCount } = await supabase
        .from("classes")
        .select("*", { count: "exact", head: true });

      const { count: presentCount } = await supabase
        .from("attendance")
        .select("*", { count: "exact", head: true })
        .eq("status", "present");

      const { count: totalAttendance } = await supabase
        .from("attendance")
        .select("*", { count: "exact", head: true });

      const averageAttendance = totalAttendance ? (presentCount! / totalAttendance) * 100 : 0;

      const { count: pendingAssignments } = await supabase
        .from("assignments")
        .select("*", { count: "exact", head: true })
        .gt("due_date", new Date().toISOString());

      setAnalytics({
        totalStudents,
        totalRevenue,
        totalExpenses,
        totalClasses: classCount || 0,
        averageAttendance,
        pendingAssignments: pendingAssignments || 0,
      });
    } catch (error) {
      console.error("Error loading analytics:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load analytics data",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
              <p className="text-sm text-muted-foreground">Business insights and AI-powered recommendations</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Quick Stats */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Students</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.totalStudents}</div>
              <p className="text-xs text-muted-foreground">Active enrollments</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ₹{(analytics.totalRevenue - analytics.totalExpenses).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">Revenue - Expenses</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Average Attendance</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.averageAttendance.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">Student participation</p>
            </CardContent>
          </Card>
        </div>

        {/* AI Insights */}
        <AIInsightsPanel />
      </main>
      <BottomNav role="admin" />
      <div className="h-16 md:hidden" />
    </div>
  );
};

export default Analytics;
