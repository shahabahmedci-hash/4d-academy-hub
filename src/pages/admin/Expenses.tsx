import { useEffect, useState, useMemo } from "react";
import BottomNav from "@/components/shared/BottomNav";
import PageSkeleton from "@/components/shared/PageSkeleton";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Trash2, Lock, FileDown, Receipt } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFinancialYearFreeze } from "@/hooks/useFinancialYearFreeze";
import { exportToCSV, formatDateForExport } from "@/lib/csvExport";

interface Expense {
  id: string;
  amount: number;
  date: string;
  description: string;
  category: string;
  receipt_url: string | null;
  admin_id: string | null;
  adminName?: string;
}

interface AdminProfile {
  id: string;
  full_name: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  utilities: "Utilities",
  rent: "Rent",
  admin_personal: "Admin Personal",
  supplies: "Supplies",
  marketing: "Marketing",
  other: "Other",
};

const Expenses = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isDateFrozen } = useFinancialYearFreeze();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [admins, setAdmins] = useState<AdminProfile[]>([]);
  const [isMainAdmin, setIsMainAdmin] = useState(false);
  const [formData, setFormData] = useState({
    amount: "",
    date: new Date().toISOString().split("T")[0],
    description: "",
    category: "utilities",
    admin_id: "",
  });

  useEffect(() => {
    const init = async () => {
      await checkAuth();
      await Promise.all([loadExpenses(), loadAdmins()]);
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
    if (!adminResult.data && !coAdminResult.data) navigate("/admin/dashboard");
    setIsMainAdmin(adminResult.data || false);
  };

  const loadAdmins = async () => {
    try {
      const { data: roles } = await supabase.from("user_roles").select("user_id, role").in("role", ["admin", "co_admin"]);
      if (!roles || roles.length === 0) return;
      const userIds = roles.map((r) => r.user_id);
      const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
      setAdmins(profiles || []);
    } catch (error) {
      console.error("Error loading admins:", error);
    }
  };

  const loadExpenses = async () => {
    try {
      const { data, error } = await supabase.from("expenses").select("*").order("date", { ascending: false });
      if (error) throw error;

      const adminIds = [...new Set((data || []).map((e) => e.admin_id).filter(Boolean))] as string[];
      let adminNames: Record<string, string> = {};
      if (adminIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", adminIds);
        if (profiles) adminNames = Object.fromEntries(profiles.map((p) => [p.id, p.full_name]));
      }

      setExpenses((data || []).map((e) => ({ ...e, adminName: e.admin_id ? adminNames[e.admin_id] : undefined })));
    } catch (error) {
      console.error("Error loading expenses:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to load expenses" });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (isDateFrozen(formData.date)) {
        toast({ variant: "destructive", title: "Frozen Period", description: "This date belongs to a frozen financial year" });
        return;
      }

      const parsedAmount = parseFloat(formData.amount);
      if (!parsedAmount || parsedAmount <= 0) {
        toast({ variant: "destructive", title: "Validation Error", description: "Please enter a valid positive amount" });
        return;
      }

      if (formData.category === "admin_personal" && !formData.admin_id) {
        toast({ variant: "destructive", title: "Validation Error", description: "Please select an admin for personal expenses" });
        return;
      }

      const { error } = await supabase.from("expenses").insert([{
        amount: parsedAmount,
        date: formData.date,
        description: formData.description,
        category: formData.category as any,
        created_by: user.id,
        admin_id: formData.category === "admin_personal" ? formData.admin_id : null,
      }]);

      if (error) throw error;

      toast({ title: "Success", description: "Expense added successfully" });
      setOpen(false);
      setFormData({ amount: "", date: new Date().toISOString().split("T")[0], description: "", category: "utilities", admin_id: "" });
      loadExpenses();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message || "Failed to add expense" });
    }
  };

  const handleDelete = async (expense: Expense) => {
    if (isDateFrozen(expense.date)) {
      toast({ variant: "destructive", title: "Frozen Period", description: "This expense belongs to a frozen financial year" });
      return;
    }
    try {
      const { data: linkedSalaries } = await supabase.from("teacher_salaries").select("id").eq("expense_id", expense.id);
      if (linkedSalaries && linkedSalaries.length > 0) {
        await supabase.from("teacher_salaries").update({ status: "pending", paid_date: null, expense_id: null }).eq("expense_id", expense.id);
      }
      const { error } = await supabase.from("expenses").delete().eq("id", expense.id);
      if (error) throw error;
      toast({ title: "Success", description: "Expense deleted" });
      loadExpenses();
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to delete expense" });
    }
  };

  const totalExpenses = useMemo(() => expenses.reduce((sum, exp) => sum + Number(exp.amount), 0), [expenses]);

  const getCategoryBadge = (category: string) => {
    const label = CATEGORY_LABELS[category] || category;
    return <Badge variant="secondary">{label}</Badge>;
  };

  if (loading) return <PageSkeleton />;

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Expenses</h1>
        </div>

        {/* Total */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Total Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">₹{totalExpenses.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">All time expenses</p>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-2">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Expense</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Expense</DialogTitle>
                <DialogDescription>Record a business expense</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-1">
                  <Label>Amount *</Label>
                  <Input type="number" step="0.01" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Date *</Label>
                  <Input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Category *</Label>
                  <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value, admin_id: value !== "admin_personal" ? "" : formData.admin_id })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="utilities">Utilities</SelectItem>
                      <SelectItem value="rent">Rent</SelectItem>
                      {isMainAdmin && <SelectItem value="admin_personal">Admin Personal</SelectItem>}
                      <SelectItem value="supplies">Supplies</SelectItem>
                      <SelectItem value="marketing">Marketing</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.category === "admin_personal" && (
                  <div className="space-y-1">
                    <Label>Admin / Co-Admin *</Label>
                    <Select value={formData.admin_id} onValueChange={(value) => setFormData({ ...formData, admin_id: value })}>
                      <SelectTrigger><SelectValue placeholder="Select admin" /></SelectTrigger>
                      <SelectContent>
                        {admins.map((admin) => (
                          <SelectItem key={admin.id} value={admin.id}>{admin.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-1">
                  <Label>Description *</Label>
                  <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
                </div>
                <Button type="submit" className="w-full">Add Expense</Button>
              </form>
            </DialogContent>
          </Dialog>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const data = expenses.map((e) => ({
                description: e.description,
                category: e.category,
                amount: Number(e.amount),
                date: formatDateForExport(e.date),
              }));
              exportToCSV(data, [
                { key: "description", label: "Description" },
                { key: "category", label: "Category" },
                { key: "amount", label: "Amount" },
                { key: "date", label: "Date" },
              ], "expenses-export");
            }}
            disabled={expenses.length === 0}
          >
            <FileDown className="h-4 w-4 mr-1" /> Export CSV
          </Button>
        </div>

        {/* Expense List */}
        <div className="space-y-3">
          {expenses.map((expense) => (
            <Card key={expense.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <Receipt className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">₹{Number(expense.amount).toLocaleString()}</span>
                      {getCategoryBadge(expense.category)}
                    </div>
                    <p className="text-sm text-muted-foreground">{expense.description}</p>
                    <p className="text-xs text-muted-foreground">{new Date(expense.date).toLocaleDateString()}</p>
                    {expense.adminName && <p className="text-xs text-muted-foreground">Admin: {expense.adminName}</p>}
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-destructive">
                        {isDateFrozen(expense.date) ? <Lock className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Expense?</AlertDialogTitle>
                        <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(expense)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {expenses.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">No expenses recorded yet</div>
        )}
      </div>
      <BottomNav role="admin" />
    </div>
  );
};

export default Expenses;
