import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Check, X, Save } from "lucide-react";
import BottomNav from "@/components/shared/BottomNav";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";

interface TeacherRow {
  id: string;
  user_id: string;
  employee_id: string | null;
  profiles: { full_name: string } | null;
}

const TeacherAttendance = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const [existingRecords, setExistingRecords] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: teacherData } = await supabase
        .from("teachers")
        .select("id, user_id, employee_id, profiles:user_id(full_name)")
        .order("created_at");

      setTeachers((teacherData as any) || []);

      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const { data: existing } = await supabase
        .from("teacher_attendance")
        .select("teacher_id, status")
        .eq("date", dateStr);

      if (existing?.length) {
        setExistingRecords(true);
        const map: Record<string, string> = {};
        existing.forEach(r => { map[r.teacher_id] = r.status; });
        setAttendance(map);
      } else {
        setExistingRecords(false);
        const map: Record<string, string> = {};
        (teacherData || []).forEach((t: any) => { map[t.id] = "present"; });
        setAttendance(map);
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = (teacherId: string) => {
    setAttendance(prev => ({
      ...prev,
      [teacherId]: prev[teacherId] === "present" ? "absent" : "present",
    }));
  };

  const saveAttendance = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const dateStr = format(selectedDate, "yyyy-MM-dd");

      if (existingRecords) {
        await supabase.from("teacher_attendance").delete().eq("date", dateStr);
      }

      const records = Object.entries(attendance).map(([teacher_id, status]) => ({
        teacher_id,
        date: dateStr,
        status,
        marked_by: user.id,
      }));

      const { error } = await supabase.from("teacher_attendance").insert(records);
      if (error) throw error;

      setExistingRecords(true);
      toast({ title: "Saved", description: `Teacher attendance saved for ${format(selectedDate, "dd MMM yyyy")}` });
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
          <h1 className="text-lg font-bold">Teacher Attendance</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-start text-left font-normal">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {format(selectedDate, "PPP")}
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

        {!loading && teachers.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Badge variant="default">{presentCount} Present</Badge>
                <Badge variant="destructive">{absentCount} Absent</Badge>
              </div>
            </div>

            <Card>
              <CardContent className="p-0">
                {teachers.map((teacher, i) => (
                  <div
                    key={teacher.id}
                    className={cn(
                      "flex items-center justify-between px-4 py-3",
                      i < teachers.length - 1 && "border-b border-border"
                    )}
                  >
                    <div>
                      <p className="font-medium text-sm">{(teacher.profiles as any)?.full_name || "Unknown"}</p>
                      {teacher.employee_id && <p className="text-xs text-muted-foreground">{teacher.employee_id}</p>}
                    </div>
                    <Button
                      variant={attendance[teacher.id] === "present" ? "default" : "destructive"}
                      size="sm"
                      onClick={() => toggleStatus(teacher.id)}
                    >
                      {attendance[teacher.id] === "present" ? <Check className="h-4 w-4 mr-1" /> : <X className="h-4 w-4 mr-1" />}
                      {attendance[teacher.id] === "present" ? "P" : "A"}
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

        {!loading && teachers.length === 0 && (
          <Card><CardContent className="p-8 text-center text-muted-foreground">No teachers found</CardContent></Card>
        )}
      </div>

      <BottomNav role="admin" />
    </div>
  );
};

export default TeacherAttendance;
