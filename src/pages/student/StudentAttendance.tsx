import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/shared/BottomNav";
import PageSkeleton from "@/components/shared/PageSkeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ClipboardCheck } from "lucide-react";
import { useProfileCompletionGate } from "@/hooks/useProfileCompletionGate";
import AttendancePieChart from "@/components/student/AttendancePieChart";
import AttendanceMonthlyBreakdown from "@/components/student/AttendanceMonthlyBreakdown";

interface Att {
  id: string;
  date: string;
  status: string;
  notes: string | null;
  class_id: string;
  classes: { subject: string; class: string | null; section: string | null };
}

const StudentAttendance = () => {
  const navigate = useNavigate();
  const { loading: gateLoading, profileCompleted } = useProfileCompletionGate();
  const [records, setRecords] = useState<Att[]>([]);
  const [years, setYears] = useState<{ id: string; label: string; start_date: string; end_date: string }[]>([]);
  const [yearId, setYearId] = useState<string>("");
  const [activeStatus, setActiveStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profileCompleted) load();
  }, [profileCompleted]);

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/"); return; }

    const { data: student } = await supabase.from("students").select("id").eq("user_id", user.id).maybeSingle();
    if (!student) { setLoading(false); return; }

    const { data: fy } = await supabase.from("financial_years").select("id, label, start_date, end_date").order("start_date", { ascending: false });
    const ys = fy || [];
    setYears(ys);
    const today = new Date().toISOString().split("T")[0];
    const current = ys.find((y) => today >= y.start_date && today <= y.end_date) || ys[0];
    if (current) setYearId(current.id);

    const { data } = await supabase
      .from("attendance")
      .select("*")
      .eq("student_id", student.id)
      .order("date", { ascending: false });

    const recs = data || [];
    const classIds = [...new Set(recs.map((r) => r.class_id))];
    const cMap: Record<string, any> = {};
    if (classIds.length > 0) {
      const { data: cls } = await supabase.from("classes").select("id, subject, class, section").in("id", classIds);
      (cls || []).forEach((c) => { cMap[c.id] = c; });
    }
    setRecords(recs.map((r) => ({ ...r, classes: cMap[r.class_id] || { subject: "—", class: null, section: null } })));
    setLoading(false);
  };

  const selectedYear = years.find((y) => y.id === yearId);
  const filteredRecords = useMemo(() => {
    if (!selectedYear) return records;
    return records.filter((r) => r.date >= selectedYear.start_date && r.date <= selectedYear.end_date);
  }, [records, selectedYear]);

  const visibleRecords = useMemo(() => {
    if (!activeStatus) return filteredRecords;
    return filteredRecords.filter((r) => r.status === activeStatus);
  }, [filteredRecords, activeStatus]);

  if (gateLoading || loading) return <PageSkeleton />;

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/student/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <ClipboardCheck className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">My Attendance</h1>
        </div>
      </header>

      <main className="container max-w-5xl mx-auto px-4 py-6 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {years.length > 0 && (
            <Select value={yearId} onValueChange={(v) => { setYearId(v); setActiveStatus(null); }}>
              <SelectTrigger className="w-full md:w-64"><SelectValue /></SelectTrigger>
              <SelectContent>
                {years.map((y) => <SelectItem key={y.id} value={y.id}>{y.label}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <div className="flex flex-wrap gap-2">
            {["present", "absent", "late", "excused"].map((s) => (
              <Button
                key={s}
                size="sm"
                variant={activeStatus === s ? "default" : "outline"}
                onClick={() => setActiveStatus(activeStatus === s ? null : s)}
                className="capitalize"
              >
                {s}
              </Button>
            ))}
            {activeStatus && (
              <Button size="sm" variant="ghost" onClick={() => setActiveStatus(null)}>Clear</Button>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <AttendancePieChart
            records={filteredRecords}
            onStatusClick={(s) => setActiveStatus(activeStatus === s ? null : s)}
            activeStatus={activeStatus}
          />
          <AttendanceMonthlyBreakdown
            records={filteredRecords}
            activeStatus={activeStatus}
            academicYear={selectedYear?.label || ""}
          />
        </div>

        {visibleRecords.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">No attendance records.</CardContent></Card>
        ) : (
          <div className="space-y-2">
            {visibleRecords.map((r) => (
              <Card key={r.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{r.classes.subject}</p>
                    <p className="text-sm text-muted-foreground">{new Date(r.date).toLocaleDateString()}</p>
                  </div>
                  <Badge variant={r.status === "present" ? "default" : "destructive"}>{r.status}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
      <BottomNav role="student" />
    </div>
  );
};

export default StudentAttendance;
