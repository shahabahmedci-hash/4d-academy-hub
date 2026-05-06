import { useMemo, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Sector } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PieDataItem {
  name: string;
  key: string;
  value: number;
  color: string;
}

interface Props {
  data: PieDataItem[];
  title: string;
  activeKey: string | null;
  onSliceClick: (key: string) => void;
  currencyPrefix?: string;
}

const renderActiveShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
  return (
    <g>
      <text x={cx} y={cy - 12} textAnchor="middle" fill="currentColor" className="text-sm font-bold">
        {payload.name}
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill="currentColor" className="text-xs">
        ₹{value.toLocaleString()} ({(percent * 100).toFixed(0)}%)
      </text>
      <Sector
        cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 8}
        startAngle={startAngle} endAngle={endAngle} fill={fill}
      />
    </g>
  );
};

const FinancePieChart = ({ data, title, activeKey, onSliceClick, currencyPrefix = "₹" }: Props) => {
  const [hoverIndex, setHoverIndex] = useState<number | undefined>(undefined);

  const filtered = useMemo(() => data.filter((d) => d.value > 0), [data]);
  const total = useMemo(() => filtered.reduce((s, d) => s + d.value, 0), [filtered]);

  if (filtered.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">No data to display</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent>
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={filtered}
                cx="50%" cy="50%"
                innerRadius={60} outerRadius={90}
                dataKey="value"
                activeIndex={hoverIndex}
                activeShape={renderActiveShape}
                onMouseEnter={(_, idx) => setHoverIndex(idx)}
                onMouseLeave={() => setHoverIndex(undefined)}
                onClick={(entry) => onSliceClick(entry.key)}
                className="cursor-pointer outline-none"
              >
                {filtered.map((entry) => (
                  <Cell
                    key={entry.key}
                    fill={entry.color}
                    opacity={activeKey && activeKey !== entry.key ? 0.3 : 1}
                    stroke="none"
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap justify-center gap-4 mt-2">
          {filtered.map((d) => (
            <button
              key={d.key}
              onClick={() => onSliceClick(d.key)}
              className={`flex items-center gap-2 text-sm transition-opacity ${activeKey && activeKey !== d.key ? "opacity-40" : ""}`}
            >
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
              {d.name}: {currencyPrefix}{d.value.toLocaleString()}
            </button>
          ))}
        </div>
        <p className="text-center text-xs text-muted-foreground mt-2">Total: {currencyPrefix}{total.toLocaleString()}</p>
      </CardContent>
    </Card>
  );
};

export default FinancePieChart;
