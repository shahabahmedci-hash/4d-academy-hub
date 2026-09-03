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
import { useTeacherProfileGate } from "@/hooks/useTeacherProfileGate";
import TeacherAttendancePieChart from "@/components/teacher/TeacherAttendancePieChart";
import TeacherAttendanceMonthlyBreakdown from "@/components/teacher/TeacherAttendanceMonthlyBreakdown";
import { useToast } from "@/hooks/use-toast";
import { AttendanceRecord, computeAttendanceStats, fetchTeacherAttendance } from "@/hooks/useAttendanceQuery";

const ALL = "__all__";

const TeacherMyAttendance = () => {
  const navigate = useNavigate();
  const { loading: gateLoading, profileCompleted } = useTeacherProfileGate();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [years, setYears] = useState<{ id: string; label: string; start_date: string; end_date: string }[]>([]);
  const [yearId, setYearId] = useState<string>("");
  const [activeStatus, setActiveStatus] = useState<string | null>(null);
  const [subjectFilter, setSubjectFilter] = useState<string>(ALL);
  const [batchFilter, setBatchFilter] = useState<string>(ALL);
  const [dateFilter, setDateFilter] = useState<Date | undefined>();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const { toast } = useToast();

  useEffect(() => { if (profileCompleted) load(); }, [profileCompleted]);

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/"); return; }
    setLoadError(false);
    const { data: teacher, error: teacherError } = await supabase.from("teachers").select("id").eq("user_id", user.id).maybeSingle();
    if (teacherError) return failLoad(teacherError.message);
    if (!teacher) { setLoading(false); return; }

    const { data: fy, error: yearError } = await supabase.from("financial_years").select("id, label, start_date, end_date").order("start_date", { ascending: false });
    if (yearError) return failLoad(yearError.message);
    const ys = fy || [];
    setYears(ys);
    const today = new Date().toISOString().split("T")[0];
    const current = ys.find((y) => today >= y.start_date && today <= y.end_date) || ys[0];
    if (current) setYearId(current.id);

    try {
      setRecords(await fetchTeacherAttendance(teacher.id));
    } catch (e: any) {
      return failLoad(e.message);
    }
    setLoading(false);
  };

  const failLoad = (message: string) => {
    setLoadError(true);
    setLoading(false);
    toast({ title: "Could not load attendance", description: message, variant: "destructive" });
  };

  const selectedYear = years.find((y) => y.id === yearId);

  const subjectOptions = useMemo(
    () => [...new Set(records.map((r) => r.classes.subject).filter(Boolean))].sort(), [records]);
  const batchOptions = useMemo(
    () => [...new Set(records.map((r) => r.classes.section).filter(Boolean) as string[])].sort(), [records]);

  const filteredRecords = useMemo(() => records.filter((r) => {
    if (selectedYear && !(r.date >= selectedYear.start_date && r.date <= selectedYear.end_date)) return false;
    if (subjectFilter !== ALL && r.classes.subject !== subjectFilter) return false;
    if (batchFilter !== ALL && r.classes.section !== batchFilter) return false;
    if (dateFilter && r.date !== format(dateFilter, "yyyy-MM-dd")) return false;
    return true;
  }), [records, selectedYear, subjectFilter, batchFilter, dateFilter]);

  const visibleRecords = useMemo(
    () => (activeStatus ? filteredRecords.filter((r) => r.status === activeStatus) : filteredRecords),
    [filteredRecords, activeStatus]);

  const stats = useMemo(() => computeAttendanceStats(filteredRecords), [filteredRecords]);

  if (gateLoading || loading) return <PageSkeleton />;

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/teacher/dashboard")}><ArrowLeft className="h-5 w-5" /></Button>
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
            <SelectTrigger><SelectValue placeholder="Class" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All classes</SelectItem>
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
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="justify-start font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />{dateFilter ? format(dateFilter, "PPP") : "Any date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateFilter} onSelect={setDateFilter} initialFocus className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-emerald-600">{stats.percentage}%</p><p className="text-xs text-muted-foreground">Attendance</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-emerald-600">{stats.present}</p><p className="text-xs text-muted-foreground">Present</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-destructive">{stats.absent}</p><p className="text-xs text-muted-foreground">Absent</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{stats.total}</p><p className="text-xs text-muted-foreground">Total</p></CardContent></Card>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <TeacherAttendancePieChart
            records={filteredRecords}
            onStatusClick={(s) => setActiveStatus(activeStatus === s ? null : s)}
            activeStatus={activeStatus}
          />
          <TeacherAttendanceMonthlyBreakdown
            records={filteredRecords}
            activeStatus={activeStatus}
            academicYear={selectedYear?.label || ""}
          />
        </div>

        {loadError ? (
          <Card><CardContent className="py-12 text-center text-destructive">Attendance could not be loaded.</CardContent></Card>
        ) : visibleRecords.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">No attendance has been recorded by an admin or co-admin yet.</CardContent></Card>
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
      <BottomNav role="teacher" />
    </div>
  );
};

export default TeacherMyAttendance;
