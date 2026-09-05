import { useEffect, useState, useMemo } from "react";
import BottomNav from "@/components/shared/BottomNav";
import PageSkeleton from "@/components/shared/PageSkeleton";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ArrowLeft, Save, FileDown, Trash2, Calendar as CalendarIcon, Lock, ClipboardList } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { exportToCSV, formatDateForExport } from "@/lib/csvExport";
import logo from "@/assets/4d-academy-logo.jpg";
import TeacherAttendancePieChart from "@/components/teacher/TeacherAttendancePieChart";
import TeacherAttendanceMonthlyBreakdown from "@/components/teacher/TeacherAttendanceMonthlyBreakdown";
import { ImportTeacherAttendanceDialog } from "@/components/admin/ImportTeacherAttendanceDialog";
import { useFinancialYearFreeze } from "@/hooks/useFinancialYearFreeze";
import DateRangePicker from "@/components/shared/DateRangePicker";
import { DateRange, isWithinRange } from "@/lib/dateRange";
import {
  AttendanceRecord, AttendanceStatus, computeAttendanceStats, fetchClassTeacherAttendanceMap,
  fetchTeacherAttendance, saveTeacherAttendance,
} from "@/hooks/useAttendanceQuery";

interface TeacherOption {
  id: string;
  full_name: string;
  email: string;
  employee_id: string | null;
  joining_date: string;
}

interface ClassRow {
  id: string;
  subject: string;
  class: string | null;
  section: string | null;
}

const ALL = "__all__";

function getAcademicYear(dateStr: string): string {
  const d = new Date(dateStr);
  const startYear = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${startYear}-${String(startYear + 1).slice(2)}`;
}

const TeacherHistoryView = ({ records, onDelete }: {
  records: AttendanceRecord[];
  onDelete: (id: string) => void;
}) => {
  const [activeStatus, setActiveStatus] = useState<string | null>(null);
  const [classFilter, setClassFilter] = useState<string>(ALL);
  const [batchFilter, setBatchFilter] = useState<string>(ALL);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  const classOptions = useMemo(
    () => [...new Set(records.map((r) => r.classes.subject).filter(Boolean))].sort(), [records]);
  const batchOptions = useMemo(
    () => [...new Set(records.filter((r) => classFilter === ALL || r.classes.subject === classFilter)
      .map((r) => r.classes.section).filter(Boolean) as string[])].sort(), [records, classFilter]);

  const chartRecords = useMemo(() => records.filter((r) => {
    if (classFilter !== ALL && r.classes.subject !== classFilter) return false;
    if (batchFilter !== ALL && r.classes.section !== batchFilter) return false;
    if (!isWithinRange(r.date, dateRange)) return false;
    return true;
  }), [records, classFilter, batchFilter, dateRange]);

  const filtered = useMemo(
    () => (activeStatus ? chartRecords.filter((r) => r.status === activeStatus) : chartRecords),
    [chartRecords, activeStatus]);

  const stats = useMemo(() => computeAttendanceStats(chartRecords), [chartRecords]);
  const academicYear = chartRecords.length > 0 ? getAcademicYear(chartRecords[0].date) : "";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Filters</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select value={classFilter} onValueChange={(v) => { setClassFilter(v); setBatchFilter(ALL); }}>
            <SelectTrigger><SelectValue placeholder="Class" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All classes</SelectItem>
              {classOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
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
          <Select value={activeStatus ?? ALL} onValueChange={(v) => setActiveStatus(v === ALL ? null : v)}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              <SelectItem value="present">Present</SelectItem>
              <SelectItem value="absent">Absent</SelectItem>
            </SelectContent>
          </Select>
          {(classFilter !== ALL || batchFilter !== ALL || dateRange || activeStatus) && (
            <Button variant="ghost" size="sm" className="justify-self-start" onClick={() => {
              setClassFilter(ALL); setBatchFilter(ALL); setDateRange(undefined); setActiveStatus(null);
            }}>Clear filters</Button>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6 text-center"><div className="text-3xl font-bold text-emerald-600">{stats.percentage}%</div><p className="text-xs text-muted-foreground">Attendance Rate</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><div className="text-3xl font-bold text-emerald-600">{stats.present}</div><p className="text-xs text-muted-foreground">Present</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><div className="text-3xl font-bold text-destructive">{stats.absent}</div><p className="text-xs text-muted-foreground">Absent</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><div className="text-3xl font-bold">{stats.total}</div><p className="text-xs text-muted-foreground">Total Records</p></CardContent></Card>
      </div>

      {chartRecords.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          <TeacherAttendancePieChart records={chartRecords} onStatusClick={(s: string) => setActiveStatus((prev) => prev === s ? null : s)} activeStatus={activeStatus} />
          <TeacherAttendanceMonthlyBreakdown records={chartRecords} activeStatus={activeStatus} academicYear={academicYear} />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Attendance Records</CardTitle>
          <CardDescription>{filtered.length} records</CardDescription>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No attendance records match these filters</p>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {filtered.map((record) => (
                <div key={record.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{record.classes.subject}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(record.date), "PPP")}
                      {record.classes.class ? ` · Class ${record.classes.class}` : ""}
                      {record.classes.section ? ` · Batch ${record.classes.section}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={record.status === "present" ? "default" : "destructive"}>{record.status}</Badge>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onDelete(record.id)} aria-label="Delete record">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const TeacherAttendance = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const filterTeacherId = searchParams.get("teacher_id");
  const deepClass = searchParams.get("class");
  const deepDate = searchParams.get("date");
  const { toast } = useToast();
  const { isDateFrozen } = useFinancialYearFreeze();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [teacherClasses, setTeacherClasses] = useState<ClassRow[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<string>("");
  const [batchFilter, setBatchFilter] = useState<string>(ALL);
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [date, setDate] = useState<Date>(deepDate ? new Date(`${deepDate}T00:00:00`) : new Date());
  const [status, setStatus] = useState<AttendanceStatus | null>(null);
  const [existing, setExisting] = useState(false);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [teacherName, setTeacherName] = useState<string>("");

  const dateStr = format(date, "yyyy-MM-dd");
  const frozen = isDateFrozen(dateStr);
  const teacherInfo = useMemo(() => teachers.find((t) => t.id === selectedTeacher), [teachers, selectedTeacher]);
  const beforeJoining = !!teacherInfo && dateStr < teacherInfo.joining_date;

  useEffect(() => { init(); }, []);

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/"); return; }
    const [a, c] = await Promise.all([supabase.rpc("is_admin"), supabase.rpc("is_co_admin")]);
    if (!a.data && !c.data) { navigate("/"); return; }

    if (filterTeacherId) await loadHistory();
    else {
      await loadTeachers();
      if (deepClass) {
        const { data: tc } = await supabase.from("teacher_classes").select("teacher_id").eq("class_id", deepClass);
        if (tc && tc.length === 1) setSelectedTeacher(tc[0].teacher_id);
      }
    }
    setLoading(false);
  };

  const loadTeachers = async () => {
    const { data: rows, error } = await supabase.from("teachers").select("id, employee_id, user_id, joining_date");
    if (error) { toast({ variant: "destructive", title: "Error", description: error.message }); return; }
    const userIds = (rows || []).map((t) => t.user_id).filter(Boolean) as string[];
    const { data: profiles } = await supabase.from("profiles").select("id, full_name, email, archived").in("id", userIds);
    const pMap = new Map((profiles || []).map((p) => [p.id, p]));
    setTeachers((rows || [])
      .filter((t) => !pMap.get(t.user_id!)?.archived)
      .map((t) => ({
        id: t.id,
        employee_id: t.employee_id,
        joining_date: t.joining_date,
        full_name: pMap.get(t.user_id!)?.full_name || "Unknown Teacher",
        email: pMap.get(t.user_id!)?.email || "",
      }))
      .sort((x, y) => x.full_name.localeCompare(y.full_name)));
  };

  const loadHistory = async () => {
    const { data: teacher } = await supabase.from("teachers").select("user_id").eq("id", filterTeacherId!).maybeSingle();
    if (teacher?.user_id) {
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", teacher.user_id).maybeSingle();
      if (profile) setTeacherName(profile.full_name);
    }
    try {
      setHistory(await fetchTeacherAttendance(filterTeacherId!));
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    }
  };

  // Teacher -> classes assigned to that teacher only
  useEffect(() => {
    setSelectedClass("");
    setBatchFilter(ALL);
    setTeacherClasses([]);
    if (!selectedTeacher) return;
    (async () => {
      const { data: tc, error } = await supabase.from("teacher_classes").select("class_id").eq("teacher_id", selectedTeacher);
      if (error) { toast({ variant: "destructive", title: "Error", description: error.message }); return; }
      const ids = (tc || []).map((r) => r.class_id);
      if (ids.length === 0) return;
      const { data: cls } = await supabase.from("classes").select("id, subject, class, section").in("id", ids).order("subject");
      setTeacherClasses(cls || []);
    })();
  }, [selectedTeacher]);

  const batchOptions = useMemo(
    () => [...new Set(teacherClasses.map((c) => c.section).filter(Boolean) as string[])].sort(), [teacherClasses]);
  const visibleClasses = useMemo(
    () => teacherClasses.filter((c) => batchFilter === ALL || c.section === batchFilter), [teacherClasses, batchFilter]);

  useEffect(() => {
    if (selectedClass && !visibleClasses.some((c) => c.id === selectedClass)) setSelectedClass("");
  }, [visibleClasses, selectedClass]);

  // Preselect the class from a coverage deep link once the teacher's classes load.
  useEffect(() => {
    if (deepClass && !selectedClass && teacherClasses.some((c) => c.id === deepClass)) setSelectedClass(deepClass);
  }, [teacherClasses, deepClass]);

  // Load the record for Teacher + Class + Date
  useEffect(() => {
    if (!selectedTeacher || !selectedClass) { setStatus(null); setExisting(false); return; }
    (async () => {
      try {
        const map = await fetchClassTeacherAttendanceMap(selectedClass, dateStr);
        const current = map[selectedTeacher];
        if (current === "present" || current === "absent") { setStatus(current); setExisting(true); }
        else { setStatus(null); setExisting(false); }
      } catch (e: any) {
        toast({ variant: "destructive", title: "Could not load record", description: e.message });
      }
    })();
  }, [selectedTeacher, selectedClass, dateStr]);

  const handleSave = async () => {
    if (!selectedTeacher || !selectedClass || !status) return;
    if (frozen) {
      toast({ variant: "destructive", title: "Frozen period", description: "This date belongs to a frozen financial year." });
      return;
    }
    setSaving(true);
    try {
      await saveTeacherAttendance([{ teacher_id: selectedTeacher, class_id: selectedClass, date: dateStr, status }]);
      setExisting(true);
      toast({ title: "Saved", description: `Attendance saved for ${format(date, "dd MMM yyyy")}` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const rec = history.find((r) => r.id === id);
    if (rec && isDateFrozen(rec.date)) {
      toast({ variant: "destructive", title: "Frozen", description: "Cannot delete a frozen-period record." });
      return;
    }
    const { error } = await supabase.from("teacher_attendance").delete().eq("id", id);
    if (error) toast({ variant: "destructive", title: "Error", description: error.message });
    else {
      setHistory((prev) => prev.filter((r) => r.id !== id));
      toast({ title: "Deleted", description: "Attendance record deleted" });
    }
  };

  const handleExport = async () => {
    if (!selectedTeacher || !selectedClass) return;
    const { data: rows } = await supabase
      .from("teacher_attendance").select("id, status").eq("class_id", selectedClass)
      .eq("teacher_id", selectedTeacher).eq("date", dateStr);
    const cls = teacherClasses.find((c) => c.id === selectedClass);
    exportToCSV([{
      id: rows?.[0]?.id || "",
      teacher_email: teacherInfo?.email || "",
      class_subject: cls?.subject || "",
      date: formatDateForExport(dateStr),
      status: status || "",
    }], [
      { key: "id", label: "id" },
      { key: "teacher_email", label: "teacher_email" },
      { key: "class_subject", label: "class_subject" },
      { key: "date", label: "date" },
      { key: "status", label: "status" },
    ], "teacher-attendance-export");
    navigate("/preview-download");
  };

  if (loading) return <PageSkeleton />;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => filterTeacherId ? navigate(`/admin/teachers/${filterTeacherId}`) : navigate("/admin/dashboard")} aria-label="Go back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <img src={logo} alt="4D Academy" className="h-10" />
          <div>
            <h1 className="text-xl font-bold">
              {filterTeacherId ? `Attendance${teacherName ? ` — ${teacherName}` : ""}` : "Teacher Attendance"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {filterTeacherId ? "View attendance history" : "Mark teacher attendance by class and batch"}
            </p>
          </div>
          <Button variant="outline" className="ml-auto" onClick={() => navigate("/admin/attendance/coverage")}>
            <ClipboardList className="h-4 w-4 mr-2" />Coverage
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        {filterTeacherId ? (
          <TeacherHistoryView records={history} onDelete={handleDelete} />
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Select Teacher, Class, Batch and Date</CardTitle>
                <CardDescription>Only classes assigned to the selected teacher are listed</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Teacher</label>
                  <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
                    <SelectTrigger><SelectValue placeholder="Select a teacher" /></SelectTrigger>
                    <SelectContent>
                      {teachers.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.full_name}{t.employee_id ? ` (${t.employee_id})` : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Batch</label>
                  <Select value={batchFilter} onValueChange={setBatchFilter} disabled={!selectedTeacher}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>All batches</SelectItem>
                      {batchOptions.map((b) => <SelectItem key={b} value={b}>Batch {b}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Class</label>
                  <Select value={selectedClass} onValueChange={setSelectedClass} disabled={!selectedTeacher}>
                    <SelectTrigger><SelectValue placeholder="Select a class" /></SelectTrigger>
                    <SelectContent>
                      {visibleClasses.map((cls) => (
                        <SelectItem key={cls.id} value={cls.id}>
                          {cls.subject}{cls.class ? ` — Class ${cls.class}` : ""}{cls.section ? ` (Batch ${cls.section})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />{format(date, "PPP")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus className={cn("p-3 pointer-events-auto")} />
                    </PopoverContent>
                  </Popover>
                </div>
              </CardContent>
            </Card>

            {selectedTeacher && !teacherClasses.length && (
              <Card><CardContent className="py-8 text-center text-muted-foreground">This teacher has no assigned classes.</CardContent></Card>
            )}

            {frozen && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <Lock className="h-4 w-4" /> This date falls in a frozen financial year — attendance cannot be changed.
              </div>
            )}

            {selectedTeacher && selectedClass && (
              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <CardTitle>{teacherInfo?.full_name}</CardTitle>
                      <CardDescription>
                        {existing ? "Existing record — update the status below" : "No record yet for this teacher, class and date"}
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" onClick={handleExport} disabled={!status}>
                        <FileDown className="h-4 w-4 mr-2" />Export CSV
                      </Button>
                      <ImportTeacherAttendanceDialog onImported={() => setDate(new Date(dateStr))} />
                      <Button onClick={handleSave} disabled={saving || !status || frozen || beforeJoining}>
                        <Save className="h-4 w-4 mr-2" />{saving ? "Saving..." : existing ? "Update" : "Save"}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {beforeJoining ? (
                    <p className="text-destructive text-sm">
                      This date is before the teacher's joining date ({format(new Date(teacherInfo!.joining_date), "PPP")}).
                    </p>
                  ) : (
                    <div className="flex gap-2">
                      {(["present", "absent"] as const).map((s) => (
                        <Button key={s} variant={status === s ? (s === "present" ? "default" : "destructive") : "outline"}
                          className="capitalize min-w-[100px]" disabled={frozen}
                          onClick={() => setStatus(s)}>{s}</Button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>
      <BottomNav role="admin" />
      <div className="h-16 md:hidden" />
    </div>
  );
};

export default TeacherAttendance;
