import { useEffect, useState } from "react";
import BottomNav from "@/components/shared/BottomNav";
import PageSkeleton from "@/components/shared/PageSkeleton";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Clock, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AddClassDialog } from "@/components/admin/AddClassDialog";
import { EditClassDialog } from "@/components/admin/EditClassDialog";
import { ClassScheduleDialog, HolidaysDialog } from "@/components/admin/ClassScheduleDialog";
import { fetchCurrentWeeklySlots } from "@/lib/scheduledSessions";

interface Class {
  id: string;
  subject: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room_location: string | null;
  teacher_id: string | null;
  teacher_name: string | null;
  class: string | null;
  section: string | null;
}

const Classes = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [scheduleClass, setScheduleClass] = useState<Class | null>(null);
  const [holidaysOpen, setHolidaysOpen] = useState(false);

  const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  useEffect(() => {
    const init = async () => {
      await checkAuth();
      await loadClasses();
    };
    init();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/");
      return;
    }

    const [adminResult, coAdminResult] = await Promise.all([
      supabase.rpc("is_admin"),
      supabase.rpc("is_co_admin")
    ]);
    
    if (!adminResult.data && !coAdminResult.data) {
      navigate("/student/dashboard");
    }
  };

  const loadClasses = async () => {
    try {
      const { data, error } = await supabase
        .from("classes")
        .select("*")
        .order("day_of_week", { ascending: true })
        .order("start_time", { ascending: true });

      if (error) throw error;
      // Show each class under its *current* timetable slots (effective-dated source of truth).
      const slots = await fetchCurrentWeeklySlots();
      const expanded: Class[] = [];
      (data || []).forEach((c) => {
        const mine = slots.filter((s) => s.class_id === c.id);
        if (mine.length === 0) expanded.push(c);
        else mine.forEach((s) => expanded.push({ ...c, day_of_week: s.day_of_week, start_time: s.start_time, end_time: s.end_time }));
      });
      setClasses(expanded.sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time)));
    } catch (error) {
      console.error("Error loading classes:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load classes",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (time: string) => {
    return new Date(`2000-01-01T${time}`).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const groupedClasses = classes.reduce((acc, cls) => {
    const day = daysOfWeek[cls.day_of_week];
    if (!acc[day]) {
      acc[day] = [];
    }
    acc[day].push(cls);
    return acc;
  }, {} as Record<string, Class[]>);

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">Class Schedule</h1>
              <p className="text-sm text-muted-foreground">Manage class timetable</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setHolidaysOpen(true)}>Holidays</Button>
            <AddClassDialog onClassAdded={loadClasses} />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {Object.entries(groupedClasses).map(([day, dayClasses]) => (
          <Card key={day} className="mb-6">
            <CardHeader>
              <CardTitle>{day}</CardTitle>
              <CardDescription>{dayClasses.length} classes scheduled</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {dayClasses.map((cls) => (
                  <Card key={`${cls.id}-${cls.day_of_week}-${cls.start_time}`} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <CardTitle className="text-lg">{cls.subject}</CardTitle>
                      {cls.teacher_name && (
                        <CardDescription>By {cls.teacher_name}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {formatTime(cls.start_time)} - {formatTime(cls.end_time)}
                        </span>
                      </div>
                      {cls.room_location && (
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span>{cls.room_location}</span>
                        </div>
                      )}
                      {(cls.class || cls.section) && (
                        <div className="text-sm text-muted-foreground">
                          {cls.class && <span>Class {cls.class}</span>}
                          {cls.class && cls.section && <span> - </span>}
                          {cls.section && <span>Batch {cls.section}</span>}
                        </div>
                      )}
                      <Button 
                        variant="outline" 
                        className="w-full mt-4" 
                        size="sm"
                        onClick={() => setSelectedClass(cls)}
                      >
                        Edit Class
                      </Button>
                      <Button variant="ghost" className="w-full" size="sm" onClick={() => setScheduleClass(cls)}>
                        Schedule history & exceptions
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}

        {classes.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">No classes scheduled yet</p>
              <AddClassDialog onClassAdded={loadClasses} />
            </CardContent>
          </Card>
        )}
      </main>

      {selectedClass && (
        <EditClassDialog
          classData={selectedClass}
          open={!!selectedClass}
          onOpenChange={(open) => !open && setSelectedClass(null)}
          onClassUpdated={loadClasses}
        />
      )}
      {scheduleClass && (
        <ClassScheduleDialog
          classId={scheduleClass.id}
          title={`${scheduleClass.subject}${scheduleClass.class ? ` — Class ${scheduleClass.class}` : ""}${scheduleClass.section ? ` (Batch ${scheduleClass.section})` : ""}`}
          open={!!scheduleClass}
          onOpenChange={(o) => !o && setScheduleClass(null)}
        />
      )}
      <HolidaysDialog open={holidaysOpen} onOpenChange={setHolidaysOpen} />
      <BottomNav role="admin" />
      <div className="h-16 md:hidden" />
    </div>
  );
};

export default Classes;
