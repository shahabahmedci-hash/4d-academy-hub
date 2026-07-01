import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Clock, MapPin, Users } from "lucide-react";
import ProfileAvatar from "@/components/shared/ProfileAvatar";

interface Props {
  classId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface StudentRow {
  id: string;
  full_name: string;
  avatar_url: string | null;
  student_id: string | null;
}

const ClassDetailsDialog = ({ classId, open, onOpenChange }: Props) => {
  const [cls, setCls] = useState<any>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !classId) return;
    const load = async () => {
      setLoading(true);
      const { data: c } = await supabase.from("classes").select("*").eq("id", classId).maybeSingle();
      setCls(c);

      // Enrolled students via class_enrollments
      const { data: enr } = await supabase.from("class_enrollments").select("student_id").eq("class_id", classId);
      const enrolledIds = (enr || []).map((e) => e.student_id);

      // Also include students matching class/section
      let query = supabase.from("students").select("id, student_id, user_id");
      if (c?.class) query = query.eq("class", c.class);
      if (c?.section) query = query.eq("section", c.section);
      const { data: bySection } = c?.class ? await query : { data: [] as any[] };
      const sectionIds = (bySection || []).map((s) => s.id);

      const allIds = Array.from(new Set([...enrolledIds, ...sectionIds]));
      if (allIds.length === 0) {
        setStudents([]);
        setLoading(false);
        return;
      }

      const { data: studs } = await supabase.from("students").select("id, student_id, user_id").in("id", allIds);
      const userIds = (studs || []).map((s) => s.user_id).filter(Boolean);
      const { data: profs } = await supabase.from("profiles").select("id, full_name, avatar_url").in("id", userIds);
      const profMap = new Map((profs || []).map((p) => [p.id, p]));
      const rows: StudentRow[] = (studs || []).map((s) => {
        const p: any = profMap.get(s.user_id);
        return {
          id: s.id,
          full_name: p?.full_name || "Student",
          avatar_url: p?.avatar_url || null,
          student_id: s.student_id,
        };
      });
      rows.sort((a, b) => a.full_name.localeCompare(b.full_name));
      setStudents(rows);
      setLoading(false);
    };
    load();
  }, [open, classId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{cls?.subject || "Class Details"}</DialogTitle>
          {cls && (
            <DialogDescription>
              {cls.class && <>Class {cls.class}{cls.section ? ` - ${cls.section}` : ""}</>}
            </DialogDescription>
          )}
        </DialogHeader>

        {cls && (
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" />{DAYS[cls.day_of_week]} • {cls.start_time?.slice(0, 5)} - {cls.end_time?.slice(0, 5)}</div>
            {cls.room_location && <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" />{cls.room_location}</div>}
          </div>
        )}

        <div className="pt-2">
          <div className="flex items-center gap-2 mb-2 font-medium text-sm">
            <Users className="h-4 w-4" /> Students <Badge variant="secondary">{students.length}</Badge>
          </div>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : students.length === 0 ? (
            <p className="text-sm text-muted-foreground">No students enrolled.</p>
          ) : (
            <div className="space-y-2">
              {students.map((s) => (
                <div key={s.id} className="flex items-center gap-3 p-2 rounded border">
                  <ProfileAvatar fullName={s.full_name} avatarUrl={s.avatar_url} className="h-8 w-8" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{s.full_name}</p>
                    {s.student_id && <p className="text-xs text-muted-foreground">{s.student_id}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ClassDetailsDialog;
