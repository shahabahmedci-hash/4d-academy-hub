import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/shared/BottomNav";
import PageSkeleton from "@/components/shared/PageSkeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, Calendar, Clock, MapPin } from "lucide-react";
import { useProfileCompletionGate } from "@/hooks/useProfileCompletionGate";

interface Cls {
  id: string;
  subject: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room_location: string | null;
  teacher_name: string | null;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const StudentSchedule = () => {
  const navigate = useNavigate();
  const { loading: gateLoading, profileCompleted } = useProfileCompletionGate();
  const [classes, setClasses] = useState<Cls[]>([]);
  const [loading, setLoading] = useState(true);
  const [day, setDay] = useState(String(new Date().getDay()));

  useEffect(() => {
    if (profileCompleted) load();
  }, [profileCompleted]);

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/"); return; }

    const { data: student } = await supabase.from("students").select("id").eq("user_id", user.id).maybeSingle();
    if (!student) { setLoading(false); return; }

    const { data: enrolls } = await supabase
      .from("class_enrollments")
      .select("class_id")
      .eq("student_id", student.id);
    const ids = (enrolls || []).map((e) => e.class_id);
    if (ids.length > 0) {
      const { data } = await supabase.from("classes").select("*").in("id", ids).order("start_time");
      setClasses(data || []);
    }
    setLoading(false);
  };

  if (gateLoading || loading) return <PageSkeleton />;

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/student/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Calendar className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">My Schedule</h1>
        </div>
      </header>

      <main className="container max-w-5xl mx-auto px-4 py-6">
        <Tabs value={day} onValueChange={setDay}>
          <TabsList className="grid grid-cols-7 w-full">
            {DAYS.map((d, i) => (
              <TabsTrigger key={i} value={String(i)}>{d}</TabsTrigger>
            ))}
          </TabsList>
          {DAYS.map((_, i) => {
            const todays = classes.filter((c) => c.day_of_week === i);
            return (
              <TabsContent key={i} value={String(i)} className="space-y-3 mt-4">
                {todays.length === 0 ? (
                  <Card><CardContent className="py-12 text-center text-muted-foreground">No classes.</CardContent></Card>
                ) : todays.map((c) => (
                  <Card key={c.id}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{c.subject}</CardTitle>
                      {c.teacher_name && <p className="text-sm text-muted-foreground">{c.teacher_name}</p>}
                    </CardHeader>
                    <CardContent className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{c.start_time?.slice(0,5)} - {c.end_time?.slice(0,5)}</span>
                      {c.room_location && <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{c.room_location}</span>}
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
            );
          })}
        </Tabs>
      </main>
      <BottomNav role="student" />
    </div>
  );
};

export default StudentSchedule;
