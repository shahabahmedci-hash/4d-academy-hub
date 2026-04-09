import { useEffect, useState, useMemo } from "react";
import BottomNav from "@/components/shared/BottomNav";
import PageSkeleton from "@/components/shared/PageSkeleton";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, IndianRupee, Trash2, Lock, Download } from "lucide-react";
import { exportToCSV, formatDateForExport } from "@/lib/csvExport";
import { useToast } from "@/hooks/use-toast";
import { AddFeeDialog } from "@/components/admin/AddFeeDialog";
import { useFinancialYearFreeze } from "@/hooks/useFinancialYearFreeze";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
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
  paid: "bg-green-500/10 text-green-500 border-green-500/20",
  pending: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  overdue: "bg-red-500/10 text-red-500 border-red-500/20",
};

const Fees = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const filterStudentId = searchParams.get("student_id");
  const { toast } = useToast();
  const [fees, setFees] = useState<Fee[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState<string | null>(null);
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
    if (!adminResult.data && !coAdminResult.data) navigate("/");
  };

  const loadFees = async () => {
    try {
      let feesQuery = supabase.from("fees").select("*").order("due_date", { ascending: false });
      if (filterStudentId) feesQuery = feesQuery.eq("student_id", filterStudentId);

      let studentsQuery = supabase.from("students").select("id, user_id");
      if (filterStudentId) studentsQuery = studentsQuery.eq("id", filterStudentId);

      const [feesRes, studentsRes] = await Promise.all([feesQuery, studentsQuery]);
      if (feesRes.error) throw feesRes.error;
      if (studentsRes.error) throw studentsRes.error;

      const students = studentsRes.data || [];
      const studentIds = new Set(students.map((s) => s.id));
      const studentFees = (feesRes.data || []).filter((f) => studentIds.has(f.student_id));

      const studentsById = Object.fromEntries(students.map((s) => [s.id, s]));
      const userIds = students.map((s) => s.user_id).filter(Boolean) as string[];

      let profilesById: Record<string, { full_name: string; email: string }> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", userIds);
        if (profiles) profilesById = Object.fromEntries(profiles.map((p) => [p.id, { full_name: p.full_name, email: p.email }]));
      }

      const composed: Fee[] = studentFees.map((f) => {
        const student = studentsById[f.student_id];
        const profile = student?.user_id ? profilesById[student.user_id] : undefined;
        return { ...f, studentName: profile?.full_name || "Unknown Student", studentEmail: profile?.email || "" };
      });

      setFees(composed);
      if (filterStudentId && composed.length > 0) setFilterStudentName(composed[0].studentName);
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

  const filteredFees = useMemo(() =>
    activeStatus ? fees.filter((f) => f.status === activeStatus) : fees,
    [fees, activeStatus]
  );

  const getStatusBadge = (status: string) => {
    const cls = STATUS_COLORS[status] || "";
    return <Badge variant="outline" className={cls}>{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>;
  };

  if (loading) return <PageSkeleton />;

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold">Fee Management</h1>
              {filterStudentName && <p className="text-xs text-muted-foreground">Filtered: {filterStudentName}</p>}
            </div>
          </div>
          <AddFeeDialog onFeeAdded={loadFees} />
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="cursor-pointer" onClick={() => setActiveStatus(activeStatus === "paid" ? null : "paid")}>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardDescription>Collected</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-lg font-bold text-green-500">₹{stats.totalCollected.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="cursor-pointer" onClick={() => setActiveStatus(activeStatus === "pending" ? null : "pending")}>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardDescription>Pending</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-lg font-bold text-yellow-500">₹{stats.totalPending.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="cursor-pointer" onClick={() => setActiveStatus(activeStatus === "overdue" ? null : "overdue")}>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardDescription>Overdue</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-lg font-bold text-red-500">₹{stats.totalOverdue.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>

        {/* Actions bar */}
        <div className="flex items-center gap-2 flex-wrap">
          {activeStatus && (
            <Button variant="outline" size="sm" onClick={() => setActiveStatus(null)}>Clear Filter</Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const data = filteredFees.map((f) => ({
                student_email: f.studentEmail,
                amount: Number(f.amount),
                due_date: formatDateForExport(f.due_date),
                paid_date: formatDateForExport(f.paid_date),
                status: f.status,
                payment_method: f.payment_method || "",
                notes: f.notes || "",
              }));
              exportToCSV(data, [
                { key: "student_email", label: "Student Email" },
                { key: "amount", label: "Amount" },
                { key: "due_date", label: "Due Date" },
                { key: "paid_date", label: "Paid Date" },
                { key: "status", label: "Status" },
                { key: "payment_method", label: "Payment Method" },
                { key: "notes", label: "Notes" },
              ], "fees-export");
            }}
          >
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
        </div>

        {/* Fee list */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Fee Records
            </CardTitle>
            <CardDescription>
              {activeStatus ? `Showing ${activeStatus} records (${filteredFees.length})` : `All records (${filteredFees.length})`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {filteredFees.map((fee) => (
              <Card key={fee.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{fee.studentName}</p>
                      <p className="text-xs text-muted-foreground">Due: {new Date(fee.due_date).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">₹{Number(fee.amount).toLocaleString()}</p>
                      {getStatusBadge(fee.status)}
                    </div>
                  </div>
                  {fee.paid_date && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Paid: {new Date(fee.paid_date).toLocaleDateString()}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-3">
                    {isDateFrozen(fee.due_date) ? (
                      <Badge variant="outline" className="text-muted-foreground"><Lock className="h-3 w-3 mr-1" /> Frozen</Badge>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            const newStatus = fee.status === "paid" ? "pending" : "paid";
                            const updateData: any = newStatus === "paid"
                              ? { status: newStatus, paid_date: new Date().toISOString() }
                              : { status: newStatus, paid_date: null };
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
                            <Button variant="destructive" size="sm"><Trash2 className="h-4 w-4" /></Button>
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
                              <AlertDialogAction onClick={async () => {
                                const { error } = await supabase.from("fees").delete().eq("id", fee.id);
                                if (error) {
                                  toast({ variant: "destructive", title: "Error", description: "Failed to delete fee record" });
                                } else {
                                  toast({ title: "Success", description: "Fee record deleted successfully" });
                                  loadFees();
                                }
                              }}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}

            {filteredFees.length === 0 && (
              <p className="text-center text-muted-foreground py-8">No fee records found</p>
            )}
          </CardContent>
        </Card>
      </div>

      <BottomNav role="admin" />
    </div>
  );
};

export default Fees;
