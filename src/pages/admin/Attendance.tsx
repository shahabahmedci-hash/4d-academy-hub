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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, FileDown, Trash2, Calendar as CalendarIcon, CheckCheck, Lock, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ImportAttendanceDialog } from "@/components/admin/ImportAttendanceDialog";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { exportToCSV, formatDateForExport } from "@/lib/csvExport";
import AttendancePieChart from "@/components/student/AttendancePieChart";
import AttendanceMonthlyBreakdown from "@/components/student/AttendanceMonthlyBreakdown";
import { useFinancialYearFreeze } from "@/hooks/useFinancialYearFreeze";
import DateRangePicker from "@/components/shared/DateRangePicker";
import { DateRange, isWithinRange } from "@/lib/dateRange";
import {
  AttendanceRecord, AttendanceStatus, EligibleStudent, computeAttendanceStats,
  fetchClassAttendanceMap, fetchEligibleStudents, fetchStudentAttendance, saveStudentAttendance,
} from "@/hooks/useAttendanceQuery";

interface ClassRow {
  id: string;
  subject: string;
  class: string | null;
  section: string | null;
  day_of_week: number;
}

const ALL = "__all__";

function getAcademicYear(dateStr: string): string {
  const d = new Date(dateStr);
  const startYear = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${startYear}-${String(startYear + 1).slice(2)}`;
}

const StudentAttendanceHistoryView = ({ records, onDelete }: {
  records: AttendanceRecord[];
  onDelete: (id: string) => void;
}) => {
  const [activeStatus, setActiveStatus] = useState<string | null>(null);
  const [classFilter, setClassFilter] = useState<string>(ALL);
  const [batchFilter, setBatchFilter] = useState<string>(ALL);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  const classOptions = useMemo(
    () => [...new Set(records.map((r) => r.classes.class).filter(Boolean) as string[])].sort(),
    [records],
  );
  const batchOptions = useMemo(
    () => [...new Set(records
      .filter((r) => classFilter === ALL || r.classes.class === classFilter)
      .map((r) => r.classes.section).filter(Boolean) as string[])].sort(),
    [records, classFilter],
  );

  // Single filtered dataset feeds list, charts and statistics.
  const filtered = useMemo(() => records.filter((r) => {
    if (classFilter !== ALL && r.classes.class !== classFilter) return false;
    if (batchFilter !== ALL && r.classes.section !== batchFilter) return false;
    if (!isWithinRange(r.date, dateRange)) return false;
    if (activeStatus && r.status !== activeStatus) return false;
    return true;
  }), [records, classFilter, batchFilter, dateFilter, activeStatus]);

  const chartRecords = useMemo(() => records.filter((r) => {
    if (classFilter !== ALL && r.classes.class !== classFilter) return false;
    if (batchFilter !== ALL && r.classes.section !== batchFilter) return false;
    if (!isWithinRange(r.date, dateRange)) return false;
    return true;
  }), [records, classFilter, batchFilter, dateFilter]);

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
              {classOptions.map((c) => <SelectItem key={c} value={c}>Class {c}</SelectItem>)}
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
          <AttendancePieChart records={chartRecords} onStatusClick={(s: string) => setActiveStatus((prev) => prev === s ? null : s)} activeStatus={activeStatus} />
          <AttendanceMonthlyBreakdown records={chartRecords} activeStatus={activeStatus} academicYear={academicYear} />
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

const AdminAttendance = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const filterStudentId = searchParams.get("student_id");
  const { toast } = useToast();
  const { isDateFrozen } = useFinancialYearFreeze();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filterStudentName, setFilterStudentName] = useState<string | null>(null);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);

  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [gradeFilter, setGradeFilter] = useState<string>(ALL);
  const [batchFilter, setBatchFilter] = useState<string>(ALL);
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [date, setDate] = useState<Date>(new Date());
  const [students, setStudents] = useState<EligibleStudent[]>([]);
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
  const [confirmAllOpen, setConfirmAllOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const dateStr = format(date, "yyyy-MM-dd");
  const frozen = isDateFrozen(dateStr);

  useEffect(() => { init(); }, []);

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/"); return; }
    const [adminResult, coAdminResult] = await Promise.all([supabase.rpc("is_admin"), supabase.rpc("is_co_admin")]);
    if (!adminResult.data && !coAdminResult.data) { navigate("/student/dashboard"); return; }

    if (filterStudentId) {
      await loadHistory();
    } else {
      const { data } = await supabase.from("classes").select("id, subject, class, section, day_of_week").order("subject");
      setClasses(data || []);
    }
    setLoading(false);
  };

  const loadHistory = async () => {
    try {
      const { data: student } = await supabase.from("students").select("user_id").eq("id", filterStudentId!).maybeSingle();
      if (student?.user_id) {
        const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", student.user_id).maybeSingle();
        if (profile) setFilterStudentName(profile.full_name);
      }
      setHistory(await fetchStudentAttendance(filterStudentId!));
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    }
  };

  const gradeOptions = useMemo(
    () => [...new Set(classes.map((c) => c.class).filter(Boolean) as string[])].sort(), [classes]);
  const batchOptions = useMemo(
    () => [...new Set(classes.filter((c) => gradeFilter === ALL || c.class === gradeFilter)
      .map((c) => c.section).filter(Boolean) as string[])].sort(), [classes, gradeFilter]);
  const visibleClasses = useMemo(() => classes.filter((c) =>
    (gradeFilter === ALL || c.class === gradeFilter) && (batchFilter === ALL || c.section === batchFilter)
  ), [classes, gradeFilter, batchFilter]);

  const selectedClassInfo = useMemo(() => classes.find((c) => c.id === selectedClass), [classes, selectedClass]);

  useEffect(() => {
    if (selectedClass && !visibleClasses.some((c) => c.id === selectedClass)) setSelectedClass("");
  }, [visibleClasses, selectedClass]);

  useEffect(() => {
    if (selectedClass) loadRoster();
    else { setStudents([]); setAttendance({}); }
  }, [selectedClass, dateStr]);

  const loadRoster = async () => {
    setLoadError(null);
    try {
      const eligible = await fetchEligibleStudents(selectedClass, dateStr);
      setStudents(eligible);
      const existing = await fetchClassAttendanceMap(selectedClass, dateStr);
      const map: Record<string, AttendanceStatus> = {};
      eligible.forEach((s) => {
        const status = existing[s.id];
        if (status === "present" || status === "absent") map[s.id] = status;
      });
      setAttendance(map);
    } catch (e: any) {
      setStudents([]);
      setAttendance({});
      setLoadError(e.message);
      toast({ variant: "destructive", title: "Could not load roster", description: e.message });
    }
  };

  const present = Object.values(attendance).filter((s) => s === "present").length;
  const absent = Object.values(attendance).filter((s) => s === "absent").length;
  const unmarked = students.length - present - absent;

  const handleSave = async () => {
    if (!selectedClass) return;
    if (frozen) {
      toast({ variant: "destructive", title: "Frozen period", description: "This date belongs to a frozen financial year." });
      return;
    }
    setSaving(true);
    try {
      const rows = students
        .filter((s) => attendance[s.id])
        .map((s) => ({ student_id: s.id, class_id: selectedClass, date: dateStr, status: attendance[s.id] }));
      if (rows.length === 0) throw new Error("Mark at least one student before saving");
      await saveStudentAttendance(rows);
      toast({ title: "Saved", description: `Attendance saved for ${format(date, "dd MMM yyyy")}` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const markAllPresent = () => {
    const map: Record<string, AttendanceStatus> = {};
    students.forEach((s) => { map[s.id] = "present"; });
    setAttendance(map);
    setConfirmAllOpen(false);
  };

  const handleExport = async () => {
    const { data: attRecords } = await supabase
      .from("attendance").select("id, student_id").eq("class_id", selectedClass).eq("date", dateStr);
    const attById = Object.fromEntries((attRecords || []).map((r) => [r.student_id, r.id]));
    const rows = students.filter((s) => attendance[s.id]).map((s) => ({
      id: attById[s.id] || "",
      student_email: s.email,
      class_subject: selectedClassInfo?.subject || "",
      date: formatDateForExport(dateStr),
      status: attendance[s.id],
    }));
    exportToCSV(rows, [
      { key: "id", label: "id" },
      { key: "student_email", label: "student_email" },
      { key: "class_subject", label: "class_subject" },
      { key: "date", label: "date" },
      { key: "status", label: "status" },
    ], "attendance-export");
    navigate("/preview-download");
  };

  if (loading) return <PageSkeleton />;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => filterStudentId ? navigate(`/admin/students/${filterStudentId}`) : navigate("/admin/dashboard")} aria-label="Go back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {filterStudentId ? `Attendance${filterStudentName ? ` — ${filterStudentName}` : ""}` : "Students Attendance"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {filterStudentId ? "View attendance history" : "Record student attendance for classes"}
            </p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {filterStudentId ? (
          <StudentAttendanceHistoryView
            records={history}
            onDelete={async (id: string) => {
              const rec = history.find((r) => r.id === id);
              if (rec && isDateFrozen(rec.date)) {
                toast({ variant: "destructive", title: "Frozen", description: "Cannot delete a frozen-period record." });
                return;
              }
              const { error } = await supabase.from("attendance").delete().eq("id", id);
              if (error) toast({ variant: "destructive", title: "Error", description: error.message });
              else {
                setHistory((prev) => prev.filter((r) => r.id !== id));
                toast({ title: "Deleted", description: "Attendance record deleted" });
              }
            }}
          />
        ) : (
          <>
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Select Class, Batch and Date</CardTitle>
                <CardDescription>Only students enrolled in that class on the chosen date are listed</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Class</label>
                  <Select value={gradeFilter} onValueChange={(v) => { setGradeFilter(v); setBatchFilter(ALL); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>All classes</SelectItem>
                      {gradeOptions.map((g) => <SelectItem key={g} value={g}>Class {g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Batch</label>
                  <Select value={batchFilter} onValueChange={setBatchFilter}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>All batches</SelectItem>
                      {batchOptions.map((b) => <SelectItem key={b} value={b}>Batch {b}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Subject / Class session</label>
                  <Select value={selectedClass} onValueChange={setSelectedClass}>
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

            {frozen && (
              <div className="mb-6 flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <Lock className="h-4 w-4" /> This date falls in a frozen financial year — attendance cannot be changed.
              </div>
            )}

            {selectedClass && (
              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <CardTitle>Students Attendance</CardTitle>
                      <CardDescription>Mark students as present or absent</CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" onClick={() => setConfirmAllOpen(true)} disabled={students.length === 0 || frozen}>
                        <CheckCheck className="h-4 w-4 mr-2" />Mark all Present
                      </Button>
                      <Button variant="outline" onClick={handleExport} disabled={Object.keys(attendance).length === 0}>
                        <FileDown className="h-4 w-4 mr-2" />Export CSV
                      </Button>
                      <ImportAttendanceDialog onAttendanceImported={() => { if (selectedClass) loadRoster(); }} />
                      <Button onClick={handleSave} disabled={saving || frozen || students.length === 0}>
                        <Save className="h-4 w-4 mr-2" />{saving ? "Saving..." : "Save Attendance"}
                      </Button>
                    </div>
                  </div>
                  {students.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      <Badge variant="default">{present} Present</Badge>
                      <Badge variant="destructive">{absent} Absent</Badge>
                      <Badge variant="secondary">{unmarked} Unmarked</Badge>
                      <Badge variant="outline">{students.length} Total</Badge>
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  {students.length === 0 ? (
                    <p className={cn("text-center py-8", loadError ? "text-destructive" : "text-muted-foreground")}>
                      {loadError ? "Roster could not be loaded." : "No students belonged to this class on the selected date."}
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {students.map((student) => (
                        <div key={student.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border rounded-lg">
                          <div>
                            <p className="font-medium">{student.full_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {student.student_id || "No ID"}
                              {student.class ? ` · Class ${student.class}` : ""}
                              {student.section ? ` · Batch ${student.section}` : ""}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" disabled={frozen}
                              variant={attendance[student.id] === "present" ? "default" : "outline"}
                              onClick={() => setAttendance((p) => ({ ...p, [student.id]: "present" }))}>Present</Button>
                            <Button size="sm" disabled={frozen}
                              variant={attendance[student.id] === "absent" ? "destructive" : "outline"}
                              onClick={() => setAttendance((p) => ({ ...p, [student.id]: "absent" }))}>Absent</Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>

      <AlertDialog open={confirmAllOpen} onOpenChange={setConfirmAllOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark all students present?</AlertDialogTitle>
            <AlertDialogDescription>
              This sets all {students.length} listed students to Present for {format(date, "PPP")}. Nothing is saved until you press Save Attendance.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={markAllPresent}>Mark all Present</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BottomNav role="admin" />
      <div className="h-16 md:hidden" />
    </div>
  );
};

export default AdminAttendance;
