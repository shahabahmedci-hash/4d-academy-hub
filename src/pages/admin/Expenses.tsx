import { useEffect, useState, useMemo } from "react";
import BottomNav from "@/components/shared/BottomNav";
import PageSkeleton from "@/components/shared/PageSkeleton";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Receipt, Trash2, Lock, FileDown, Upload } from "lucide-react";
import { ImportExpensesDialog } from "@/components/admin/ImportExpensesDialog";
import { exportToCSV, formatDateForExport } from "@/lib/csvExport";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import FinancePieChart from "@/components/admin/FinancePieChart";
import FinanceMonthlyBreakdown from "@/components/admin/FinanceMonthlyBreakdown";
import { useFinancialYearFreeze } from "@/hooks/useFinancialYearFreeze";

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

const CATEGORY_COLORS: Record<string, string> = {
  utilities: "hsl(217, 91%, 60%)",
  rent: "hsl(271, 91%, 65%)",
  admin_personal: "hsl(340, 82%, 52%)",
  supplies: "hsl(25, 95%, 53%)",
  marketing: "hsl(45, 93%, 47%)",
  other: "hsl(215, 14%, 50%)",
  salaries: "hsl(142, 71%, 45%)",
};

const CATEGORY_LABELS: Record<string, string> = {
  utilities: "Utilities",
  rent: "Rent",
  admin_personal: "Admin Personal",
  supplies: "Supplies",
  marketing: "Marketing",
  other: "Other",
  salaries: "Salaries",
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
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeAdmin, setActiveAdmin] = useState<string | null>(null);

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
    if (!adminResult.data && !coAdminResult.data) navigate("/student/dashboard");
    setIsMainAdmin(adminResult.data || false);
  };

  const loadAdmins = async () => {
    try {
      // Get admin and co_admin user_ids from user_roles
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["admin", "co_admin"]);

      if (!roles || roles.length === 0) return;

      const userIds = roles.map((r) => r.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);

      setAdmins(profiles || []);
    } catch (error) {
      console.error("Error loading admins:", error);
    }
  };

  const loadExpenses = async () => {
    try {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .order("date", { ascending: false });

      if (error) throw error;

      // Resolve admin names for admin_personal expenses
      const adminIds = [...new Set((data || []).map((e) => e.admin_id).filter(Boolean))] as string[];
      let adminNames: Record<string, string> = {};
      if (adminIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", adminIds);
        if (profiles) {
          adminNames = Object.fromEntries(profiles.map((p) => [p.id, p.full_name]));
        }
      }

      const composed = (data || []).map((e) => ({
        ...e,
        adminName: e.admin_id ? adminNames[e.admin_id] : undefined,
      }));

      setExpenses(composed);
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

      // Check freeze
      if (isDateFrozen(formData.date)) {
        toast({ variant: "destructive", title: "Frozen Period", description: "This date belongs to a frozen financial year" });
        return;
      }

      const parsedAmount = parseFloat(formData.amount);
      if (!parsedAmount || parsedAmount <= 0 || !isFinite(parsedAmount)) {
        toast({ variant: "destructive", title: "Validation Error", description: "Please enter a valid positive amount" });
        return;
      }

      if (formData.category === "admin_personal" && !formData.admin_id) {
        toast({ variant: "destructive", title: "Validation Error", description: "Please select an admin/co-admin for personal expenses" });
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
      console.error("Error adding expense:", error);
      toast({ variant: "destructive", title: "Error", description: error.message || "Failed to add expense" });
    }
  };

  const handleDelete = async (expense: Expense) => {
    if (isDateFrozen(expense.date)) {
      toast({ variant: "destructive", title: "Frozen Period", description: "This expense belongs to a frozen financial year" });
      return;
    }
    try {
      const id = expense.id;
      // If this expense is linked to a salary, reset that salary back to pending
      const { data: linkedSalaries } = await supabase
        .from("teacher_salaries")
        .select("id")
        .eq("expense_id", id);

      if (linkedSalaries && linkedSalaries.length > 0) {
        await supabase
          .from("teacher_salaries")
          .update({ status: "pending", paid_date: null, expense_id: null })
          .eq("expense_id", id);
      }

      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Success", description: "Expense deleted successfully" });
      loadExpenses();
    } catch (error) {
      console.error("Error deleting expense:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to delete expense" });
    }
  };

  const totalExpenses = useMemo(() => expenses.reduce((sum, exp) => sum + Number(exp.amount), 0), [expenses]);

  const categoryPieData = useMemo(() => {
    const counts: Record<string, number> = {};
    expenses.forEach((e) => {
      counts[e.category] = (counts[e.category] || 0) + Number(e.amount);
    });
    return Object.entries(counts).map(([key, value]) => ({
      key,
      name: CATEGORY_LABELS[key] || key.charAt(0).toUpperCase() + key.slice(1),
      value: Math.round(value),
      color: CATEGORY_COLORS[key] || CATEGORY_COLORS.other,
    }));
  }, [expenses]);

  const adminPersonalExpenses = useMemo(() => expenses.filter((e) => e.category === "admin_personal"), [expenses]);

  const adminPieData = useMemo(() => {
    const counts: Record<string, { name: string; amount: number }> = {};
    const adminColors = ["hsl(340, 82%, 52%)", "hsl(200, 80%, 50%)", "hsl(160, 70%, 45%)", "hsl(280, 70%, 55%)", "hsl(30, 90%, 55%)"];
    
    adminPersonalExpenses.forEach((e) => {
      if (e.admin_id) {
        if (!counts[e.admin_id]) {
          counts[e.admin_id] = { name: e.adminName || "Unknown", amount: 0 };
        }
        counts[e.admin_id].amount += Number(e.amount);
      }
    });

    return Object.entries(counts).map(([key, val], idx) => ({
      key,
      name: val.name,
      value: Math.round(val.amount),
      color: adminColors[idx % adminColors.length],
    }));
  }, [adminPersonalExpenses]);

  const adminMonthlyRecords = useMemo(() =>
    adminPersonalExpenses.map((e) => ({
      date: e.date,
      amount: Number(e.amount),
      groupKey: e.admin_id || "unknown",
    })),
  [adminPersonalExpenses]);

  const filteredExpenses = useMemo(() => {
    let result = expenses;
    if (activeCategory) result = result.filter((e) => e.category === activeCategory);
    return result;
  }, [expenses, activeCategory]);

  const getCategoryBadge = (category: string) => {
    const colors: Record<string, string> = {
      utilities: "bg-blue-500",
      rent: "bg-purple-500",
      admin_personal: "bg-pink-500",
      supplies: "bg-orange-500",
      marketing: "bg-yellow-500",
      other: "bg-gray-500",
      salaries: "bg-green-500",
    };
    const label = CATEGORY_LABELS[category] || category.charAt(0).toUpperCase() + category.slice(1);
    return <Badge className={colors[category] || colors.other}>{label}</Badge>;
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
              <h1 className="text-2xl font-bold">Expense Management</h1>
              <p className="text-sm text-muted-foreground">Track business expenses</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{totalExpenses.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">All time expenses</p>
          </CardContent>
        </Card>

        {/* Category Pie Chart + Monthly Breakdown */}
        <div className="grid gap-6 lg:grid-cols-2">
          <FinancePieChart
            title="Expenses by Category"
            data={categoryPieData}
            activeKey={activeCategory}
            onSliceClick={(key) => setActiveCategory((prev) => (prev === key ? null : key))}
          />
          <FinanceMonthlyBreakdown
            title="Monthly Expense Trend"
            records={expenses.map((e) => ({ date: e.date, amount: Number(e.amount), groupKey: e.category }))}
            activeKey={activeCategory}
            barColor="hsl(0, 84%, 60%)"
          />
        </div>

        {/* Admin Personal Expenses Breakdown */}
        {isMainAdmin && adminPieData.length > 0 && (
          <div className="grid gap-6 lg:grid-cols-2">
            <FinancePieChart
              title="Admin Personal Expenses"
              data={adminPieData}
              activeKey={activeAdmin}
              onSliceClick={(key) => setActiveAdmin((prev) => (prev === key ? null : key))}
            />
            <FinanceMonthlyBreakdown
              title="Admin Monthly Expense Trend"
              records={adminMonthlyRecords}
              activeKey={activeAdmin}
              barColor="hsl(340, 82%, 52%)"
            />
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle>
                  Expense Records
                  {activeCategory && (
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      — {CATEGORY_LABELS[activeCategory] || activeCategory}
                      <button onClick={() => setActiveCategory(null)} className="ml-2 text-xs text-primary underline">Clear</button>
                    </span>
                  )}
                </CardTitle>
                <CardDescription>All business expenses</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    const data = filteredExpenses.map((e) => ({
                      id: e.id,
                      description: e.description,
                      category: e.category,
                      amount: Number(e.amount),
                      date: formatDateForExport(e.date),
                    }));
                    exportToCSV(data, [
                      { key: "id", label: "id" },
                      { key: "description", label: "description" },
                      { key: "category", label: "category" },
                      { key: "amount", label: "amount" },
                      { key: "date", label: "date" },
                    ], "expenses-export");
                    navigate("/preview-download");
                  }}
                >
                  <FileDown className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
                <ImportExpensesDialog onExpensesImported={loadExpenses} />
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Expense
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Expense</DialogTitle>
                    <DialogDescription>Record a business expense</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="amount">Amount *</Label>
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        required
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="date">Date *</Label>
                      <Input
                        id="date"
                        type="date"
                        required
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="category">Category *</Label>
                      <Select
                        value={formData.category}
                        onValueChange={(value) => setFormData({ ...formData, category: value, admin_id: value !== "admin_personal" ? "" : formData.admin_id })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
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
                      <div className="space-y-2">
                        <Label htmlFor="admin_id">Admin / Co-Admin *</Label>
                        <Select
                          value={formData.admin_id}
                          onValueChange={(value) => setFormData({ ...formData, admin_id: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select admin or co-admin" />
                          </SelectTrigger>
                          <SelectContent>
                            {admins.map((admin) => (
                              <SelectItem key={admin.id} value={admin.id}>
                                {admin.full_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="description">Description *</Label>
                      <Textarea
                        id="description"
                        required
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      />
                    </div>

                    <div className="flex justify-end gap-4">
                      <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                      <Button type="submit">Add Expense</Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredExpenses.map((expense) => (
                <div
                  key={expense.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
                >
                  <div className="flex-1">
                    <p className="font-medium">{expense.description}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(expense.date).toLocaleDateString()}
                      {expense.adminName && (
                        <span className="ml-2">• {expense.adminName}</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 mt-2 sm:mt-0">
                    <p className="font-bold">₹{Number(expense.amount).toLocaleString()}</p>
                    {getCategoryBadge(expense.category)}
                    {isDateFrozen(expense.date) ? (
                      <Badge variant="outline" className="gap-1"><Lock className="h-3 w-3" />Frozen</Badge>
                    ) : (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Expense</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete this expense record. If it is linked to a salary payment, that salary will be reset to pending. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(expense)}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {filteredExpenses.length === 0 && (
              <p className="text-center text-muted-foreground py-8">No expenses found</p>
            )}
          </CardContent>
        </Card>
      </main>
      <BottomNav role="admin" />
      <div className="h-16 md:hidden" />
    </div>
  );
};

export default Expenses;
