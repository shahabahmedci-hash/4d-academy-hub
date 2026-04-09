import { useEffect, useState } from "react";
import BottomNav from "@/components/shared/BottomNav";
import PageSkeleton from "@/components/shared/PageSkeleton";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Phone, ArrowLeft, CalendarDays, MapPin, UserRound, BookOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ProfileAvatar from "@/components/shared/ProfileAvatar";
import { Badge } from "@/components/ui/badge";

interface Student {
  id: string;
  user_id: string | null;
  student_id: string | null;
  enrollment_date: string;
  date_of_birth: string | null;
  address: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  class: string | null;
  section: string | null;
  profiles?: {
    full_name: string;
    email: string;
    phone: string | null;
    avatar_url: string | null;
  };
}

const StudentDetails = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthAndLoad();
    const channel = supabase
      .channel("student-details-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "students", filter: `id=eq.${id}` }, () => loadStudent())
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
    if (!adminResult.data && !coAdminResult.data) { navigate("/"); return; }
    await loadStudent();
  };

  const loadStudent = async () => {
    if (!id) return;
    try {
      const { data, error } = await supabase.from("students").select("*").eq("id", id).maybeSingle();
      if (error) throw error;

      let profiles: Student["profiles"] | undefined = undefined;
      if (data?.user_id) {
        const { data: profile, error: pErr } = await supabase
          .from("profiles")
          .select("full_name, email, phone, avatar_url")
          .eq("id", data.user_id)
          .maybeSingle();
        if (pErr) throw pErr;
        if (profile) profiles = profile as any;
      }

      setStudent({ ...(data as any), profiles } as Student);
    } catch (err) {
      console.error("Error loading student details:", err);
      toast({ variant: "destructive", title: "Error", description: "Failed to load student details" });
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <PageSkeleton />;

  if (!student) {
    return (
      <div className="min-h-screen bg-background p-4">
        <Card>
          <CardHeader>
            <CardTitle>Student not found</CardTitle>
            <CardDescription>The requested student could not be found.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/admin/students")}>Back to Students</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex items-center gap-2 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/students")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold">Student Details</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <ProfileAvatar avatarUrl={student.profiles?.avatar_url} fullName={student.profiles?.full_name} className="h-16 w-16" />
              <div>
                <h2 className="text-xl font-bold">{student.profiles?.full_name || "Unknown Student"}</h2>
                {student.student_id && <Badge variant="outline" className="mt-1">{student.student_id}</Badge>}
                <p className="text-sm text-muted-foreground mt-1">
                  Enrolled on {new Date(student.enrollment_date).toLocaleDateString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span>{student.profiles?.email || "-"}</span>
            </div>
            {student.profiles?.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{student.profiles.phone}</span>
              </div>
            )}
            {student.date_of_birth && (
              <div className="flex items-center gap-2 text-sm">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <span>DOB: {new Date(student.date_of_birth).toLocaleDateString()}</span>
              </div>
            )}
            {student.address && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{student.address}</span>
              </div>
            )}
            {(student.emergency_contact_name || student.emergency_contact_phone) && (
              <div className="flex items-center gap-2 text-sm">
                <UserRound className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">Emergency Contact</p>
                  <p className="text-muted-foreground">
                    {student.emergency_contact_name} {student.emergency_contact_phone ? `(${student.emergency_contact_phone})` : ""}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {(student.class || student.section) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Academic Info</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                <span>
                  {student.class && `Class ${student.class}`}
                  {student.class && student.section && " • "}
                  {student.section && `Batch ${student.section}`}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Actions</CardTitle>
            <CardDescription>Manage this student</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate(`/admin/fees?student_id=${student.id}`)}>
              View Fees
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate(`/admin/attendance?student_id=${student.id}`)}>
              View Attendance
            </Button>
          </CardContent>
        </Card>
      </div>

      <BottomNav role="admin" />
    </div>
  );
};

export default StudentDetails;
