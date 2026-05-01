import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/shared/BottomNav";
import PageSkeleton from "@/components/shared/PageSkeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ClipboardCheck } from "lucide-react";

interface Att {
  id: string;
  date: string;
  status: string;
  notes: string | null;
  class_id: string;
  subject?: string;
}

const StudentAttendance = () => {
  const navigate = useNavigate();
  const [records, setRecords] = useState<Att[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ present: 0, absent: 0, total: 0, rate: 0 });

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/"); return; }

    const { data: student } = await supabase.from("students").select("id").eq("user_id", user.id).maybeSingle();
    if (!student) { setLoading(false); return; }

    const { data } = await supabase
      .from("attendance")
      .select("*")
      .eq("student_id", student.id)
      .order("date", { ascending: false });

    const recs = data || [];
    const classIds = [...new Set(recs.map((r) => r.class_id))];
    const subjMap: Record<string, string> = {};
    if (classIds.length > 0) {
      const { data: cls } = await supabase.from("classes").select("id, subject").in("id", classIds);
      (cls || []).forEach((c) => { subjMap[c.id] = c.subject; });
    }

    const enriched = recs.map((r) => ({ ...r, subject: subjMap[r.class_id] || "—" }));
    const present = enriched.filter((r) => r.status === "present").length;
    const absent = enriched.filter((r) => r.status === "absent").length;
    const total = enriched.length;
    setRecords(enriched);
    setStats({ present, absent, total, rate: total ? Math.round((present / total) * 100) : 0 });
    setLoading(false);
  };

  if (loading) return <PageSkeleton />;

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/student/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <ClipboardCheck className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">My Attendance</h1>
        </div>
      </header>

      <main className="container max-w-5xl mx-auto px-4 py-6 space-y-4">
        <div className="grid grid-cols-4 gap-3">
          <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Total</p><p className="text-xl font-bold">{stats.total}</p></CardContent></Card>
          <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Present</p><p className="text-xl font-bold text-green-600">{stats.present}</p></CardContent></Card>
          <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Absent</p><p className="text-xl font-bold text-red-600">{stats.absent}</p></CardContent></Card>
          <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Rate</p><p className="text-xl font-bold text-primary">{stats.rate}%</p></CardContent></Card>
        </div>

        {records.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">No attendance records.</CardContent></Card>
        ) : (
          <div className="space-y-2">
            {records.map((r) => (
              <Card key={r.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{r.subject}</p>
                    <p className="text-sm text-muted-foreground">{new Date(r.date).toLocaleDateString()}</p>
                  </div>
                  <Badge variant={r.status === "present" ? "default" : "destructive"}>
                    {r.status}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
      <BottomNav role="student" />
    </div>
  );
};

export default StudentAttendance;
