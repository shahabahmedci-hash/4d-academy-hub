import { useEffect, useState, useMemo } from "react";
import BottomNav from "@/components/shared/BottomNav";
import PageSkeleton from "@/components/shared/PageSkeleton";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, IndianRupee, Trash2, Lock, Download, Bell, FileDown } from "lucide-react";
import { exportToCSV, formatDateForExport } from "@/lib/csvExport";
import { useToast } from "@/hooks/use-toast";
import { AddFeeDialog } from "@/components/admin/AddFeeDialog";
import { ImportFeesDialog } from "@/components/admin/ImportFeesDialog";
import { generateReceipt } from "@/lib/generateReceipt";
import FinancePieChart from "@/components/admin/FinancePieChart";
import FinanceMonthlyBreakdown from "@/components/admin/FinanceMonthlyBreakdown";
import { useFinancialYearFreeze } from "@/hooks/useFinancialYearFreeze";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Fee {
  id: string;
  student_id: string;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: string;
  notes: string | null;
  payment_method: string | null;
  studentName: string;
  studentEmail: string;
}

const STATUS_COLORS: Record<string, string> = {
  paid: "#10B981",
  pending: "#F59E0B",
  overdue: "#EF4444",
};

const Fees = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const filterStudentId = searchParams.get("student_id");
  const { toast } = useToast();
  const [fees, setFees] = useState<Fee[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState<string | null>(null);
  const [sendingReminders, setSendingReminders] = useState(false);
  const [filterStudentName, setFilterStudentName] = useState<string | null>(null);
  const { isDateFrozen } = useFinancialYearFreeze();

  useEffect(() => {
    const init = async () => {
      await checkAuth();
      await loadFees();
    };
    init();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/"); return; }
    const [adminResult, coAdminResult] = await Promise.all([
      supabase.rpc("is_admin"),
      supabase.rpc("is_co_admin"),
    ]);
    if (!adminResult.data && !coAdminResult.data) navigate("/student/dashboard");
  };

  const loadFees = async () => {
    try {
      // Fetch fees and students in parallel
      let feesQuery = supabase.from("fees").select("*").order("due_date", { ascending: false });
      if (filterStudentId) feesQuery = feesQuery.eq("student_id", filterStudentId);

      let studentsQuery = supabase.from("students").select("id, user_id");
      if (filterStudentId) studentsQuery = studentsQuery.eq("id", filterStudentId);

      const [feesRes, studentsRes] = await Promise.all([feesQuery, studentsQuery]);

      if (feesRes.error) throw feesRes.error;
      if (studentsRes.error) throw studentsRes.error;

      const students = studentsRes.data || [];
      const studentIds = new Set(students.map((s) => s.id));

      // Filter fees to only students
      const studentFees = (feesRes.data || []).filter((f) => studentIds.has(f.student_id));

      // Get profile names for student user_ids
      const studentsById = Object.fromEntries(students.map((s) => [s.id, s]));
      const userIds = students.map((s) => s.user_id).filter(Boolean) as string[];

      let profilesById: Record<string, { full_name: string; email: string }> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", userIds)
          .eq("role", "student");

        if (profiles) {
          profilesById = Object.fromEntries(profiles.map((p) => [p.id, { full_name: p.full_name, email: p.email }]));
        }
      }

      const composed: Fee[] = studentFees.map((f) => {
        const student = studentsById[f.student_id];
        const profile = student?.user_id ? profilesById[student.user_id] : undefined;
        return { ...f, studentName: profile?.full_name || "Unknown Student", studentEmail: profile?.email || "" };
      });

      setFees(composed);
      if (filterStudentId && composed.length > 0) {
        setFilterStudentName(composed[0].studentName);
      }
    } catch (error) {
      console.error("Error loading fees:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to load fee records" });
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const collected = fees.filter((f) => f.status === "paid").reduce((s, f) => s + Number(f.amount), 0);
    const pending = fees.filter((f) => f.status === "pending").reduce((s, f) => s + Number(f.amount), 0);
    const overdue = fees.filter((f) => f.status === "overdue").reduce((s, f) => s + Number(f.amount), 0);
    return { totalCollected: collected, totalPending: pending, totalOverdue: overdue };
  }, [fees]);

  const pieData = useMemo(() => [
    { name: "Paid", key: "paid", value: stats.totalCollected, color: STATUS_COLORS.paid },
    { name: "Pending", key: "pending", value: stats.totalPending, color: STATUS_COLORS.pending },
    { name: "Overdue", key: "overdue", value: stats.totalOverdue, color: STATUS_COLORS.overdue },
  ], [stats]);

  const monthlyRecords = useMemo(() =>
    fees.map((f) => ({
      date: f.due_date,
      amount: Number(f.amount),
      groupKey: f.status,
    })),
  [fees]);

  const filteredFees = useMemo(() =>
    activeStatus ? fees.filter((f) => f.status === activeStatus) : fees,
  [fees, activeStatus]);

  const handleSliceClick = (key: string) => {
    setActiveStatus((prev) => (prev === key ? null : key));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid": return <Badge className="bg-green-500">Paid</Badge>;
      case "pending": return <Badge className="bg-yellow-500">Pending</Badge>;
      case "overdue": return <Badge className="bg-red-500">Overdue</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  if (loading) {
    return <PageSkeleton />;
  }

  const handleSendReminders = async () => {
    setSendingReminders(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-fee-reminders");
      if (error) throw error;
      toast({
        title: "Reminders Sent",
        description: `${data?.sent || 0} fee reminder(s) sent to students.`,
      });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message || "Failed to send reminders" });
    } finally {
      setSendingReminders(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => filterStudentId ? navigate(`/admin/students/${filterStudentId}`) : navigate("/admin/dashboard")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold">
                  Fee Management{filterStudentName ? ` — ${filterStudentName}` : ""}
                </h1>
                <p className="text-sm text-muted-foreground">Track and manage student payments</p>
              </div>
            </div>
            <Button variant="outline" onClick={handleSendReminders} disabled={sendingReminders}>
              <Bell className="h-4 w-4 mr-2" />
              {sendingReminders ? "Sending..." : "Send Reminders"}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6 md:grid-cols-3 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Collected</CardTitle>
              <IndianRupee className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{stats.totalCollected.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Total collected</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <IndianRupee className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{stats.totalPending.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Awaiting payment</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Overdue</CardTitle>
              <IndianRupee className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{stats.totalOverdue.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Past due date</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2 mb-8">
          <FinancePieChart
            data={pieData}
            title="Fee Status Breakdown"
            activeKey={activeStatus}
            onSliceClick={handleSliceClick}
          />
          <FinanceMonthlyBreakdown
            records={monthlyRecords}
            activeKey={activeStatus}
            title="Monthly Fee Trends"
            barColor="hsl(217, 91%, 60%)"
          />
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle>Fee Records</CardTitle>
                <CardDescription>
                  {activeStatus
                    ? `Showing ${activeStatus} records (${filteredFees.length})`
                    : `All student payment records (${filteredFees.length})`}
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {activeStatus && (
                  <Button variant="outline" size="sm" onClick={() => setActiveStatus(null)}>
                    Clear Filter
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const data = filteredFees.map((f) => ({
                      id: f.id,
                      student_email: f.studentEmail,
                      amount: Number(f.amount),
                      due_date: formatDateForExport(f.due_date),
                      paid_date: formatDateForExport(f.paid_date),
                      status: f.status,
                      payment_method: f.payment_method || "",
                      notes: f.notes || "",
                    }));
                    exportToCSV(data, [
                      { key: "id", label: "id" },
                      { key: "student_email", label: "student_email" },
                      { key: "amount", label: "amount" },
                      { key: "due_date", label: "due_date" },
                      { key: "paid_date", label: "paid_date" },
                      { key: "status", label: "status" },
                      { key: "payment_method", label: "payment_method" },
                      { key: "notes", label: "notes" },
                    ], "fees-export");
                    navigate("/preview-download");
                  }}
                >
                  <FileDown className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
                <ImportFeesDialog onFeesImported={loadFees} />
                <AddFeeDialog onFeeAdded={loadFees} />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredFees.map((fee) => (
                <div
                  key={fee.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
                >
                  <div className="flex-1">
                    <p className="font-medium">{fee.studentName}</p>
                    <p className="text-sm text-muted-foreground">
                      Due: {new Date(fee.due_date).toLocaleDateString()}
                    </p>
                  </div>
                    <div className="flex items-center gap-4 mt-2 sm:mt-0">
                      <div className="text-right">
                        <p className="font-bold">₹{Number(fee.amount).toLocaleString()}</p>
                        {fee.paid_date && (
                          <p className="text-xs text-muted-foreground">
                            Paid: {new Date(fee.paid_date).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      {getStatusBadge(fee.status)}
                      {fee.status === "paid" && fee.paid_date && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Download Receipt"
                          onClick={async () => {
                            await generateReceipt({
                              feeId: fee.id,
                              studentName: fee.studentName,
                              amount: Number(fee.amount),
                              dueDate: fee.due_date,
                              paidDate: fee.paid_date!,
                              paymentMethod: fee.payment_method,
                              notes: fee.notes,
                            });
                            navigate("/preview-download");
                          }}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                      {isDateFrozen(fee.due_date) ? (
                        <Badge variant="outline" className="gap-1"><Lock className="h-3 w-3" />Frozen</Badge>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            onClick={async () => {
                              const newStatus = fee.status === "paid" ? "pending" : "paid";
                              const updateData: any = newStatus === "paid"
                                ? { status: newStatus as "paid", paid_date: new Date().toISOString() }
                                : { status: newStatus as "pending", paid_date: null };

                              const { error } = await supabase.from("fees").update(updateData).eq("id", fee.id);
                              if (error) {
                                toast({ variant: "destructive", title: "Error", description: "Failed to update fee status" });
                              } else {
                                toast({ title: "Success", description: `Fee marked as ${newStatus}` });
                                loadFees();
                              }
                            }}
                          >
                            {fee.status === "paid" ? "Mark as Unpaid" : "Mark as Paid"}
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Fee Record</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete this fee record for {fee.studentName} (₹{Number(fee.amount).toLocaleString()})? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={async () => {
                                    const { error } = await supabase.from("fees").delete().eq("id", fee.id);
                                    if (error) {
                                      toast({ variant: "destructive", title: "Error", description: "Failed to delete fee record" });
                                    } else {
                                      toast({ title: "Success", description: "Fee record deleted successfully" });
                                      loadFees();
                                    }
                                  }}
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
                  </div>
                </div>
              ))}
            </div>
            {filteredFees.length === 0 && (
              <p className="text-center text-muted-foreground py-8">No fee records found</p>
            )}
          </CardContent>
        </Card>
      </main>
      <BottomNav role="admin" />
      <div className="h-16 md:hidden" />
    </div>
  );
};

export default Fees;
