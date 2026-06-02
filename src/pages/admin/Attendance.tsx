import { useEffect, useState, useMemo } from "react";
import BottomNav from "@/components/shared/BottomNav";
import PageSkeleton from "@/components/shared/PageSkeleton";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, FileDown, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ImportAttendanceDialog } from "@/components/admin/ImportAttendanceDialog";
import { useToast } from "@/hooks/use-toast";
import { format, subWeeks, addWeeks, startOfWeek, addDays } from "date-fns";
import { exportToCSV, formatDateForExport } from "@/lib/csvExport";
import AttendancePieChart from "@/components/student/AttendancePieChart";
import AttendanceMonthlyBreakdown from "@/components/student/AttendanceMonthlyBreakdown";
import { useFinancialYearFreeze } from "@/hooks/useFinancialYearFreeze";

interface Student {
  id: string;
  user_id: string | null;
  enrolled_at: string;
  profiles?: {
    full_name: string;
    email: string;
  };
}

interface Class {
  id: string;
  subject: string;
  day_of_week: number;
}

function getAcademicYear(dateStr: string): string {
  const d = new Date(dateStr);
  const month = d.getMonth();
  const year = d.getFullYear();
  const startYear = month >= 3 ? year : year - 1;
  return `${startYear}-${String(startYear + 1).slice(2)}`;
}

const StudentAttendanceHistoryView = ({ records, studentName, onDelete }: {
  records: any[];
  studentName: string | null;
  onDelete: (id: string) => void;
}) => {
  const [activeStatus, setActiveStatus] = useState<string | null>(null);

  const formattedRecords = useMemo(() => records.map((r: any) => ({
    id: r.id,
    date: r.date,
    status: r.status,
    notes: r.notes || null,
    classes: r.classes || { subject: "Unknown", class: null, section: null },
  })), [records]);

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
          <AttendancePieChart records={formattedRecords} onStatusClick={(s: string) => setActiveStatus((prev: string | null) => prev === s ? null : s)} activeStatus={activeStatus} />
          <AttendanceMonthlyBreakdown records={formattedRecords} activeStatus={activeStatus} academicYear={academicYear} />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Attendance Records</CardTitle>
          <CardDescription>{records.length} records found</CardDescription>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No attendance records found</p>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {records.map((record: any) => (
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

const AdminAttendance = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const filterStudentId = searchParams.get("student_id");
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [filterStudentName, setFilterStudentName] = useState<string | null>(null);
  const [studentAttendanceHistory, setStudentAttendanceHistory] = useState<any[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const { isDateFrozen } = useFinancialYearFreeze();

  useEffect(() => {
    checkAuth();
    if (filterStudentId) {
      loadStudentAttendanceHistory();
    } else {
      loadData();
    }
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/");
      return;
    }

    const [adminResult, coAdminResult] = await Promise.all([
      supabase.rpc("is_admin"),
      supabase.rpc("is_co_admin")
    ]);
    
    if (!adminResult.data && !coAdminResult.data) {
      navigate("/student/dashboard");
    }
  };

  const loadData = async () => {
    try {
      // Load all classes with day_of_week
      const { data: classesData, error: classesError } = await supabase
        .from("classes")
        .select("id, subject, day_of_week")
        .order("subject");
      
      if (classesError) throw classesError;
      setClasses(classesData || []);

    } catch (error) {
      console.error("Error loading data:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load data",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadStudentAttendanceHistory = async () => {
    try {
      // Get the student's name
      const { data: student } = await supabase
        .from("students")
        .select("user_id")
        .eq("id", filterStudentId!)
        .maybeSingle();

      if (student?.user_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", student.user_id)
          .maybeSingle();
        if (profile) setFilterStudentName(profile.full_name);
      }

      // Get attendance records
      const { data: records, error } = await supabase
        .from("attendance")
        .select("*, classes:class_id(subject)")
        .eq("student_id", filterStudentId!)
        .order("date", { ascending: false });

      if (error) throw error;
      setStudentAttendanceHistory(records || []);
    } catch (error) {
      console.error("Error loading student attendance:", error);
    } finally {
      setLoading(false);
    }
  };

  // Get selected class info
  const selectedClassInfo = useMemo(() => {
    return classes.find(c => c.id === selectedClass);
  }, [classes, selectedClass]);

  // Generate valid class dates based on day_of_week
  const validClassDates = useMemo(() => {
    if (!selectedClassInfo) return [];
    
    const dates: Date[] = [];
    const today = new Date();
    const startDate = subWeeks(today, 12);
    const endDate = addWeeks(today, 4);
    
    const startOfWeekDate = startOfWeek(startDate, { weekStartsOn: 0 });
    let currentDate = addDays(startOfWeekDate, selectedClassInfo.day_of_week);
    
    while (currentDate <= endDate) {
      if (currentDate >= startDate) {
        dates.push(new Date(currentDate));
      }
      currentDate = addDays(currentDate, 7);
    }
    
    return dates;
  }, [selectedClassInfo]);

  // Set initial selected date when class changes
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

  const loadStudentsForClass = async () => {
    if (!selectedClass || !selectedDate) return;

    try {
      // Get enrolled students for this class
      const { data: enrollments, error: enrollError } = await supabase
        .from("class_enrollments")
        .select("student_id")
        .eq("class_id", selectedClass);

      if (enrollError) throw enrollError;

      if (enrollments && enrollments.length > 0) {
        const studentIds = enrollments.map(e => e.student_id);

        // Fetch students with their actual enrollment_date
        const { data: studentsData, error: studentsError } = await supabase
          .from("students")
          .select("id, user_id, enrollment_date")
          .in("id", studentIds);

        if (studentsError) throw studentsError;

        if (studentsData && studentsData.length > 0) {
          // Filter students who were enrolled on or before the selected date
          const eligibleStudents = studentsData.filter(s => {
            const enrolledDate = new Date(s.enrollment_date).setHours(0, 0, 0, 0);
            const selectedDateObj = new Date(selectedDate).setHours(0, 0, 0, 0);
            return enrolledDate <= selectedDateObj;
          });

          if (eligibleStudents.length === 0) {
            setStudents([]);
            return;
          }

          const userIds = eligibleStudents.map(s => s.user_id).filter(Boolean) as string[];
          const { data: profilesData } = await supabase
            .from("profiles")
            .select("id, full_name, email")
            .in("id", userIds);

          const profilesById = Object.fromEntries(
            (profilesData || []).map(p => [p.id, p])
          );

          const enrichedStudents = eligibleStudents.map(s => ({
            ...s,
            enrolled_at: s.enrollment_date,
            profiles: s.user_id ? profilesById[s.user_id] : undefined,
          }));

          setStudents(enrichedStudents);
        } else {
          setStudents([]);
        }
      } else {
        setStudents([]);
      }
    } catch (error) {
      console.error("Error loading students:", error);
    }
  };

  const loadExistingAttendance = async () => {
    if (!selectedClass || !selectedDate) return;

    try {
      const { data, error } = await supabase
        .from("attendance")
        .select("student_id, status")
        .eq("class_id", selectedClass)
        .eq("date", selectedDate);

      if (error) throw error;

      const attendanceMap: Record<string, string> = {};
      data?.forEach((record) => {
        attendanceMap[record.student_id] = record.status;
      });
      setAttendance(attendanceMap);
    } catch (error) {
      console.error("Error loading attendance:", error);
    }
  };

  useEffect(() => {
    if (selectedClass && selectedDate) {
      loadStudentsForClass();
      loadExistingAttendance();
    }
  }, [selectedClass, selectedDate]);

  const handleSaveAttendance = async () => {
    if (!selectedClass) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a class",
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Delete existing attendance for this class and date
      await supabase
        .from("attendance")
        .delete()
        .eq("class_id", selectedClass)
        .eq("date", selectedDate);

      // Insert new attendance records
      const records = Object.entries(attendance).map(([studentId, status]) => ({
        student_id: studentId,
        class_id: selectedClass,
        date: selectedDate,
        status: status as "present" | "absent",
        marked_by: user?.id,
      }));

      const { error } = await supabase.from("attendance").insert(records);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Attendance saved successfully",
      });
    } catch (error) {
      console.error("Error saving attendance:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save attendance",
      });
    }
  };

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
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
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {filterStudentId ? (
          <StudentAttendanceHistoryView
            records={studentAttendanceHistory}
            studentName={filterStudentName}
            onDelete={async (id: string) => {
              const { error } = await supabase.from("attendance").delete().eq("id", id);
              if (error) {
                toast({ variant: "destructive", title: "Error", description: "Failed to delete record" });
              } else {
                setStudentAttendanceHistory(prev => prev.filter(r => r.id !== id));
                toast({ title: "Deleted", description: "Attendance record deleted" });
              }
            }}
          />
        ) : (
        <>
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Select Class and Date</CardTitle>
            <CardDescription>Choose a class and date to mark attendance</CardDescription>
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
                        {cls.subject}
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
                  <CardTitle>Students Attendance</CardTitle>
                  <CardDescription>Mark students as present or absent</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={async () => {
                      // Need to get attendance record ids for export
                      const { data: attRecords } = await supabase
                        .from("attendance")
                        .select("id, student_id, status")
                        .eq("class_id", selectedClass)
                        .eq("date", selectedDate);
                      const attById = Object.fromEntries((attRecords || []).map((r: any) => [r.student_id, r.id]));
                      const data = students
                        .filter((s) => attendance[s.id])
                        .map((s) => ({
                          id: attById[s.id] || "",
                          student_email: s.profiles?.email || "",
                          class_subject: selectedClassInfo?.subject || "",
                          date: formatDateForExport(selectedDate),
                          status: attendance[s.id] || "",
                        }));
                      exportToCSV(data, [
                        { key: "id", label: "id" },
                        { key: "student_email", label: "student_email" },
                        { key: "class_subject", label: "class_subject" },
                        { key: "date", label: "date" },
                        { key: "status", label: "status" },
                      ], "attendance-export");
                      navigate("/preview-download");
                    }}
                    disabled={Object.keys(attendance).length === 0}
                  >
                    <FileDown className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                  <ImportAttendanceDialog onAttendanceImported={() => {
                    if (selectedClass && selectedDate) {
                      loadExistingAttendance();
                    }
                  }} />
                  <Button onClick={handleSaveAttendance}>Save Attendance</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {students.map((student) => (
                  <div
                    key={student.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-medium">
                        {student.profiles?.full_name || "Unknown Student"}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={attendance[student.id] === "present" ? "default" : "outline"}
                        onClick={() =>
                          setAttendance((prev) => ({ ...prev, [student.id]: "present" }))
                        }
                      >
                        Present
                      </Button>
                      <Button
                        size="sm"
                        variant={attendance[student.id] === "absent" ? "destructive" : "outline"}
                        onClick={() =>
                          setAttendance((prev) => ({ ...prev, [student.id]: "absent" }))
                        }
                      >
                        Absent
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {students.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  {selectedDate ? "No students were enrolled on this date" : "No students found"}
                </p>
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

export default AdminAttendance;
