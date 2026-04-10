import { useEffect, useState, useCallback } from "react";
import BottomNav from "@/components/shared/BottomNav";
import PageSkeleton from "@/components/shared/PageSkeleton";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, CheckCircle, Clock, Trash2, Lock, FileDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useFinancialYearFreeze } from "@/hooks/useFinancialYearFreeze";
import { exportToCSV, formatDateForExport } from "@/lib/csvExport";

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

  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [amount, setAmount] = useState("");
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const [notes, setNotes] = useState("");

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/"); return; }
      const [adminResult, coAdminResult] = await Promise.all([
        supabase.rpc("is_admin"),
        supabase.rpc("is_co_admin"),
      ]);
      if (!adminResult.data && !coAdminResult.data) { navigate("/admin/dashboard"); return; }
      await Promise.all([loadTeachers(), loadSalaries()]);
    } catch (error) {
      console.error("Error:", error);
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const loadTeachers = async () => {
    const { data: teacherData } = await supabase.from("teachers").select("id, user_id, employee_id, designation");
    if (teacherData) {
      const userIds = teacherData.map(t => t.user_id);
      const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", userIds);
      setTeachers(teacherData.map(teacher => ({
        ...teacher,
        profile: profiles?.find(p => p.id === teacher.user_id) || null,
      })));
    }
  };

  const loadSalaries = useCallback(async () => {
    let query = supabase.from("teacher_salaries").select("*").order("month", { ascending: false });
    if (filterTeacherId) query = query.eq("teacher_id", filterTeacherId);
    const { data } = await query;

    if (data) {
      const teacherIds = [...new Set(data.map(s => s.teacher_id))];
      const { data: teacherData } = await supabase.from("teachers").select("id, user_id, employee_id, designation").in("id", teacherIds);
      const userIds = teacherData?.map(t => t.user_id) || [];
      const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", userIds);

      const salariesWithTeachers = data.map(salary => ({
        ...salary,
        teacher: teacherData?.find(t => t.id === salary.teacher_id) ? {
          ...teacherData.find(t => t.id === salary.teacher_id)!,
          profile: profiles?.find(p => p.id === teacherData.find(t => t.id === salary.teacher_id)?.user_id) || null,
        } : null,
      }));

      setSalaries(salariesWithTeachers);
      if (filterTeacherId && salariesWithTeachers.length > 0) {
        const t = salariesWithTeachers[0].teacher;
        if (t?.profile?.full_name) setFilterTeacherName(t.profile.full_name);
      }
    }
  }, [filterTeacherId]);

  const handleAddSalary = async () => {
    if (!selectedTeacher || !amount || !month) {
      toast({ variant: "destructive", title: "Error", description: "Please fill in all required fields" });
      return;
    }

    if (isDateFrozen(`${month}-01`)) {
      toast({ variant: "destructive", title: "Frozen Period", description: "This month belongs to a frozen financial year" });
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("teacher_salaries").insert({
        teacher_id: selectedTeacher,
        amount: parseFloat(amount),
        month: `${month}-01`,
        status: "pending",
        notes,
        created_by: user?.id,
      });

      if (error) {
        if (error.code === "23505") {
          toast({ variant: "destructive", title: "Error", description: "Salary entry for this teacher and month already exists" });
        } else throw error;
        return;
      }

      toast({ title: "Success", description: "Salary entry added" });
      setDialogOpen(false);
      resetForm();
      await loadSalaries();
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to add salary entry" });
    } finally {
      setSaving(false);
    }
  };

  const handleMarkPaid = async (salaryId: string, teacherName: string, salaryAmount: number, salaryMonth: string) => {
    if (isDateFrozen(salaryMonth)) {
      toast({ variant: "destructive", title: "Frozen Period", description: "This salary belongs to a frozen financial year" });
      return;
    }
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data: expense, error: expenseError } = await supabase.from("expenses").insert({
        category: "other" as const,
        description: `Salary payment to ${teacherName} for ${format(new Date(salaryMonth), "MMMM yyyy")}`,
        amount: salaryAmount,
        date: new Date().toISOString().split("T")[0],
        created_by: user?.id,
      }).select().single();

      if (expenseError) throw expenseError;

      const { error: salaryError } = await supabase.from("teacher_salaries").update({
        status: "paid",
        paid_date: new Date().toISOString().split("T")[0],
        expense_id: expense.id,
      }).eq("id", salaryId);

      if (salaryError) throw salaryError;

      toast({ title: "Success", description: "Salary marked as paid and added to expenses" });
      await loadSalaries();
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to mark salary as paid" });
    }
  };

  const handleDeleteSalary = async (salary: Salary) => {
    if (isDateFrozen(salary.month)) {
      toast({ variant: "destructive", title: "Frozen Period", description: "This salary belongs to a frozen financial year" });
      return;
    }
    try {
      if (salary.status === "paid" && salary.expense_id) {
        await supabase.from("expenses").delete().eq("id", salary.expense_id);
      }
      const { error } = await supabase.from("teacher_salaries").delete().eq("id", salary.id);
      if (error) throw error;
      toast({ title: "Success", description: "Salary record deleted" });
      await loadSalaries();
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to delete salary record" });
    }
  };

  const resetForm = () => {
    setSelectedTeacher("");
    setAmount("");
    setMonth(format(new Date(), "yyyy-MM"));
    setNotes("");
  };

  const totalPending = salaries.filter(s => s.status === "pending").reduce((sum, s) => sum + Number(s.amount), 0);
  const totalPaidThisMonth = salaries
    .filter(s => s.status === "paid" && s.paid_date?.startsWith(format(new Date(), "yyyy-MM")))
    .reduce((sum, s) => sum + Number(s.amount), 0);

  if (loading) return <PageSkeleton />;

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">
            Salaries
            {filterTeacherName && <span className="text-base font-normal text-muted-foreground ml-2">— {filterTeacherName}</span>}
          </h1>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Clock className="h-4 w-4" /> Pending
              </div>
              <p className="text-xl font-bold">₹{totalPending.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <CheckCircle className="h-4 w-4" /> Paid This Month
              </div>
              <p className="text-xl font-bold">₹{totalPaidThisMonth.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Salary</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Salary Entry</DialogTitle>
                <DialogDescription>Create a new salary record for a teacher</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Teacher *</Label>
                  <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
                    <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
                    <SelectContent>
                      {teachers.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.profile?.full_name || t.employee_id || "Unknown"}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Amount *</Label>
                  <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Month *</Label>
                  <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Notes</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleAddSalary} disabled={saving}>{saving ? "Saving..." : "Add Salary"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const data = salaries.map((s) => ({
                teacher: s.teacher?.profile?.full_name || "Unknown",
                amount: Number(s.amount),
                month: s.month,
                status: s.status,
                paid_date: s.paid_date ? formatDateForExport(s.paid_date) : "",
              }));
              exportToCSV(data, [
                { key: "teacher", label: "Teacher" },
                { key: "amount", label: "Amount" },
                { key: "month", label: "Month" },
                { key: "status", label: "Status" },
                { key: "paid_date", label: "Paid Date" },
              ], "salaries-export");
            }}
            disabled={salaries.length === 0}
          >
            <FileDown className="h-4 w-4 mr-1" /> Export CSV
          </Button>
        </div>

        {/* Salary List */}
        <div className="space-y-3">
          {salaries.map((salary) => (
            <Card key={salary.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{salary.teacher?.profile?.full_name || "Unknown Teacher"}</span>
                      <Badge variant={salary.status === "paid" ? "default" : "secondary"}>
                        {salary.status === "paid" ? <><CheckCircle className="h-3 w-3 mr-1" />Paid</> : <><Clock className="h-3 w-3 mr-1" />Pending</>}
                      </Badge>
                    </div>
                    <p className="text-lg font-bold">₹{Number(salary.amount).toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">
                      Month: {format(new Date(salary.month), "MMMM yyyy")}
                    </p>
                    {salary.paid_date && (
                      <p className="text-xs text-muted-foreground">Paid on: {new Date(salary.paid_date).toLocaleDateString()}</p>
                    )}
                    {salary.notes && <p className="text-xs text-muted-foreground">Note: {salary.notes}</p>}
                  </div>
                  <div className="flex gap-1">
                    {salary.status === "pending" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleMarkPaid(salary.id, salary.teacher?.profile?.full_name || "Unknown", Number(salary.amount), salary.month)}
                      >
                        Mark Paid
                      </Button>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive">
                          {isDateFrozen(salary.month) ? <Lock className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Salary Record?</AlertDialogTitle>
                          <AlertDialogDescription>This will also delete any linked expense entry.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteSalary(salary)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {salaries.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">No salary records found</div>
        )}
      </div>
      <BottomNav role="admin" />
    </div>
  );
};

export default Salaries;
