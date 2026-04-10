import { useEffect, useState } from "react";
import BottomNav from "@/components/shared/BottomNav";
import PageSkeleton from "@/components/shared/PageSkeleton";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, Phone, ArrowLeft, CalendarDays, MapPin, UserRound, Briefcase, BookOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ProfileAvatar from "@/components/shared/ProfileAvatar";

interface Teacher {
  id: string;
  user_id: string;
  employee_id: string | null;
  designation: string | null;
  joining_date: string;
  subjects: string[] | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  profiles?: {
    full_name: string;
    email: string;
    phone: string | null;
    address: string | null;
    avatar_url: string | null;
  };
}

interface AssignedClass {
  id: string;
  subject: string;
  class: string | null;
  section: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room_location: string | null;
}

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const TeacherDetails = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [assignedClasses, setAssignedClasses] = useState<AssignedClass[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthAndLoad();
    const channel = supabase
      .channel("teacher-details-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "teachers", filter: `id=eq.${id}` }, () => loadTeacher())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  const checkAuthAndLoad = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/"); return; }
    const [adminResult, coAdminResult] = await Promise.all([
      supabase.rpc("is_admin"),
      supabase.rpc("is_co_admin"),
    ]);
    if (!adminResult.data && !coAdminResult.data) { navigate("/admin/dashboard"); return; }
    await loadTeacher();
  };

  const loadTeacher = async () => {
    if (!id) return;
    try {
      const { data, error } = await supabase.from("teachers").select("*").eq("id", id).maybeSingle();
      if (error) throw error;

      let profiles: Teacher["profiles"] | undefined = undefined;
      if (data?.user_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, email, phone, address, avatar_url")
          .eq("id", data.user_id)
          .maybeSingle();
        if (profile) profiles = profile as any;
      }

      setTeacher({ ...(data as any), profiles } as Teacher);

      const { data: classAssignments } = await supabase
        .from("teacher_classes")
        .select("class_id")
        .eq("teacher_id", id);

      if (classAssignments && classAssignments.length > 0) {
        const classIds = classAssignments.map(c => c.class_id);
        const { data: classes } = await supabase
          .from("classes")
          .select("*")
          .in("id", classIds)
          .order("day_of_week", { ascending: true });
        setAssignedClasses(classes || []);
      }
    } catch (err) {
      console.error("Error loading teacher details:", err);
      toast({ variant: "destructive", title: "Error", description: "Failed to load teacher details" });
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  if (loading) return <PageSkeleton />;

  if (!teacher) {
    return (
      <div className="min-h-screen bg-background p-4">
        <Card>
          <CardHeader>
            <CardTitle>Teacher not found</CardTitle>
            <CardDescription>The requested teacher could not be found.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/admin/teachers")}>Back to Teachers</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/teachers")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold truncate">{teacher.profiles?.full_name || "Unknown Teacher"}</h1>
        </div>

        {/* Profile Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <ProfileAvatar fullName={teacher.profiles?.full_name || "?"} avatarUrl={teacher.profiles?.avatar_url} className="h-16 w-16" />
              <div>
                <CardTitle>{teacher.profiles?.full_name || "Unknown"}</CardTitle>
                {teacher.employee_id && <CardDescription>({teacher.employee_id})</CardDescription>}
                <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                  <CalendarDays className="h-4 w-4" />
                  Joined on {new Date(teacher.joining_date).toLocaleDateString()}
                </div>
                {teacher.designation && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                    <Briefcase className="h-4 w-4" />
                    {teacher.designation}
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span>{teacher.profiles?.email || "-"}</span>
            </div>
            {teacher.profiles?.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{teacher.profiles.phone}</span>
              </div>
            )}
            {teacher.profiles?.address && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{teacher.profiles.address}</span>
              </div>
            )}
            {(teacher.emergency_contact_name || teacher.emergency_contact_phone) && (
              <div className="flex items-center gap-2 text-sm">
                <UserRound className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">Emergency Contact</p>
                  <p className="text-muted-foreground">
                    {teacher.emergency_contact_name} {teacher.emergency_contact_phone ? `(${teacher.emergency_contact_phone})` : ""}
                  </p>
                </div>
              </div>
            )}
            {teacher.subjects && teacher.subjects.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                  Subjects
                </div>
                <div className="flex flex-wrap gap-1 ml-6">
                  {teacher.subjects.map((subject, idx) => (
                    <Badge key={idx} variant="secondary">{subject}</Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Actions</CardTitle>
            <CardDescription>Manage this teacher</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full" onClick={() => navigate(`/admin/salaries?teacher_id=${teacher.id}`)}>
              View Salary History
            </Button>
          </CardContent>
        </Card>

        {/* Assigned Classes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Assigned Classes ({assignedClasses.length})</CardTitle>
            <CardDescription>Classes this teacher is assigned to</CardDescription>
          </CardHeader>
          <CardContent>
            {assignedClasses.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No classes assigned yet</p>
            ) : (
              <div className="space-y-3">
                {assignedClasses.map((cls) => (
                  <div key={cls.id} className="border rounded-lg p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{cls.subject}</span>
                      <span className="text-xs text-muted-foreground">
                        {DAYS_OF_WEEK[cls.day_of_week]} • {formatTime(cls.start_time)} - {formatTime(cls.end_time)}
                      </span>
                    </div>
                    {(cls.class || cls.section) && (
                      <div className="flex gap-2">
                        {cls.class && <Badge variant="outline">Class {cls.class}</Badge>}
                        {cls.section && <Badge variant="outline">Batch {cls.section}</Badge>}
                      </div>
                    )}
                    {cls.room_location && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {cls.room_location}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <BottomNav role="admin" />
    </div>
  );
};

export default TeacherDetails;
