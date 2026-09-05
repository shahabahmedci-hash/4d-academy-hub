import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/shared/BottomNav";
import PageSkeleton from "@/components/shared/PageSkeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ArrowLeft, ClipboardCheck, Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useProfileCompletionGate } from "@/hooks/useProfileCompletionGate";
import AttendancePieChart from "@/components/student/AttendancePieChart";
import AttendanceMonthlyBreakdown from "@/components/student/AttendanceMonthlyBreakdown";
import { useToast } from "@/hooks/use-toast";
import DateRangePicker from "@/components/shared/DateRangePicker";
import { DateRange, isWithinRange } from "@/lib/dateRange";
import { AttendanceRecord, computeAttendanceStats, fetchStudentAttendance } from "@/hooks/useAttendanceQuery";

const ALL = "__all__";

const StudentAttendance = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { loading: gateLoading, profileCompleted } = useProfileCompletionGate();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [years, setYears] = useState<{ id: string; label: string; start_date: string; end_date: string }[]>([]);
  const [yearId, setYearId] = useState<string>("");
  const [activeStatus, setActiveStatus] = useState<string | null>(null);
  const [subjectFilter, setSubjectFilter] = useState<string>(ALL);
  const [batchFilter, setBatchFilter] = useState<string>(ALL);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
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

    try {
      setRecords(await fetchStudentAttendance(student.id));
    } catch (e: any) {
      toast({ title: "Could not load attendance", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  };

  const selectedYear = years.find((y) => y.id === yearId);

  const subjectOptions = useMemo(
    () => [...new Set(records.map((r) => r.classes.subject).filter(Boolean))].sort(), [records]);
  const batchOptions = useMemo(
    () => [...new Set(records.map((r) => r.classes.section).filter(Boolean) as string[])].sort(), [records]);

  // One filtered dataset drives the charts, the percentage and the list.
  const filteredRecords = useMemo(() => records.filter((r) => {
    if (selectedYear && !(r.date >= selectedYear.start_date && r.date <= selectedYear.end_date)) return false;
    if (subjectFilter !== ALL && r.classes.subject !== subjectFilter) return false;
    if (batchFilter !== ALL && r.classes.section !== batchFilter) return false;
    if (!isWithinRange(r.date, dateRange)) return false;
    return true;
  }), [records, selectedYear, subjectFilter, batchFilter, dateRange]);

  const visibleRecords = useMemo(
    () => (activeStatus ? filteredRecords.filter((r) => r.status === activeStatus) : filteredRecords),
    [filteredRecords, activeStatus]);

  const stats = useMemo(() => computeAttendanceStats(filteredRecords), [filteredRecords]);

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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {years.length > 0 && (
            <Select value={yearId} onValueChange={(v) => { setYearId(v); setActiveStatus(null); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {years.map((y) => <SelectItem key={y.id} value={y.id}>{y.label}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Select value={subjectFilter} onValueChange={setSubjectFilter}>
            <SelectTrigger><SelectValue placeholder="Subject" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All subjects</SelectItem>
              {subjectOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={batchFilter} onValueChange={setBatchFilter}>
            <SelectTrigger><SelectValue placeholder="Batch" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All batches</SelectItem>
              {batchOptions.map((b) => <SelectItem key={b} value={b}>Batch {b}</SelectItem>)}
            </SelectContent>
          </Select>
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </div>

        <div className="flex flex-wrap gap-2">
          {["present", "absent"].map((s) => (
            <Button key={s} size="sm" variant={activeStatus === s ? "default" : "outline"}
              onClick={() => setActiveStatus(activeStatus === s ? null : s)} className="capitalize">
              {s}
            </Button>
          ))}
          {(activeStatus || subjectFilter !== ALL || batchFilter !== ALL || dateRange) && (
            <Button size="sm" variant="ghost" onClick={() => {
              setActiveStatus(null); setSubjectFilter(ALL); setBatchFilter(ALL); setDateRange(undefined);
            }}>Clear</Button>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-emerald-600">{stats.percentage}%</p><p className="text-xs text-muted-foreground">Attendance</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-emerald-600">{stats.present}</p><p className="text-xs text-muted-foreground">Present</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-destructive">{stats.absent}</p><p className="text-xs text-muted-foreground">Absent</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{stats.total}</p><p className="text-xs text-muted-foreground">Total</p></CardContent></Card>
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
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(r.date), "PPP")}
                      {r.classes.section ? ` · Batch ${r.classes.section}` : ""}
                    </p>
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
