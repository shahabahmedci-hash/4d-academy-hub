import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/shared/BottomNav";
import PageSkeleton from "@/components/shared/PageSkeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, IndianRupee, Download } from "lucide-react";
import { useProfileCompletionGate } from "@/hooks/useProfileCompletionGate";
import { generateReceipt } from "@/lib/generateReceipt";

interface Fee {
  id: string;
  amount: number;
  due_date: string;
  status: string;
  paid_date: string | null;
  payment_method: string | null;
  notes: string | null;
}

const StudentFees = () => {
  const navigate = useNavigate();
  const { loading: gateLoading, profileCompleted } = useProfileCompletionGate();
  const [fees, setFees] = useState<Fee[]>([]);
  const [studentName, setStudentName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profileCompleted) load();
  }, [profileCompleted]);

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/"); return; }

    const [{ data: profile }, { data: student }] = await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
      supabase.from("students").select("id").eq("user_id", user.id).maybeSingle(),
    ]);
    setStudentName(profile?.full_name || "Student");
    if (!student) { setLoading(false); return; }

    const { data } = await supabase
      .from("fees")
      .select("*")
      .eq("student_id", student.id)
      .order("due_date", { ascending: false });
    setFees(data || []);
    setLoading(false);
  };

  const handleDownload = async (f: Fee) => {
    await generateReceipt({
      feeId: f.id,
      studentName,
      amount: Number(f.amount),
      dueDate: f.due_date,
      paidDate: f.paid_date || new Date().toISOString(),
      paymentMethod: f.payment_method,
      notes: f.notes,
    });
    navigate("/preview-download");
  };

  if (gateLoading || loading) return <PageSkeleton />;

  const pending = fees.filter((f) => f.status === "pending").reduce((s, f) => s + Number(f.amount), 0);
  const paid = fees.filter((f) => f.status === "paid").reduce((s, f) => s + Number(f.amount), 0);

  const statusVariant = (s: string): "default" | "destructive" | "secondary" =>
    s === "paid" ? "default" : s === "overdue" ? "destructive" : "secondary";

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/student/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <IndianRupee className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">My Fees</h1>
        </div>
      </header>

      <main className="container max-w-5xl mx-auto px-4 py-6 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Pending</p><p className="text-2xl font-bold text-amber-600">₹{pending.toLocaleString()}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Paid</p><p className="text-2xl font-bold text-green-600">₹{paid.toLocaleString()}</p></CardContent></Card>
        </div>

        {fees.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">No fee records.</CardContent></Card>
        ) : (
          <div className="space-y-2">
            {fees.map((f) => (
              <Card key={f.id}>
                <CardHeader className="pb-2 flex flex-row items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">₹{Number(f.amount).toLocaleString()}</CardTitle>
                    <p className="text-sm text-muted-foreground">Due: {new Date(f.due_date).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={statusVariant(f.status)}>{f.status}</Badge>
                    {f.status === "paid" && (
                      <Button size="icon" variant="ghost" onClick={() => handleDownload(f)} title="Download receipt">
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                {(f.paid_date || f.notes) && (
                  <CardContent className="text-sm text-muted-foreground space-y-1">
                    {f.paid_date && <p>Paid on {new Date(f.paid_date).toLocaleDateString()} {f.payment_method && `(${f.payment_method})`}</p>}
                    {f.notes && <p>{f.notes}</p>}
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}
      </main>
      <BottomNav role="student" />
    </div>
  );
};

export default StudentFees;
