import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/shared/BottomNav";
import PageSkeleton from "@/components/shared/PageSkeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, User, Edit, LogOut } from "lucide-react";

interface Profile {
  full_name: string;
  email: string;
  phone: string | null;
  address: string | null;
  avatar_url: string | null;
}

interface Student {
  student_id: string | null;
  class: string | null;
  section: string | null;
  stream: string | null;
  father_name: string | null;
  date_of_birth: string | null;
  enrollment_date: string;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
}

const StudentProfile = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/"); return; }

    const [pRes, sRes] = await Promise.all([
      supabase.from("profiles").select("full_name, email, phone, address, avatar_url").eq("id", user.id).single(),
      supabase.from("students").select("student_id, class, section, stream, father_name, date_of_birth, enrollment_date, emergency_contact_name, emergency_contact_phone").eq("user_id", user.id).maybeSingle(),
    ]);
    setProfile(pRes.data);
    setStudent(sRes.data);
    setLoading(false);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading) return <PageSkeleton />;

  const Field = ({ label, value }: { label: string; value: string | null | undefined }) => (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value || "—"}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/student/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <User className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold">My Profile</h1>
          </div>
          <Button variant="ghost" size="icon" onClick={logout}><LogOut className="h-5 w-5" /></Button>
        </div>
      </header>

      <main className="container max-w-3xl mx-auto px-4 py-6 space-y-4">
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback>{profile?.full_name?.[0] || "?"}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h2 className="text-xl font-bold">{profile?.full_name}</h2>
              <p className="text-sm text-muted-foreground">{profile?.email}</p>
              {student?.student_id && <Badge className="mt-1" variant="secondary">{student.student_id}</Badge>}
            </div>
            <Button size="sm" variant="outline" onClick={() => profile?.id && navigate(`/admin/profile/${profile.id}`)}>
              <Edit className="h-4 w-4 mr-1" /> Edit
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Academic Info</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Field label="Class" value={student?.class} />
            <Field label="Section" value={student?.section} />
            <Field label="Stream" value={student?.stream} />
            <Field label="Enrollment Date" value={student?.enrollment_date ? new Date(student.enrollment_date).toLocaleDateString() : null} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Personal Info</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Field label="Father's Name" value={student?.father_name} />
            <Field label="Date of Birth" value={student?.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString() : null} />
            <Field label="Phone" value={profile?.phone} />
            <div className="col-span-2"><Field label="Address" value={profile?.address} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Emergency Contact</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Field label="Name" value={student?.emergency_contact_name} />
            <Field label="Phone" value={student?.emergency_contact_phone} />
          </CardContent>
        </Card>
      </main>
      <BottomNav role="student" />
    </div>
  );
};

export default StudentProfile;
