import { useEffect, useState } from "react";
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
import { ArrowLeft, Calendar as CalendarIcon, Check, X, Save } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useTeacherProfileGate } from "@/hooks/useTeacherProfileGate";

const TeacherAttendanceMark = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { loading: gateLoading, profileCompleted } = useTeacherProfileGate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [date, setDate] = useState<Date>(new Date());
  const [students, setStudents] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const [existing, setExisting] = useState(false);

  useEffect(() => { if (profileCompleted) loadClasses(); }, [profileCompleted]);
  useEffect(() => { if (selectedClass) loadStudents(); }, [selectedClass, date]);

  const loadClasses = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/"); return; }
    const { data: teacher } = await supabase.from("teachers").select("id").eq("user_id", user.id).maybeSingle();
    if (teacher) {
      const { data: tc } = await supabase.from("teacher_classes").select("class_id").eq("teacher_id", teacher.id);
      const ids = (tc || []).map((c) => c.class_id);
      if (ids.length > 0) {
        const { data: cls } = await supabase.from("classes").select("*").in("id", ids);
        setClasses(cls || []);
      }
    }
    setLoading(false);
  };

  const loadStudents = async () => {
    const { data: enr } = await supabase.from("class_enrollments").select("student_id").eq("class_id", selectedClass);
    const sids = (enr || []).map((e) => e.student_id);
    if (sids.length === 0) { setStudents([]); return; }
    const { data: studs } = await supabase.from("students").select("id, student_id, user_id, profiles:user_id(full_name)").in("id", sids);
    setStudents((studs as any) || []);

    const dateStr = format(date, "yyyy-MM-dd");
    const { data: att } = await supabase.from("attendance").select("student_id, status").eq("class_id", selectedClass).eq("date", dateStr);
    if (att?.length) {
      setExisting(true);
      const m: Record<string, string> = {};
      att.forEach((a) => { m[a.student_id] = a.status; });
      setAttendance(m);
    } else {
      setExisting(false);
      const m: Record<string, string> = {};
      (studs || []).forEach((s: any) => { m[s.id] = "present"; });
      setAttendance(m);
    }
  };

  const toggle = (id: string) => {
    setAttendance((p) => ({ ...p, [id]: p[id] === "present" ? "absent" : "present" }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const dateStr = format(date, "yyyy-MM-dd");
      if (existing) await supabase.from("attendance").delete().eq("class_id", selectedClass).eq("date", dateStr);
      const records = Object.entries(attendance).map(([student_id, status]) => ({
        student_id, class_id: selectedClass, date: dateStr, status: status as any, marked_by: user.id,
      }));
      const { error } = await supabase.from("attendance").insert(records);
      if (error) throw error;
      setExisting(true);
      toast({ title: "Saved", description: "Attendance recorded" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  if (loading) return <PageSkeleton />;
  const present = Object.values(attendance).filter((s) => s === "present").length;
  const absent = Object.values(attendance).filter((s) => s === "absent").length;

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/teacher/dashboard")}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="text-lg font-bold">Mark Attendance</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <Select value={selectedClass} onValueChange={setSelectedClass}>
          <SelectTrigger><SelectValue placeholder="Select a class" /></SelectTrigger>
          <SelectContent>
            {classes.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.subject} {c.class ? `- Class ${c.class}` : ""}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-start"><CalendarIcon className="mr-2 h-4 w-4" />{format(date, "PPP")}</Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} className="p-3 pointer-events-auto" /></PopoverContent>
        </Popover>

        {selectedClass && students.length > 0 && (
          <>
            <div className="flex gap-2">
              <Badge variant="default">{present} Present</Badge>
              <Badge variant="destructive">{absent} Absent</Badge>
            </div>
            <Card><CardContent className="p-0">
              {students.map((s, i) => (
                <div key={s.id} className={cn("flex items-center justify-between px-4 py-3", i < students.length - 1 && "border-b")}>
                  <div>
                    <p className="font-medium text-sm">{(s.profiles as any)?.full_name || "Unknown"}</p>
                    {s.student_id && <p className="text-xs text-muted-foreground">{s.student_id}</p>}
                  </div>
                  <Button variant={attendance[s.id] === "present" ? "default" : "destructive"} size="sm" onClick={() => toggle(s.id)}>
                    {attendance[s.id] === "present" ? <Check className="h-4 w-4 mr-1" /> : <X className="h-4 w-4 mr-1" />}
                    {attendance[s.id] === "present" ? "P" : "A"}
                  </Button>
                </div>
              ))}
            </CardContent></Card>
            <Button className="w-full" onClick={save} disabled={saving}><Save className="h-4 w-4 mr-2" />{saving ? "Saving..." : existing ? "Update" : "Save"}</Button>
          </>
        )}

        {selectedClass && students.length === 0 && (
          <Card><CardContent className="p-8 text-center text-muted-foreground">No students enrolled</CardContent></Card>
        )}
      </div>
      <BottomNav role="teacher" />
    </div>
  );
};

export default TeacherAttendanceMark;
