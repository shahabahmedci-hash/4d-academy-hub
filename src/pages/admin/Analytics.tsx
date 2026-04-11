import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import BottomNav from "@/components/shared/BottomNav";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--destructive))",
  "hsl(var(--accent))",
  "hsl(142, 76%, 36%)",
  "hsl(38, 92%, 50%)",
  "hsl(280, 65%, 60%)",
];

const Analytics = () => {
  const navigate = useNavigate();
  const [feeStats, setFeeStats] = useState({ paid: 0, pending: 0, overdue: 0, totalCollected: 0 });
  const [expenseByCategory, setExpenseByCategory] = useState<{ name: string; value: number }[]>([]);
  const [monthlyFees, setMonthlyFees] = useState<{ month: string; amount: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      // Fee stats
      const { data: fees } = await supabase.from("fees").select("status, amount");
      if (fees) {
        const paid = fees.filter(f => f.status === "paid");
        const pending = fees.filter(f => f.status === "pending");
        const overdue = fees.filter(f => f.status === "overdue");
        setFeeStats({
          paid: paid.length,
          pending: pending.length,
          overdue: overdue.length,
          totalCollected: paid.reduce((s, f) => s + Number(f.amount), 0),
        });
      }

      // Expenses by category
      const { data: expenses } = await supabase.from("expenses").select("category, amount");
      if (expenses) {
        const catMap: Record<string, number> = {};
        expenses.forEach(e => {
          catMap[e.category] = (catMap[e.category] || 0) + Number(e.amount);
        });
        setExpenseByCategory(Object.entries(catMap).map(([name, value]) => ({ name, value })));
      }

      // Monthly fee collection (paid fees by paid_date month)
      const { data: paidFees } = await supabase
        .from("fees")
        .select("amount, paid_date")
        .eq("status", "paid")
        .not("paid_date", "is", null);

      if (paidFees) {
        const monthMap: Record<string, number> = {};
        paidFees.forEach(f => {
          if (f.paid_date) {
            const m = f.paid_date.slice(0, 7); // YYYY-MM
            monthMap[m] = (monthMap[m] || 0) + Number(f.amount);
          }
        });
        const sorted = Object.entries(monthMap)
          .sort(([a], [b]) => a.localeCompare(b))
          .slice(-6)
          .map(([month, amount]) => ({ month: month.slice(5), amount }));
        setMonthlyFees(sorted);
      }
    } finally {
      setLoading(false);
    }
  };

  const feeChartConfig = {
    paid: { label: "Paid", color: "hsl(142, 76%, 36%)" },
    pending: { label: "Pending", color: "hsl(38, 92%, 50%)" },
    overdue: { label: "Overdue", color: "hsl(var(--destructive))" },
  };

  const feeDistData = [
    { name: "Paid", value: feeStats.paid },
    { name: "Pending", value: feeStats.pending },
    { name: "Overdue", value: feeStats.overdue },
  ].filter(d => d.value > 0);

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold">Analytics</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total Collected</p>
              <p className="text-xl font-bold">₹{feeStats.totalCollected.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Overdue Fees</p>
              <p className="text-xl font-bold text-destructive">{feeStats.overdue}</p>
            </CardContent>
          </Card>
        </div>

        {/* Fee Distribution Pie */}
        {feeDistData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Fee Status Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={feeChartConfig} className="h-[200px]">
                <PieChart>
                  <Pie data={feeDistData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                    {feeDistData.map((_, i) => (
                      <Cell key={i} fill={[
                        "hsl(142, 76%, 36%)",
                        "hsl(38, 92%, 50%)",
                        "hsl(var(--destructive))",
                      ][i % 3]} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ChartContainer>
            </CardContent>
          </Card>
        )}

        {/* Monthly Fee Collection Bar */}
        {monthlyFees.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Monthly Fee Collection</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={{ amount: { label: "Amount", color: "hsl(var(--primary))" } }} className="h-[200px]">
                <BarChart data={monthlyFees}>
                  <XAxis dataKey="month" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        )}

        {/* Expense by Category */}
        {expenseByCategory.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Expenses by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={{ value: { label: "Amount" } }} className="h-[200px]">
                <PieChart>
                  <Pie data={expenseByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                    {expenseByCategory.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ChartContainer>
            </CardContent>
          </Card>
        )}

        {loading && <p className="text-center text-muted-foreground">Loading analytics...</p>}
      </div>

      <BottomNav role="admin" />
    </div>
  );
};

export default Analytics;
