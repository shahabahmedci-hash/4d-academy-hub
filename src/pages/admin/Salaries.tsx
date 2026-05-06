import { useEffect, useState, useCallback } from "react";
import BottomNav from "@/components/shared/BottomNav";
import PageSkeleton from "@/components/shared/PageSkeleton";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, IndianRupee, CheckCircle, Clock, Trash2, Lock, FileDown, Download } from "lucide-react";
import { generateSalaryReceipt } from "@/lib/generateSalaryReceipt";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import logo from "@/assets/4d-academy-logo.jpg";
import FinancePieChart from "@/components/admin/FinancePieChart";
import FinanceMonthlyBreakdown from "@/components/admin/FinanceMonthlyBreakdown";
import { useFinancialYearFreeze } from "@/hooks/useFinancialYearFreeze";
import { exportToCSV, formatDateForExport } from "@/lib/csvExport";
import { ImportSalariesDialog } from "@/components/admin/ImportSalariesDialog";

interface Teacher {
  id: string;
  user_id: string;
  employee_id: string | null;
  designation: string | null;
  profile: {
    full_name: string;
    email: string;
  } | null;
}

interface Salary {
  id: string;
  teacher_id: string;
  amount: number;
  month: string;
  paid_date: string | null;
  status: string;
  payment_method: string | null;
  notes: string | null;
  expense_id: string | null;
  teacher: Teacher | null;
}

const Salaries = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const filterTeacherId = searchParams.get("teacher_id");
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [salaries, setSalaries] = useState<Salary[]>([]);
  const [filterTeacherName, setFilterTeacherName] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { isDateFrozen } = useFinancialYearFreeze();
  
  // Form state
  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [amount, setAmount] = useState("");
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const [notes, setNotes] = useState("");
  const [activeStatus, setActiveStatus] = useState<string | null>(null);
  const [deletingSalaryId, setDeletingSalaryId] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
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
        return;
      }

      await Promise.all([loadTeachers(), loadSalaries()]);
    } catch (error) {
      console.error("Error:", error);
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const loadTeachers = async () => {
    const { data: teacherData } = await supabase
      .from("teachers")
      .select("id, user_id, employee_id, designation");

    if (teacherData) {
      const userIds = teacherData.map(t => t.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);

      const teachersWithProfiles = teacherData.map(teacher => ({
        ...teacher,
        profile: profiles?.find(p => p.id === teacher.user_id) || null
      }));

      setTeachers(teachersWithProfiles);
    }
  };

  const loadSalaries = async () => {
    let query = supabase
      .from("teacher_salaries")
      .select("*")
      .order("month", { ascending: false });
    if (filterTeacherId) query = query.eq("teacher_id", filterTeacherId);
    const { data } = await query;

    if (data) {
      // Get teacher info for each salary
      const teacherIds = [...new Set(data.map(s => s.teacher_id))];
      const { data: teacherData } = await supabase
        .from("teachers")
        .select("id, user_id, employee_id, designation")
        .in("id", teacherIds);

      const userIds = teacherData?.map(t => t.user_id) || [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);

      const salariesWithTeachers = data.map(salary => ({
        ...salary,
        teacher: teacherData?.find(t => t.id === salary.teacher_id) ? {
          ...teacherData.find(t => t.id === salary.teacher_id)!,
          profile: profiles?.find(p => p.id === teacherData.find(t => t.id === salary.teacher_id)?.user_id) || null
        } : null
      }));

      setSalaries(salariesWithTeachers);
      if (filterTeacherId && salariesWithTeachers.length > 0) {
        const t = salariesWithTeachers[0].teacher;
        if (t?.profile?.full_name) setFilterTeacherName(t.profile.full_name);
      }
    }
  };

  const handleAddSalary = async () => {
    if (!selectedTeacher || !amount || !month) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please fill in all required fields",
      });
      return;
    }

    // Check freeze
    if (isDateFrozen(`${month}-01`)) {
      toast({ variant: "destructive", title: "Frozen Period", description: "This month belongs to a frozen financial year" });
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("teacher_salaries")
        .insert({
          teacher_id: selectedTeacher,
          amount: parseFloat(amount),
          month: `${month}-01`,
          status: "pending",
          notes,
          created_by: user?.id
        });

      if (error) {
        if (error.code === "23505") {
          toast({
            variant: "destructive",
            title: "Error",
            description: "Salary entry for this teacher and month already exists",
          });
        } else {
          throw error;
        }
        return;
      }

      toast({
        title: "Success",
        description: "Salary entry added successfully",
      });

      setDialogOpen(false);
      resetForm();
      await loadSalaries();
    } catch (error) {
      console.error("Error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add salary entry",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleMarkPaid = async (salaryId: string, teacherName: string, amount: number, month: string) => {
    if (isDateFrozen(month)) {
      toast({ variant: "destructive", title: "Frozen Period", description: "This salary belongs to a frozen financial year" });
      return;
    }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Create expense entry
      const { data: expense, error: expenseError } = await supabase
        .from("expenses")
        .insert({
          category: "other" as const,
          description: `Salary payment to ${teacherName} for ${format(new Date(month), "MMMM yyyy")}`,
          amount,
          date: new Date().toISOString().split("T")[0],
          created_by: user?.id
        })
        .select()
        .single();

      if (expenseError) throw expenseError;

      // Update salary record
      const { error: salaryError } = await supabase
        .from("teacher_salaries")
        .update({
          status: "paid",
          paid_date: new Date().toISOString().split("T")[0],
          expense_id: expense.id
        })
        .eq("id", salaryId);

      if (salaryError) throw salaryError;

      toast({
        title: "Success",
        description: "Salary marked as paid and added to expenses",
      });

      await loadSalaries();
    } catch (error) {
      console.error("Error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to mark salary as paid",
      });
    }
  };

  const handleDeleteSalary = async (salary: Salary) => {
    if (isDateFrozen(salary.month)) {
      toast({ variant: "destructive", title: "Frozen Period", description: "This salary belongs to a frozen financial year" });
      return;
    }
    try {
      // If paid, also delete the linked expense
      if (salary.status === "paid" && salary.expense_id) {
        await supabase.from("expenses").delete().eq("id", salary.expense_id);
      }
      const { error } = await supabase.from("teacher_salaries").delete().eq("id", salary.id);
      if (error) throw error;
      toast({ title: "Success", description: "Salary record deleted successfully" });
      await loadSalaries();
    } catch (error) {
      console.error("Error:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to delete salary record" });
    }
  };

  const resetForm = () => {
    setSelectedTeacher("");
    setAmount("");
    setMonth(format(new Date(), "yyyy-MM"));
    setNotes("");
  };

  const totalPending = salaries
    .filter(s => s.status === "pending")
    .reduce((sum, s) => sum + Number(s.amount), 0);

  const totalPaidThisMonth = salaries
    .filter(s => s.status === "paid" && s.paid_date?.startsWith(format(new Date(), "yyyy-MM")))
    .reduce((sum, s) => sum + Number(s.amount), 0);

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => filterTeacherId ? navigate(`/admin/teachers/${filterTeacherId}`) : navigate("/admin/dashboard")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <img src={logo} alt="4D Academy" className="h-10" />
              <div>
                <h1 className="text-xl font-bold">
                  Salary Management{filterTeacherName ? ` — ${filterTeacherName}` : ""}
                </h1>
                <p className="text-sm text-muted-foreground">Manage teacher salaries</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const data = salaries.map((s) => ({
                    id: s.id,
                    teacher_email: s.teacher?.profile?.email || "",
                    employee_id: s.teacher?.employee_id || "",
                    amount: Number(s.amount),
                    month: format(new Date(s.month), "yyyy-MM"),
                    status: s.status,
                    paid_date: formatDateForExport(s.paid_date),
                    payment_method: s.payment_method || "",
                    notes: s.notes || "",
                  }));
                  exportToCSV(data, [
                    { key: "id", label: "id" },
                    { key: "teacher_email", label: "teacher_email" },
                    { key: "employee_id", label: "employee_id" },
                    { key: "amount", label: "amount" },
                    { key: "month", label: "month" },
                    { key: "status", label: "status" },
                    { key: "paid_date", label: "paid_date" },
                    { key: "payment_method", label: "payment_method" },
                    { key: "notes", label: "notes" },
                  ], "salaries-export");
                  navigate("/preview-download");
                }}
                disabled={salaries.length === 0}
              >
                <FileDown className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <ImportSalariesDialog onSalariesImported={loadSalaries} />
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Salary
                  </Button>
                </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Salary Entry</DialogTitle>
                  <DialogDescription>Create a new salary record for a teacher</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Teacher *</Label>
                    <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select teacher" />
                      </SelectTrigger>
                      <SelectContent>
                        {teachers.map((teacher) => (
                          <SelectItem key={teacher.id} value={teacher.id}>
                            {teacher.profile?.full_name || "Unknown"} {teacher.employee_id && `(${teacher.employee_id})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Amount (₹) *</Label>
                    <Input
                      type="number"
                      placeholder="Enter amount"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Month *</Label>
                    <Input
                      type="month"
                      value={month}
                      onChange={(e) => setMonth(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea
                      placeholder="Optional notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleAddSalary} disabled={saving}>
                    {saving ? "Adding..." : "Add Salary"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Teachers</CardTitle>
              <IndianRupee className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{teachers.length}</div>
              <p className="text-xs text-muted-foreground">Registered teachers</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending Salaries</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">₹{totalPending.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Amount due</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Paid This Month</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">₹{totalPaidThisMonth.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Paid in {format(new Date(), "MMMM")}</p>
            </CardContent>
          </Card>
        </div>

        {/* Pie Chart + Monthly Breakdown */}
        <div className="grid gap-6 lg:grid-cols-2">
          <FinancePieChart
            title="Salaries by Status"
            data={(() => {
              const STATUS_COLORS: Record<string, string> = {
                paid: "hsl(142, 71%, 45%)",
                pending: "hsl(45, 93%, 47%)",
              };
              const counts: Record<string, number> = { paid: 0, pending: 0 };
              salaries.forEach((s) => {
                const key = s.status === "paid" ? "paid" : "pending";
                counts[key] += Number(s.amount);
              });
              return Object.entries(counts).map(([key, value]) => ({
                key,
                name: key.charAt(0).toUpperCase() + key.slice(1),
                value: Math.round(value),
                color: STATUS_COLORS[key],
              }));
            })()}
            activeKey={activeStatus}
            onSliceClick={(key) => setActiveStatus((prev) => (prev === key ? null : key))}
          />
          <FinanceMonthlyBreakdown
            title="Monthly Salary Trend"
            records={salaries.map((s) => ({
              date: s.month,
              amount: s.amount,
              groupKey: s.status === "paid" ? "paid" : "pending",
            }))}
            activeKey={activeStatus}
            barColor="hsl(271, 91%, 65%)"
          />
        </div>

        {/* Salary Records */}
        <Card>
          <CardHeader>
            <CardTitle>
              Salary Records
              {activeStatus && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  — {activeStatus.charAt(0).toUpperCase() + activeStatus.slice(1)}
                  <button onClick={() => setActiveStatus(null)} className="ml-2 text-xs text-primary underline">Clear</button>
                </span>
              )}
            </CardTitle>
            <CardDescription>All salary entries for teachers</CardDescription>
          </CardHeader>
          <CardContent>
            {salaries.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No salary records found</p>
            ) : (
              <div className="space-y-4">
                {(activeStatus ? salaries.filter((s) => (s.status === "paid" ? "paid" : "pending") === activeStatus) : salaries).map((salary) => (
                  <div
                    key={salary.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div>
                      <h3 className="font-medium">
                        {salary.teacher?.profile?.full_name || "Unknown Teacher"}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(salary.month), "MMMM yyyy")}
                      </p>
                      {salary.paid_date && (
                        <p className="text-xs text-muted-foreground">
                          Paid on {format(new Date(salary.paid_date), "dd MMM yyyy")}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      {salary.status === "paid" && salary.paid_date && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Download Receipt"
                          onClick={async () => {
                            await generateSalaryReceipt({
                              salaryId: salary.id,
                              teacherName: salary.teacher?.profile?.full_name || "Unknown Teacher",
                              amount: Number(salary.amount),
                              month: salary.month,
                              paidDate: salary.paid_date!,
                              paymentMethod: salary.payment_method,
                              notes: salary.notes,
                            });
                            navigate("/preview-download");
                          }}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                      <div className="text-right">
                        <p className="font-bold text-lg">₹{Number(salary.amount).toLocaleString()}</p>
                        <Badge variant={salary.status === "paid" ? "default" : "secondary"}>
                          {salary.status === "paid" ? "Paid" : "Pending"}
                        </Badge>
                      </div>
                      {isDateFrozen(salary.month) ? (
                        <Badge variant="outline" className="gap-1"><Lock className="h-3 w-3" />Frozen</Badge>
                      ) : (
                        <>
                          {salary.status === "pending" && (
                            <Button
                              size="sm"
                              onClick={() => handleMarkPaid(
                                salary.id,
                                salary.teacher?.profile?.full_name || "Unknown",
                                Number(salary.amount),
                                salary.month
                              )}
                            >
                              Mark Paid
                            </Button>
                          )}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Salary Record</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete this salary record for {salary.teacher?.profile?.full_name || "Unknown"}.
                                  {salary.status === "paid" && " The linked expense entry will also be removed."}
                                  This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteSalary(salary)}>Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      <BottomNav role="admin" />
      <div className="h-16 md:hidden" />
    </div>
  );
};

export default Salaries;
