import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend } from "recharts";

interface AttendanceRecord {
  id: string;
  date: string;
  status: string;
  notes: string | null;
  classes: {
    subject: string;
    class: string | null;
    section: string | null;
  };
}

interface Props {
  records: AttendanceRecord[];
  activeStatus: string | null;
  academicYear: string;
}

const MONTH_ORDER = [3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1, 2];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const TeacherAttendanceMonthlyBreakdown = ({ records, activeStatus, academicYear }: Props) => {
  const monthlyData = useMemo(() => {
    const grouped: Record<number, { present: number; absent: number }> = {};
    MONTH_ORDER.forEach((m) => {
      grouped[m] = { present: 0, absent: 0 };
    });

    records.forEach((r) => {
      const d = new Date(r.date);
      const month = d.getMonth();
      if (grouped[month] && (r.status === "present" || r.status === "absent")) {
        grouped[month][r.status as "present" | "absent"]++;
      }
    });

    return MONTH_ORDER.map((m) => ({
      month: MONTH_NAMES[m],
      present: grouped[m].present,
      absent: grouped[m].absent,
      total: grouped[m].present + grouped[m].absent,
    })).filter((d) => d.total > 0);
  }, [records]);

  const filteredMonthly = useMemo(() => {
    if (!activeStatus) return monthlyData;
    return monthlyData.map((d) => ({
      ...d,
      present: activeStatus === "present" ? d.present : 0,
      absent: activeStatus === "absent" ? d.absent : 0,
    }));
  }, [monthlyData, activeStatus]);

  if (monthlyData.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">
          Monthly Breakdown — {academicYear}
          {activeStatus && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              (Showing: {activeStatus.charAt(0).toUpperCase() + activeStatus.slice(1)})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={filteredMonthly} barGap={2}>
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              {(!activeStatus || activeStatus === "present") && (
                <Bar dataKey="present" name="Present" fill="hsl(142, 71%, 45%)" radius={[2, 2, 0, 0]} />
              )}
              {(!activeStatus || activeStatus === "absent") && (
                <Bar dataKey="absent" name="Absent" fill="hsl(0, 84%, 60%)" radius={[2, 2, 0, 0]} />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default TeacherAttendanceMonthlyBreakdown;
