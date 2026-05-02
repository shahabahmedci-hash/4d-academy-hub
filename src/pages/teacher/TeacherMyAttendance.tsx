import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/shared/BottomNav";
import PageSkeleton from "@/components/shared/PageSkeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { format } from "date-fns";

const TeacherMyAttendance = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<any[]>([]);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/"); return; }
    const { data: teacher } = await supabase.from("teachers").select("id").eq("user_id", user.id).maybeSingle();
    if (teacher) {
      const { data } = await supabase.from("teacher_attendance").select("*").eq("teacher_id", teacher.id).order("date", { ascending: false });
      setRecords(data || []);
    }
    setLoading(false);
  };

  if (loading) return <PageSkeleton />;
  const present = records.filter((r) => r.status === "present").length;
  const rate = records.length > 0 ? Math.round((present / records.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/teacher/dashboard")}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="text-lg font-bold">My Attendance</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total</p><p className="text-2xl font-bold">{records.length}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Present</p><p className="text-2xl font-bold">{present}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Rate</p><p className="text-2xl font-bold">{rate}%</p></CardContent></Card>
        </div>

        {records.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">No attendance records</CardContent></Card>
        ) : (
          records.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-4 flex justify-between items-center">
                <p className="font-medium">{format(new Date(r.date), "PPP")}</p>
                <Badge variant={r.status === "present" ? "default" : "destructive"}>{r.status}</Badge>
              </CardContent>
            </Card>
          ))
        )}
      </div>
      <BottomNav role="teacher" />
    </div>
  );
};

export default TeacherMyAttendance;
