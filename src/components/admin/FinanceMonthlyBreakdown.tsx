import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";

interface FinanceRecord {
  date: string;
  amount: number;
  groupKey: string; // category or status key
}

interface Props {
  records: FinanceRecord[];
  activeKey: string | null;
  title: string;
  barColor?: string;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const FinanceMonthlyBreakdown = ({ records, activeKey, title, barColor = "hsl(217, 91%, 60%)" }: Props) => {
  const monthlyData = useMemo(() => {
    const grouped: Record<string, number> = {};

    const filtered = activeKey ? records.filter((r) => r.groupKey === activeKey) : records;

    filtered.forEach((r) => {
      const d = new Date(r.date);
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
      grouped[key] = (grouped[key] || 0) + Number(r.amount);
    });

    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12) // Last 12 months
      .map(([key, amount]) => {
        const [year, monthIdx] = key.split("-");
        return {
          month: `${MONTH_NAMES[parseInt(monthIdx)]} ${year.slice(2)}`,
          amount: Math.round(amount),
        };
      });
  }, [records, activeKey]);

  if (monthlyData.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">
          {title}
          {activeKey && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              (Filtered: {activeKey.charAt(0).toUpperCase() + activeKey.slice(1)})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData}>
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(value: number) => [`₹${value.toLocaleString()}`, "Amount"]} />
              <Bar dataKey="amount" name="Amount" fill={barColor} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default FinanceMonthlyBreakdown;
