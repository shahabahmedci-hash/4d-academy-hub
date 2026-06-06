import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/shared/BottomNav";
import PageSkeleton from "@/components/shared/PageSkeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, User, LogOut, Save, AlertCircle, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import AvatarUpload from "@/components/shared/AvatarUpload";

interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  address: string | null;
  avatar_url: string | null;
  profile_completed: boolean;
}

interface Student {
  id: string | null;
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

const REQUIRED_PROFILE_FIELDS: (keyof Profile)[] = ["full_name", "phone", "address"];
const REQUIRED_STUDENT_FIELDS: (keyof Student)[] = [
  "father_name",
  "date_of_birth",
  "emergency_contact_name",
  "emergency_contact_phone",
];

const Req = () => <span className="text-destructive ml-0.5">*</span>;

const StudentProfile = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/"); return; }

    const [pRes, sRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("students").select("*").eq("user_id", user.id).maybeSingle(),
    ]);
    setProfile(pRes.data as any);
    setStudent((sRes.data as any) || {
      id: null, student_id: null, class: null, section: null, stream: null,
      father_name: null, date_of_birth: null, enrollment_date: new Date().toISOString().split("T")[0],
      emergency_contact_name: null, emergency_contact_phone: null,
    });
    setLoading(false);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const isComplete = () => {
    if (!profile || !student) return false;
    const profOk = REQUIRED_PROFILE_FIELDS.every((f) => !!(profile as any)[f]?.toString().trim());
    const studOk = REQUIRED_STUDENT_FIELDS.every((f) => !!(student as any)[f]?.toString().trim());
    return profOk && studOk;
  };

  const save = async () => {
    if (!profile || !student) return;
    if (profile.phone && !/^[0-9]{10}$/.test(profile.phone)) {
      toast({ variant: "destructive", title: "Invalid phone", description: "Must be 10 digits" });
      return;
    }
    if (student.emergency_contact_phone && !/^[0-9]{10}$/.test(student.emergency_contact_phone)) {
      toast({ variant: "destructive", title: "Invalid emergency phone", description: "Must be 10 digits" });
      return;
    }

    setSaving(true);
    try {
      const completed = isComplete();
      const { error: pErr } = await supabase.from("profiles").update({
        full_name: profile.full_name,
        phone: profile.phone,
        address: profile.address,
        profile_completed: completed,
      }).eq("id", profile.id);
      if (pErr) throw pErr;

      const studentPayload = {
        user_id: profile.id,
        father_name: student.father_name,
        date_of_birth: student.date_of_birth || null,
        address: profile.address,
        emergency_contact_name: student.emergency_contact_name,
        emergency_contact_phone: student.emergency_contact_phone,
      };
      if (student.id) {
        const { error } = await supabase.from("students").update(studentPayload).eq("id", student.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("students").insert(studentPayload);
        if (error) throw error;
      }

      toast({
        title: "Saved",
        description: completed
          ? "Profile complete! Your details are now locked."
          : "Profile updated. Some required fields are still empty.",
      });
      await load();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageSkeleton />;

  const complete = isComplete();
  const locked = !!profile?.profile_completed;

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
        {locked && (
          <Alert>
            <Lock className="h-4 w-4" />
            <AlertDescription>
              Your profile is locked. Contact an admin to make changes.
            </AlertDescription>
          </Alert>
        )}
        {!complete && !locked && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Please complete all required fields (marked with *) to access other portal pages.
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardContent className="p-6 flex flex-col items-center gap-3">
            <AvatarUpload
              userId={profile!.id}
              currentAvatarUrl={profile!.avatar_url}
              fullName={profile!.full_name}
              canDelete
              onAvatarChange={(url) => setProfile({ ...profile!, avatar_url: url })}
            />
            <div className="text-center">
              <h2 className="text-xl font-bold">{profile!.full_name}</h2>
              <p className="text-sm text-muted-foreground">{profile!.email}</p>
              {student?.student_id && <Badge className="mt-1" variant="secondary">{student.student_id}</Badge>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Personal Info</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Full Name<Req /></Label>
              <Input disabled={locked} value={profile!.full_name || ""} onChange={(e) => setProfile({ ...profile!, full_name: e.target.value })} />
            </div>
            <div>
              <Label>Phone<Req /></Label>
              <Input disabled={locked} value={profile!.phone || ""} maxLength={10} onChange={(e) => setProfile({ ...profile!, phone: e.target.value.replace(/\D/g, "") })} placeholder="10-digit" />
            </div>
            <div>
              <Label>Address<Req /></Label>
              <Input disabled={locked} value={profile!.address || ""} onChange={(e) => setProfile({ ...profile!, address: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Father's Name<Req /></Label>
                <Input disabled={locked} value={student!.father_name || ""} onChange={(e) => setStudent({ ...student!, father_name: e.target.value })} />
              </div>
              <div>
                <Label>Date of Birth<Req /></Label>
                <Input disabled={locked} type="date" value={student!.date_of_birth || ""} onChange={(e) => setStudent({ ...student!, date_of_birth: e.target.value })} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Academic Info</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <div><p className="text-xs text-muted-foreground">Class</p><p className="font-medium">{student?.class || "—"}</p></div>
            <div><p className="text-xs text-muted-foreground">Section</p><p className="font-medium">{student?.section || "—"}</p></div>
            <div><p className="text-xs text-muted-foreground">Stream</p><p className="font-medium">{student?.stream || "—"}</p></div>
            <div><p className="text-xs text-muted-foreground">Enrolled</p><p className="font-medium">{student?.enrollment_date ? new Date(student.enrollment_date).toLocaleDateString() : "—"}</p></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Emergency Contact</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div>
              <Label>Name<Req /></Label>
              <Input disabled={locked} value={student!.emergency_contact_name || ""} onChange={(e) => setStudent({ ...student!, emergency_contact_name: e.target.value })} />
            </div>
            <div>
              <Label>Phone<Req /></Label>
              <Input disabled={locked} value={student!.emergency_contact_phone || ""} maxLength={10} onChange={(e) => setStudent({ ...student!, emergency_contact_phone: e.target.value.replace(/\D/g, "") })} placeholder="10-digit" />
            </div>
          </CardContent>
        </Card>

        {!locked && (
          <Button className="w-full" size="lg" onClick={save} disabled={saving}>
            <Save className="h-4 w-4 mr-2" /> {saving ? "Saving..." : "Save Profile"}
          </Button>
        )}
      </main>
      <BottomNav role="student" />
    </div>
  );
};

export default StudentProfile;
