import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/shared/BottomNav";
import PageSkeleton from "@/components/shared/PageSkeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Mail, Phone, MapPin, Calendar, Briefcase } from "lucide-react";

const TeacherProfile = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [teacher, setTeacher] = useState<any>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/"); return; }
    const [{ data: p }, { data: t }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("teachers").select("*").eq("user_id", user.id).maybeSingle(),
    ]);
    setProfile(p);
    setTeacher(t);
    setLoading(false);
  };

  if (loading) return <PageSkeleton />;

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/teacher/dashboard")}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="text-lg font-bold">My Profile</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <Card>
          <CardContent className="p-6 flex flex-col items-center text-center">
            <Avatar className="h-24 w-24 mb-3">
              <AvatarImage src={profile?.avatar_url} />
              <AvatarFallback>{profile?.full_name?.charAt(0) || "T"}</AvatarFallback>
            </Avatar>
            <h2 className="text-xl font-bold">{profile?.full_name}</h2>
            {teacher?.designation && <p className="text-sm text-muted-foreground">{teacher.designation}</p>}
            {teacher?.employee_id && <Badge variant="secondary" className="mt-2">{teacher.employee_id}</Badge>}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="font-semibold">Contact</h3>
            <div className="flex items-center gap-2 text-sm"><Mail className="h-4 w-4 text-muted-foreground" />{profile?.email}</div>
            {profile?.phone && <div className="flex items-center gap-2 text-sm"><Phone className="h-4 w-4 text-muted-foreground" />{profile.phone}</div>}
            {profile?.address && <div className="flex items-center gap-2 text-sm"><MapPin className="h-4 w-4 text-muted-foreground" />{profile.address}</div>}
          </CardContent>
        </Card>

        {teacher && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="font-semibold">Employment</h3>
              {teacher.joining_date && <div className="flex items-center gap-2 text-sm"><Calendar className="h-4 w-4 text-muted-foreground" />Joined {teacher.joining_date}</div>}
              {teacher.subjects?.length > 0 && (
                <div className="flex items-start gap-2 text-sm"><Briefcase className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div className="flex flex-wrap gap-1">{teacher.subjects.map((s: string) => <Badge key={s} variant="outline">{s}</Badge>)}</div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {teacher?.emergency_contact_name && (
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="font-semibold">Emergency Contact</h3>
              <p className="text-sm">{teacher.emergency_contact_name}</p>
              {teacher.emergency_contact_phone && <p className="text-sm text-muted-foreground">{teacher.emergency_contact_phone}</p>}
            </CardContent>
          </Card>
        )}

        <Button variant="outline" className="w-full" onClick={() => profile?.id && navigate(`/admin/profile/${profile.id}`)}>Edit Profile</Button>
      </div>
      <BottomNav role="teacher" />
    </div>
  );
};

export default TeacherProfile;
