import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/shared/BottomNav";
import PageSkeleton from "@/components/shared/PageSkeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, Clock, MapPin } from "lucide-react";
import { useTeacherProfileGate } from "@/hooks/useTeacherProfileGate";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const TeacherClasses = () => {
  const navigate = useNavigate();
  const { loading: gateLoading, profileCompleted } = useTeacherProfileGate();
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<any[]>([]);

  useEffect(() => { if (profileCompleted) load(); }, [profileCompleted]);

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/"); return; }
    const { data: teacher } = await supabase.from("teachers").select("id").eq("user_id", user.id).maybeSingle();
    if (teacher) {
      const { data: tc } = await supabase.from("teacher_classes").select("class_id").eq("teacher_id", teacher.id);
      const ids = (tc || []).map((c) => c.class_id);
      if (ids.length > 0) {
        const { data: cls } = await supabase.from("classes").select("*").in("id", ids).order("start_time");
        setClasses(cls || []);
      }
    }
    setLoading(false);
  };

  if (loading) return <PageSkeleton />;
  const today = new Date().getDay();

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/teacher/dashboard")}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="text-lg font-bold">My Classes</h1>
        </div>
      </div>

      <div className="p-4">
        <Tabs defaultValue={String(today)}>
          <TabsList className="grid grid-cols-7 w-full">
            {DAYS.map((d, i) => <TabsTrigger key={i} value={String(i)} className="text-xs">{d.slice(0, 3)}</TabsTrigger>)}
          </TabsList>
          {DAYS.map((d, i) => (
            <TabsContent key={i} value={String(i)} className="space-y-3 mt-4">
              {classes.filter((c) => c.day_of_week === i).length === 0 ? (
                <Card><CardContent className="p-8 text-center text-muted-foreground">No classes on {d}</CardContent></Card>
              ) : (
                classes.filter((c) => c.day_of_week === i).map((c) => (
                  <Card key={c.id}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold">{c.subject}</p>
                          {c.class && <p className="text-xs text-muted-foreground">Class {c.class}{c.section ? ` - ${c.section}` : ""}</p>}
                        </div>
                        <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />{c.start_time?.slice(0, 5)} - {c.end_time?.slice(0, 5)}</Badge>
                      </div>
                      {c.room_location && <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{c.room_location}</p>}
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
      <BottomNav role="teacher" />
    </div>
  );
};

export default TeacherClasses;
