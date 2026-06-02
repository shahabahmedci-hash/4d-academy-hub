import { useEffect, useState, useMemo } from "react";
import BottomNav from "@/components/shared/BottomNav";
import PageSkeleton from "@/components/shared/PageSkeleton";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, FileDown, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format, subWeeks, addWeeks, startOfWeek, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import { exportToCSV, formatDateForExport } from "@/lib/csvExport";
import logo from "@/assets/4d-academy-logo.jpg";
import TeacherAttendancePieChart from "@/components/teacher/TeacherAttendancePieChart";
import TeacherAttendanceMonthlyBreakdown from "@/components/teacher/TeacherAttendanceMonthlyBreakdown";
import { ImportTeacherAttendanceDialog } from "@/components/admin/ImportTeacherAttendanceDialog";
import { useFinancialYearFreeze } from "@/hooks/useFinancialYearFreeze";

interface TeacherRecord {
  teacherId: string;
  name: string;
  email: string;
  employeeId: string | null;
  status: "present" | "absent";
}

interface ClassOption {
  id: string;
  subject: string;
  day_of_week: number;
  class: string | null;
  section: string | null;
}

const statusColors: Record<string, string> = {
  present: "bg-emerald-500 hover:bg-emerald-600 text-white",
  absent: "bg-destructive hover:bg-destructive/90 text-destructive-foreground",
};

function getAcademicYear(dateStr: string): string {
  const d = new Date(dateStr);
  const month = d.getMonth();
  const year = d.getFullYear();
  const startYear = month >= 3 ? year : year - 1;
  return `${startYear}-${String(startYear + 1).slice(2)}`;
}

const TeacherHistoryView = ({ history, teacherName, onDelete }: {
  history: any[];
  teacherName: string;
  onDelete: (id: string) => void;
}) => {
  const [activeStatus, setActiveStatus] = useState<string | null>(null);

  const formattedRecords = useMemo(() => history.map((r: any) => ({
    id: r.id,
    date: r.date,
    status: r.status,
    notes: r.notes || null,
    classes: r.classes || { subject: "Unknown", class: null, section: null },
  })), [history]);

  const academicYear = useMemo(() => {
    if (formattedRecords.length === 0) return "";
    return getAcademicYear(formattedRecords[0].date);
  }, [formattedRecords]);

  const stats = useMemo(() => {
    const present = formattedRecords.filter((r: any) => r.status === "present").length;
    const absent = formattedRecords.filter((r: any) => r.status === "absent").length;
    const total = present + absent;
    const percentage = total > 0 ? Math.round((present / total) * 100) : 0;
    return { present, absent, total, percentage };
  }, [formattedRecords]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6 text-center"><div className="text-3xl font-bold text-emerald-600">{stats.percentage}%</div><p className="text-xs text-muted-foreground">Attendance Rate</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><div className="text-3xl font-bold text-emerald-600">{stats.present}</div><p className="text-xs text-muted-foreground">Present</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><div className="text-3xl font-bold text-destructive">{stats.absent}</div><p className="text-xs text-muted-foreground">Absent</p></CardContent></Card>
      </div>

      {formattedRecords.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          <TeacherAttendancePieChart records={formattedRecords} onStatusClick={(s: string) => setActiveStatus((prev: string | null) => prev === s ? null : s)} activeStatus={activeStatus} />
          <TeacherAttendanceMonthlyBreakdown records={formattedRecords} activeStatus={activeStatus} academicYear={academicYear} />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Attendance Records</CardTitle>
          <CardDescription>{history.length} records found</CardDescription>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No attendance records found</p>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {history.map((record: any) => (
                <div key={record.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{record.classes?.subject || "Unknown Class"}</p>
                    <p className="text-sm text-muted-foreground">{new Date(record.date).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={record.status === "present" ? "default" : "destructive"}>
                      {record.status}
                    </Badge>
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
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [records, setRecords] = useState<TeacherRecord[]>([]);
  const [teacherHistory, setTeacherHistory] = useState<any[]>([]);
  const [teacherName, setTeacherName] = useState<string>("");
  const { isDateFrozen } = useFinancialYearFreeze();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/"); return; }
    const [a, c] = await Promise.all([supabase.rpc("is_admin"), supabase.rpc("is_co_admin")]);
    if (!a.data && !c.data) { navigate("/"); return; }
    setLoading(false);

    if (filterTeacherId) {
      loadTeacherHistory();
    } else {
      loadClasses();
    }
  };

  const loadClasses = async () => {
    const { data, error } = await supabase
      .from("classes")
      .select("id, subject, day_of_week, class, section")
      .order("subject");
    if (error) console.error("Error loading classes:", error);
    setClasses(data || []);
  };

  const loadTeacherHistory = async () => {
    const { data: teacher } = await supabase
      .from("teachers")
      .select("user_id")
      .eq("id", filterTeacherId!)
      .maybeSingle();

    if (teacher?.user_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", teacher.user_id)
        .maybeSingle();
      if (profile) setTeacherName(profile.full_name);
    }

    const { data: records } = await supabase
      .from("teacher_attendance")
      .select("id, date, status, notes, classes:class_id(subject)")
      .eq("teacher_id", filterTeacherId!)
      .order("date", { ascending: false });

    setTeacherHistory(records || []);
  };

  const selectedClassInfo = useMemo(() => {
    return classes.find(c => c.id === selectedClass);
  }, [classes, selectedClass]);

  const validClassDates = useMemo(() => {
    if (!selectedClassInfo) return [];
    const dates: Date[] = [];
    const today = new Date();
    const startDate = subWeeks(today, 12);
    const endDate = addWeeks(today, 4);
    const startOfWeekDate = startOfWeek(startDate, { weekStartsOn: 0 });
    let currentDate = addDays(startOfWeekDate, selectedClassInfo.day_of_week);
    while (currentDate <= endDate) {
      if (currentDate >= startDate) dates.push(new Date(currentDate));
      currentDate = addDays(currentDate, 7);
    }
    return dates;
  }, [selectedClassInfo]);

  useEffect(() => {
    if (selectedClass && validClassDates.length > 0) {
      const today = new Date();
      const pastDates = validClassDates.filter(d => d <= today);
      if (pastDates.length > 0) {
        setSelectedDate(format(pastDates[pastDates.length - 1], "yyyy-MM-dd"));
      } else {
        setSelectedDate(format(validClassDates[0], "yyyy-MM-dd"));
      }
    }
  }, [selectedClass, validClassDates]);

  useEffect(() => {
    if (selectedClass && selectedDate) {
      loadTeachersForClass();
    }
  }, [selectedClass, selectedDate]);

  const loadTeachersForClass = async () => {
    if (!selectedClass || !selectedDate) return;

    const { data: assignments, error: assignError } = await supabase
      .from("teacher_classes")
      .select("teacher_id")
      .eq("class_id", selectedClass);

    if (assignError) { console.error(assignError); return; }
    if (!assignments || assignments.length === 0) { setRecords([]); return; }

    const teacherIds = assignments.map(a => a.teacher_id);

    const { data: teachers } = await supabase
      .from("teachers")
      .select("id, employee_id, user_id")
      .in("id", teacherIds);

    if (!teachers || teachers.length === 0) { setRecords([]); return; }

    const userIds = teachers.map(t => t.user_id).filter(Boolean);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", userIds);
    const profileMap = new Map((profiles || []).map(p => [p.id, { full_name: p.full_name, email: p.email }]));

    const { data: existing } = await supabase
      .from("teacher_attendance")
      .select("teacher_id, status")
      .eq("class_id", selectedClass)
      .eq("date", selectedDate);
    const existingMap = new Map((existing || []).map((e: any) => [e.teacher_id, e.status]));

    const mapped: TeacherRecord[] = teachers.map(t => {
      const profile = profileMap.get(t.user_id);
      return {
        teacherId: t.id,
        name: profile?.full_name || "Unknown",
        email: profile?.email || "",
        employeeId: t.employee_id,
        status: (existingMap.get(t.id) as any) || "present",
      };
    });

    setRecords(mapped);
  };

  const toggleStatus = (idx: number, status: "present" | "absent") => {
    setRecords(prev => prev.map((r, i) => i === idx ? { ...r, status } : r));
  };

  const handleSave = async () => {
    if (!selectedClass) return;
    if (isDateFrozen(selectedDate)) {
      toast({ variant: "destructive", title: "Frozen period", description: "This date is in a frozen financial year." });
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const rows = records.map(r => ({
        teacher_id: r.teacherId,
        class_id: selectedClass,
        date: selectedDate,
        status: r.status,
        marked_by: user?.id,
      }));

      const { error } = await supabase
        .from("teacher_attendance")
        .upsert(rows, { onConflict: "teacher_id,class_id,date" });

      if (error) throw error;

      toast({ title: "Saved", description: `Teacher attendance saved for ${format(new Date(selectedDate), "dd MMM yyyy")}` });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTeacherRecord = async (id: string) => {
    const rec = teacherHistory.find((r: any) => r.id === id);
    if (rec && isDateFrozen(rec.date)) {
      toast({ variant: "destructive", title: "Frozen", description: "Cannot delete frozen-period record." });
      return;
    }
    const { error } = await supabase.from("teacher_attendance").delete().eq("id", id);
    if (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to delete record" });
    } else {
      setTeacherHistory(prev => prev.filter(r => r.id !== id));
      toast({ title: "Deleted", description: "Attendance record deleted" });
    }
  };

  const handleExportCSV = async () => {
    // Get attendance record ids for export
    const { data: attRecords } = await supabase
      .from("teacher_attendance")
      .select("id, teacher_id")
      .eq("class_id", selectedClass)
      .eq("date", selectedDate);
    const attByTeacherId = Object.fromEntries((attRecords || []).map((r: any) => [r.teacher_id, r.id]));
    const data = records.map(r => ({
      id: attByTeacherId[r.teacherId] || "",
      teacher_email: r.email,
      class_subject: selectedClassInfo?.subject || "",
      date: formatDateForExport(selectedDate),
      status: r.status,
    }));
    exportToCSV(data, [
      { key: "id", label: "id" },
      { key: "teacher_email", label: "teacher_email" },
      { key: "class_subject", label: "class_subject" },
      { key: "date", label: "date" },
      { key: "status", label: "status" },
    ], "teacher-attendance-export");
    navigate("/preview-download");
  };

  if (loading) {
    return <PageSkeleton />;
  }

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
              {filterTeacherId ? "View attendance history" : "Mark teacher attendance by class"}
            </p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        {filterTeacherId ? (
          <TeacherHistoryView
            history={teacherHistory}
            teacherName={teacherName}
            onDelete={handleDeleteTeacherRecord}
          />
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Select Class and Date</CardTitle>
                <CardDescription>Choose a class and date to mark teacher attendance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Class</label>
                    <Select value={selectedClass} onValueChange={setSelectedClass}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a class" />
                      </SelectTrigger>
                      <SelectContent>
                        {classes.map((cls) => (
                          <SelectItem key={cls.id} value={cls.id}>
                            {cls.subject}{cls.class ? ` — ${cls.class}` : ""}{cls.section ? ` (${cls.section})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Class Date</label>
                    <Select value={selectedDate} onValueChange={setSelectedDate} disabled={!selectedClass}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a date" />
                      </SelectTrigger>
                      <SelectContent>
                        {validClassDates.map((date) => (
                          <SelectItem key={date.toISOString()} value={format(date, "yyyy-MM-dd")}>
                            {format(date, "EEE, MMM d, yyyy")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {selectedClass && (
              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <CardTitle>Teacher List</CardTitle>
                      <CardDescription>Mark teachers as present or absent</CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" onClick={handleExportCSV} disabled={records.length === 0}>
                        <FileDown className="h-4 w-4 mr-2" />
                        Export CSV
                      </Button>
                      <ImportTeacherAttendanceDialog onImported={() => {
                        if (selectedClass && selectedDate) loadTeachersForClass();
                      }} />
                      <Button onClick={handleSave} disabled={saving || records.length === 0}>
                        <Save className="h-4 w-4 mr-2" />
                        {saving ? "Saving..." : "Save Attendance"}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {records.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No teachers assigned to this class</p>
                  ) : (
                    <div className="space-y-3">
                      {records.map((r, idx) => (
                        <div
                          key={r.teacherId}
                          className="flex items-center justify-between p-3 rounded-lg border bg-card"
                        >
                          <div>
                            <p className="font-medium">{r.name}</p>
                            {r.employeeId && (
                              <p className="text-xs text-muted-foreground">{r.employeeId}</p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            {(["present", "absent"] as const).map((s) => (
                              <Button
                                key={s}
                                size="sm"
                                variant="outline"
                                className={cn(
                                  "capitalize min-w-[70px]",
                                  r.status === s && statusColors[s]
                                )}
                                onClick={() => toggleStatus(idx, s)}
                              >
                                {s}
                              </Button>
                            ))}
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
      <BottomNav role="admin" />
      <div className="h-16 md:hidden" />
    </div>
  );
};

export default TeacherAttendance;
