import { useMemo, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Sector } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
  onStatusClick: (status: string) => void;
  activeStatus: string | null;
}

const COLORS: Record<string, string> = {
  present: "hsl(142, 71%, 45%)",
  absent: "hsl(0, 84%, 60%)",
};

const LABELS: Record<string, string> = {
  present: "Present",
  absent: "Absent",
};

const renderActiveShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
  return (
    <g>
      <text x={cx} y={cy - 12} textAnchor="middle" fill="currentColor" className="text-lg font-bold">
        {payload.name}
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill="currentColor" className="text-sm">
        {value} ({(percent * 100).toFixed(0)}%)
      </text>
      <Sector
        cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 8}
        startAngle={startAngle} endAngle={endAngle} fill={fill}
      />
    </g>
  );
};

const AttendancePieChart = ({ records, onStatusClick, activeStatus }: Props) => {
  const [hoverIndex, setHoverIndex] = useState<number | undefined>(undefined);

  const data = useMemo(() => {
    const counts: Record<string, number> = { present: 0, absent: 0 };
    records.forEach((r) => {
      if (counts[r.status] !== undefined) counts[r.status]++;
    });
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([status, value]) => ({ name: LABELS[status], status, value }));
  }, [records]);

  const total = records.length;

  if (total === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-sm">Attendance Overview</CardTitle></CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">No attendance records for this period</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Attendance Overview</CardTitle></CardHeader>
      <CardContent>
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%" cy="50%"
                innerRadius={60} outerRadius={90}
                dataKey="value"
                activeIndex={hoverIndex}
                activeShape={renderActiveShape}
                onMouseEnter={(_, idx) => setHoverIndex(idx)}
                onMouseLeave={() => setHoverIndex(undefined)}
                onClick={(entry) => onStatusClick(entry.status)}
                className="cursor-pointer outline-none"
              >
                {data.map((entry) => (
                  <Cell
                    key={entry.status}
                    fill={COLORS[entry.status]}
                    opacity={activeStatus && activeStatus !== entry.status ? 0.3 : 1}
                    stroke="none"
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center gap-6 mt-2">
          {data.map((d) => (
            <button
              key={d.status}
              onClick={() => onStatusClick(d.status)}
              className={`flex items-center gap-2 text-sm transition-opacity ${activeStatus && activeStatus !== d.status ? "opacity-40" : ""}`}
            >
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[d.status] }} />
              {d.name}: {d.value}
            </button>
          ))}
        </div>
        <p className="text-center text-xs text-muted-foreground mt-2">Total: {total} classes</p>
      </CardContent>
    </Card>
  );
};

export default AttendancePieChart;
