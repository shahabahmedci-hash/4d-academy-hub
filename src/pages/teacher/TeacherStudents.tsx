import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/shared/BottomNav";
import PageSkeleton from "@/components/shared/PageSkeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Search } from "lucide-react";
import { useTeacherProfileGate } from "@/hooks/useTeacherProfileGate";

const TeacherStudents = () => {
  const navigate = useNavigate();
  const { loading: gateLoading, profileCompleted } = useTeacherProfileGate();
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => { if (profileCompleted) load(); }, [profileCompleted]);

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/"); return; }
    const { data: teacher } = await supabase.from("teachers").select("id").eq("user_id", user.id).maybeSingle();
    if (teacher) {
      const { data: tc } = await supabase.from("teacher_classes").select("class_id").eq("teacher_id", teacher.id);
      const cids = (tc || []).map((c) => c.class_id);
      if (cids.length > 0) {
        const { data: enr } = await supabase.from("class_enrollments").select("student_id").in("class_id", cids);
        const sids = [...new Set((enr || []).map((e) => e.student_id))];
        if (sids.length > 0) {
          const { data: studs } = await supabase.from("students").select("id, student_id, class, section, user_id, profiles:user_id(full_name, email)").in("id", sids);
          setStudents((studs as any) || []);
        }
      }
    }
    setLoading(false);
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

        {filtered.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">No students found</CardContent></Card>
        ) : (
          filtered.map((s) => (
            <Card key={s.id}>
              <CardContent className="p-4">
                <p className="font-semibold">{(s.profiles as any)?.full_name || "Unknown"}</p>
                <p className="text-xs text-muted-foreground">{s.student_id}{s.class ? ` • Class ${s.class}` : ""}{s.section ? ` - ${s.section}` : ""}</p>
                {(s.profiles as any)?.email && <p className="text-xs text-muted-foreground mt-1">{(s.profiles as any).email}</p>}
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
