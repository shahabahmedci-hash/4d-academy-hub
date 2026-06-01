import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/shared/BottomNav";
import PageSkeleton from "@/components/shared/PageSkeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download } from "lucide-react";
import { useTeacherProfileGate } from "@/hooks/useTeacherProfileGate";
import { generateSalaryReceipt } from "@/lib/generateSalaryReceipt";

const TeacherSalary = () => {
  const navigate = useNavigate();
  const { loading: gateLoading, profileCompleted } = useTeacherProfileGate();
  const [loading, setLoading] = useState(true);
  const [salaries, setSalaries] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => { if (profileCompleted) load(); }, [profileCompleted]);

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/"); return; }
    const [{ data: p }, { data: teacher }] = await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", user.id).single(),
      supabase.from("teachers").select("id").eq("user_id", user.id).maybeSingle(),
    ]);
    setProfile(p);
    if (teacher) {
      const { data } = await supabase.from("teacher_salaries").select("*").eq("teacher_id", teacher.id).order("created_at", { ascending: false });
      setSalaries(data || []);
    }
    setLoading(false);
  };

  const handleDownload = async (s: any) => {
    await generateSalaryReceipt({
      salaryId: s.id,
      teacherName: profile?.full_name || "Teacher",
      amount: Number(s.amount),
      month: s.month,
      paidDate: s.paid_date || s.created_at,
      paymentMethod: s.payment_method,
      notes: s.notes,
    });
    navigate("/preview-download");
  };

  if (gateLoading || loading) return <PageSkeleton />;
  const totalPaid = salaries.filter((s) => s.status === "paid").reduce((sum, s) => sum + Number(s.amount), 0);
  const pending = salaries.filter((s) => s.status === "pending").reduce((sum, s) => sum + Number(s.amount), 0);

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/teacher/dashboard")}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="text-lg font-bold">Salary History</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Paid</p><p className="text-xl font-bold">₹{totalPaid.toLocaleString()}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Pending</p><p className="text-xl font-bold">₹{pending.toLocaleString()}</p></CardContent></Card>
        </div>

        {salaries.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">No salary records</CardContent></Card>
        ) : (
          salaries.map((s) => (
            <Card key={s.id}>
              <CardContent className="p-4 flex justify-between items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{new Date(s.month).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</p>
                  <p className="text-xs text-muted-foreground">{s.paid_date ? `Paid on ${new Date(s.paid_date).toLocaleDateString()}` : "Pending"}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold">₹{Number(s.amount).toLocaleString()}</p>
                  <Badge variant={s.status === "paid" ? "default" : "secondary"}>{s.status}</Badge>
                </div>
                {s.status === "paid" && (
                  <Button size="icon" variant="ghost" onClick={() => handleDownload(s)} title="Download receipt">
                    <Download className="h-4 w-4" />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
      <BottomNav role="teacher" />
    </div>
  );
};

export default TeacherSalary;
