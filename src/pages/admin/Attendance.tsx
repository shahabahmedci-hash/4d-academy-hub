import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Check, X, Save } from "lucide-react";
import BottomNav from "@/components/shared/BottomNav";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";

interface ClassOption {
  id: string;
  subject: string;
  class: string | null;
  section: string | null;
}

interface StudentRow {
  id: string;
  user_id: string | null;
  profiles: { full_name: string } | null;
  student_id: string | null;
}

interface AttendanceRecord {
  student_id: string;
  status: "present" | "absent";
}

const Attendance = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [attendance, setAttendance] = useState<Record<string, "present" | "absent">>({});
  const [existingRecords, setExistingRecords] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadClasses();
  }, []);

  useEffect(() => {
    if (selectedClass) {
      loadStudentsAndAttendance();
    }
  }, [selectedClass, selectedDate]);

  const loadClasses = async () => {
    const { data } = await supabase.from("classes").select("id, subject, class, section").order("class");
    if (data) {
      const unique = data.filter((c, i, arr) => arr.findIndex(x => x.id === c.id) === i);
      setClasses(unique);
    }
  };

  const loadStudentsAndAttendance = async () => {
    setLoading(true);
    try {
      // Get enrolled students for this class
      const { data: enrollments } = await supabase
        .from("class_enrollments")
        .select("student_id")
        .eq("class_id", selectedClass);

      if (!enrollments?.length) {
        setStudents([]);
        setAttendance({});
        setExistingRecords(false);
        setLoading(false);
        return;
      }

      const studentIds = enrollments.map(e => e.student_id);
      const { data: studentData } = await supabase
        .from("students")
        .select("id, user_id, student_id, profiles:user_id(full_name)")
        .in("id", studentIds);

      setStudents((studentData as any) || []);

      // Check existing attendance
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const { data: existing } = await supabase
        .from("attendance")
        .select("student_id, status")
        .eq("class_id", selectedClass)
        .eq("date", dateStr);

      if (existing?.length) {
        setExistingRecords(true);
        const map: Record<string, "present" | "absent"> = {};
        existing.forEach(r => { map[r.student_id] = r.status; });
        setAttendance(map);
      } else {
        setExistingRecords(false);
        const map: Record<string, "present" | "absent"> = {};
        studentIds.forEach(id => { map[id] = "present"; });
        setAttendance(map);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = (studentId: string) => {
    setAttendance(prev => ({
      ...prev,
      [studentId]: prev[studentId] === "present" ? "absent" : "present",
    }));
  };

  const markAllPresent = () => {
    const map: Record<string, "present" | "absent"> = {};
    students.forEach(s => { map[s.id] = "present"; });
    setAttendance(map);
  };

  const saveAttendance = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const dateStr = format(selectedDate, "yyyy-MM-dd");

      if (existingRecords) {
        // Delete existing then re-insert
        await supabase.from("attendance").delete().eq("class_id", selectedClass).eq("date", dateStr);
      }

      const records = Object.entries(attendance).map(([student_id, status]) => ({
        student_id,
        class_id: selectedClass,
        date: dateStr,
        status,
        marked_by: user.id,
      }));

      const { error } = await supabase.from("attendance").insert(records);
      if (error) throw error;

      setExistingRecords(true);
      toast({ title: "Attendance saved", description: `Saved for ${records.length} students` });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const presentCount = Object.values(attendance).filter(s => s === "present").length;
  const absentCount = Object.values(attendance).filter(s => s === "absent").length;

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold">Student Attendance</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Filters */}
        <div className="flex gap-2">
          <Select value={selectedClass} onValueChange={setSelectedClass}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Select Class" />
            </SelectTrigger>
            <SelectContent>
              {classes.map(c => (
                <SelectItem key={c.id} value={c.id}>
                  {c.subject} {c.class ? `(${c.class}${c.section ? `-${c.section}` : ""})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[140px] justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(selectedDate, "dd MMM")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => d && setSelectedDate(d)}
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>

        {selectedClass && !loading && students.length > 0 && (
          <>
            {/* Summary */}
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Badge variant="default">{presentCount} Present</Badge>
                <Badge variant="destructive">{absentCount} Absent</Badge>
              </div>
              <Button variant="outline" size="sm" onClick={markAllPresent}>All Present</Button>
            </div>

            {/* Student List */}
            <Card>
              <CardContent className="p-0">
                {students.map((student, i) => (
                  <div
                    key={student.id}
                    className={cn(
                      "flex items-center justify-between px-4 py-3",
                      i < students.length - 1 && "border-b border-border"
                    )}
                  >
                    <div>
                      <p className="font-medium text-sm">{(student.profiles as any)?.full_name || "Unknown"}</p>
                      {student.student_id && <p className="text-xs text-muted-foreground">{student.student_id}</p>}
                    </div>
                    <Button
                      variant={attendance[student.id] === "present" ? "default" : "destructive"}
                      size="sm"
                      onClick={() => toggleStatus(student.id)}
                    >
                      {attendance[student.id] === "present" ? <Check className="h-4 w-4 mr-1" /> : <X className="h-4 w-4 mr-1" />}
                      {attendance[student.id] === "present" ? "P" : "A"}
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Button className="w-full" onClick={saveAttendance} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Saving..." : existingRecords ? "Update Attendance" : "Save Attendance"}
            </Button>
          </>
        )}

        {selectedClass && !loading && students.length === 0 && (
          <Card><CardContent className="p-8 text-center text-muted-foreground">No students enrolled in this class</CardContent></Card>
        )}

        {!selectedClass && (
          <Card><CardContent className="p-8 text-center text-muted-foreground">Select a class to mark attendance</CardContent></Card>
        )}
      </div>

      <BottomNav role="admin" />
    </div>
  );
};

export default Attendance;
