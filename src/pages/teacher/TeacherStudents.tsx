import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/shared/BottomNav";
import PageSkeleton from "@/components/shared/PageSkeleton";
import ProfileAvatar from "@/components/shared/ProfileAvatar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Search } from "lucide-react";
import { useTeacherProfileGate } from "@/hooks/useTeacherProfileGate";
import { useToast } from "@/hooks/use-toast";

const TeacherStudents = () => {
  const navigate = useNavigate();
  const { loading: gateLoading, profileCompleted } = useTeacherProfileGate();
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loadError, setLoadError] = useState(false);
  const { toast } = useToast();

  useEffect(() => { if (profileCompleted) load(); }, [profileCompleted]);

  const load = async () => {
    setLoadError(false);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/"); return; }
    const { data: teacher, error: teacherError } = await supabase.from("teachers").select("id").eq("user_id", user.id).maybeSingle();
    if (teacherError) return failLoad(teacherError.message);
    if (teacher) {
      const { data: tc, error: classesError } = await supabase.from("teacher_classes").select("class_id").eq("teacher_id", teacher.id);
      if (classesError) return failLoad(classesError.message);
      const cids = (tc || []).map((c) => c.class_id);
      if (cids.length > 0) {
        const { data: enr, error: enrollmentError } = await supabase.from("class_enrollments").select("student_id").in("class_id", cids);
        if (enrollmentError) return failLoad(enrollmentError.message);
        const sids = [...new Set((enr || []).map((e) => e.student_id))];
        if (sids.length > 0) {
          const { data: studs, error: studentsError } = await supabase.from("students").select("id, student_id, class, section, user_id").in("id", sids);
          if (studentsError) return failLoad(studentsError.message);
          const userIds = (studs || []).map((student) => student.user_id).filter(Boolean);
          const { data: profiles, error: profilesError } = userIds.length > 0
            ? await supabase.from("profiles").select("id, full_name, email, avatar_url").in("id", userIds)
            : { data: [], error: null };
          if (profilesError) return failLoad(profilesError.message);
          const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]));
          setStudents((studs || []).map((student) => ({ ...student, profiles: profileMap.get(student.user_id || "") })));
        }
      }
    }
    setLoading(false);
  };

  const failLoad = (message: string) => {
    setLoadError(true);
    setStudents([]);
    setLoading(false);
    toast({ title: "Could not load students", description: message, variant: "destructive" });
  };

  if (gateLoading || loading) return <PageSkeleton />;
  const filtered = students.filter((s) => {
    const name = (s.profiles as any)?.full_name?.toLowerCase() || "";
    return name.includes(search.toLowerCase()) || s.student_id?.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/teacher/dashboard")}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="text-lg font-bold">My Students</h1>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search students..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {loadError ? (
          <Card><CardContent className="p-8 text-center text-destructive">Students could not be loaded.</CardContent></Card>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">No students found</CardContent></Card>
        ) : (
          filtered.map((s) => (
            <Card key={s.id}>
              <CardContent className="p-4 flex items-center gap-3">
                <ProfileAvatar
                  avatarUrl={(s.profiles as any)?.avatar_url}
                  fullName={(s.profiles as any)?.full_name}
                  className="h-12 w-12"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate">{(s.profiles as any)?.full_name || "Unknown"}</p>
                  <p className="text-xs text-muted-foreground">{s.student_id}{s.class ? ` • Class ${s.class}` : ""}{s.section ? ` - ${s.section}` : ""}</p>
                  {(s.profiles as any)?.email && <p className="text-xs text-muted-foreground mt-1 truncate">{(s.profiles as any).email}</p>}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
      <BottomNav role="teacher" />
    </div>
  );
};

export default TeacherStudents;
