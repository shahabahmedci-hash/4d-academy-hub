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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Calendar as CalendarIcon, Check, X, Save, CheckCheck, Lock } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useTeacherProfileGate } from "@/hooks/useTeacherProfileGate";
import { useFinancialYearFreeze } from "@/hooks/useFinancialYearFreeze";
import {
  AttendanceStatus, EligibleStudent, fetchClassAttendanceMap, fetchEligibleStudents, saveStudentAttendance,
} from "@/hooks/useAttendanceQuery";

interface ClassRow { id: string; subject: string; class: string | null; section: string | null }

const ALL = "__all__";

const TeacherAttendanceMark = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { loading: gateLoading, profileCompleted } = useTeacherProfileGate();
  const { isDateFrozen } = useFinancialYearFreeze();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [batchFilter, setBatchFilter] = useState<string>(ALL);
  const [selectedClass, setSelectedClass] = useState("");
  const [date, setDate] = useState<Date>(new Date());
  const [students, setStudents] = useState<EligibleStudent[]>([]);
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
  const [existing, setExisting] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [confirmAllOpen, setConfirmAllOpen] = useState(false);

  const dateStr = format(date, "yyyy-MM-dd");
  const frozen = isDateFrozen(dateStr);

  useEffect(() => { if (profileCompleted) loadClasses(); }, [profileCompleted]);
  useEffect(() => { if (selectedClass) loadStudents(); else { setStudents([]); setAttendance({}); } }, [selectedClass, dateStr]);

  const loadClasses = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/"); return; }
    const { data: teacher } = await supabase.from("teachers").select("id").eq("user_id", user.id).maybeSingle();
    if (teacher) {
      const { data: tc } = await supabase.from("teacher_classes").select("class_id").eq("teacher_id", teacher.id);
      const ids = (tc || []).map((c) => c.class_id);
      if (ids.length > 0) {
        const { data: cls } = await supabase.from("classes").select("id, subject, class, section").in("id", ids).order("subject");
        setClasses(cls || []);
      }
    }
    setLoading(false);
  };

  const batchOptions = useMemo(
    () => [...new Set(classes.map((c) => c.section).filter(Boolean) as string[])].sort(), [classes]);
  const visibleClasses = useMemo(
    () => classes.filter((c) => batchFilter === ALL || c.section === batchFilter), [classes, batchFilter]);

  useEffect(() => {
    if (selectedClass && !visibleClasses.some((c) => c.id === selectedClass)) setSelectedClass("");
  }, [visibleClasses, selectedClass]);

  const loadStudents = async () => {
    setLoadError(false);
    try {
      const eligible = await fetchEligibleStudents(selectedClass, dateStr);
      setStudents(eligible);
      const existingMap = await fetchClassAttendanceMap(selectedClass, dateStr);
      const map: Record<string, AttendanceStatus> = {};
      let found = false;
      eligible.forEach((s) => {
        const status = existingMap[s.id];
        if (status === "present" || status === "absent") { map[s.id] = status; found = true; }
        else map[s.id] = "present";
      });
      setExisting(found);
      setAttendance(map);
    } catch (e: any) {
      setStudents([]);
      setAttendance({});
      setLoadError(true);
      toast({ title: "Could not load roster", description: e.message, variant: "destructive" });
    }
  };

  const toggle = (id: string) => {
    setAttendance((p) => ({ ...p, [id]: p[id] === "present" ? "absent" : "present" }));
  };

  const markAllPresent = () => {
    const map: Record<string, AttendanceStatus> = {};
    students.forEach((s) => { map[s.id] = "present"; });
    setAttendance(map);
    setConfirmAllOpen(false);
  };

  const save = async () => {
    if (frozen) {
      toast({ title: "Frozen period", description: "This date is in a frozen financial year.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const rows = students.map((s) => ({
        student_id: s.id, class_id: selectedClass, date: dateStr, status: attendance[s.id] || "present",
      }));
      if (rows.length === 0) throw new Error("No eligible students for this date");
      await saveStudentAttendance(rows);
      setExisting(true);
      toast({ title: "Saved", description: "Attendance recorded" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  if (gateLoading || loading) return <PageSkeleton />;
  const present = students.filter((s) => attendance[s.id] === "present").length;
  const absent = students.filter((s) => attendance[s.id] === "absent").length;

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/teacher/dashboard")}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="text-lg font-bold">Mark Attendance</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Select value={batchFilter} onValueChange={setBatchFilter}>
            <SelectTrigger><SelectValue placeholder="Batch" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All batches</SelectItem>
              {batchOptions.map((b) => <SelectItem key={b} value={b}>Batch {b}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={selectedClass} onValueChange={setSelectedClass}>
            <SelectTrigger><SelectValue placeholder="Select a class" /></SelectTrigger>
            <SelectContent>
              {visibleClasses.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.subject}{c.class ? ` — Class ${c.class}` : ""}{c.section ? ` (Batch ${c.section})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-start"><CalendarIcon className="mr-2 h-4 w-4" />{format(date, "PPP")}</Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus className={cn("p-3 pointer-events-auto")} />
          </PopoverContent>
        </Popover>

        {frozen && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <Lock className="h-4 w-4" /> Frozen financial year — attendance cannot be changed.
          </div>
        )}

        {selectedClass && students.length > 0 && (
          <>
            <div className="flex flex-wrap gap-2">
              <Badge variant="default">{present} Present</Badge>
              <Badge variant="destructive">{absent} Absent</Badge>
              <Badge variant="outline">{students.length} Total</Badge>
            </div>
            <Button variant="outline" className="w-full" onClick={() => setConfirmAllOpen(true)} disabled={frozen}>
              <CheckCheck className="h-4 w-4 mr-2" />Mark all Present
            </Button>
            <Card><CardContent className="p-0">
              {students.map((s, i) => (
                <div key={s.id} className={cn("flex items-center justify-between px-4 py-3", i < students.length - 1 && "border-b")}>
                  <div>
                    <p className="font-medium text-sm">{s.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.student_id || "No ID"}{s.section ? ` · Batch ${s.section}` : ""}
                    </p>
                  </div>
                  <Button variant={attendance[s.id] === "present" ? "default" : "destructive"} size="sm" disabled={frozen} onClick={() => toggle(s.id)}>
                    {attendance[s.id] === "present" ? <Check className="h-4 w-4 mr-1" /> : <X className="h-4 w-4 mr-1" />}
                    {attendance[s.id] === "present" ? "P" : "A"}
                  </Button>
                </div>
              ))}
            </CardContent></Card>
            <Button className="w-full" onClick={save} disabled={saving || frozen}>
              <Save className="h-4 w-4 mr-2" />{saving ? "Saving..." : existing ? "Update" : "Save"}
            </Button>
          </>
        )}

        {selectedClass && students.length === 0 && (
          <Card><CardContent className={cn("p-8 text-center", loadError ? "text-destructive" : "text-muted-foreground")}>
            {loadError ? "Students or attendance could not be loaded." : "No students belonged to this class on the selected date."}
          </CardContent></Card>
        )}
      </div>

      <AlertDialog open={confirmAllOpen} onOpenChange={setConfirmAllOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark all students present?</AlertDialogTitle>
            <AlertDialogDescription>
              This sets all {students.length} listed students to Present for {format(date, "PPP")}. Nothing is stored until you press Save.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={markAllPresent}>Mark all Present</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BottomNav role="teacher" />
    </div>
  );
};

export default TeacherAttendanceMark;
