import { useEffect, useState } from "react";
import BottomNav from "@/components/shared/BottomNav";
import PageSkeleton from "@/components/shared/PageSkeleton";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Search, Phone, Mail, Briefcase, BookOpen, FileDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AddTeacherDialog } from "@/components/admin/AddTeacherDialog";
import { exportToCSV, formatDateForExport } from "@/lib/csvExport";
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
    avatar_url: string | null;
  };
}

const Teachers = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const init = async () => {
      await checkAuth();
      await loadTeachers();
    };
    init();

    const channel = supabase
      .channel('teachers-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teachers' }, () => {
        loadTeachers();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/"); return; }
    const [adminResult, coAdminResult] = await Promise.all([
      supabase.rpc("is_admin"),
      supabase.rpc("is_co_admin"),
    ]);
    if (!adminResult.data && !coAdminResult.data) navigate("/admin/dashboard");
  };

  const loadTeachers = async () => {
    try {
      const { data: teachersData, error } = await supabase
        .from("teachers")
        .select("*")
        .order("joining_date", { ascending: false });

      if (error) throw error;

      const userIds = (teachersData || []).map((t) => t.user_id).filter(Boolean);
      let profilesById: Record<string, any> = {};
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, full_name, email, phone, avatar_url, archived")
          .in("id", userIds)
          .eq("archived", false);
        profilesById = Object.fromEntries(
          (profilesData || []).map((p) => [p.id, { full_name: p.full_name, email: p.email, phone: p.phone, avatar_url: p.avatar_url }])
        );
      }

      const merged = (teachersData || [])
        .filter((t) => profilesById[t.user_id])
        .map((t) => ({ ...t, profiles: profilesById[t.user_id] }));

      setTeachers(merged);
    } catch (error) {
      console.error("Error loading teachers:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to load teachers" });
    } finally {
      setLoading(false);
    }
  };

  const filteredTeachers = teachers.filter((teacher) => {
    const query = searchQuery.toLowerCase();
    const name = teacher.profiles?.full_name || "";
    const email = teacher.profiles?.email || "";
    const empId = teacher.employee_id || "";
    const subjects = teacher.subjects?.join(" ") || "";
    return name.toLowerCase().includes(query) || email.toLowerCase().includes(query) || empId.toLowerCase().includes(query) || subjects.toLowerCase().includes(query);
  });

  if (loading) return <PageSkeleton />;

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Teachers</h1>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search teachers..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
          </div>
          <AddTeacherDialog onTeacherAdded={loadTeachers} />
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const data = filteredTeachers.map((t) => ({
              employee_id: t.employee_id || "",
              full_name: t.profiles?.full_name || "",
              email: t.profiles?.email || "",
              phone: t.profiles?.phone || "",
              designation: t.designation || "",
              subjects: t.subjects?.join("; ") || "",
              joining_date: formatDateForExport(t.joining_date),
            }));
            exportToCSV(data, [
              { key: "employee_id", label: "Employee ID" },
              { key: "full_name", label: "Full Name" },
              { key: "email", label: "Email" },
              { key: "phone", label: "Phone" },
              { key: "designation", label: "Designation" },
              { key: "subjects", label: "Subjects" },
              { key: "joining_date", label: "Joining Date" },
            ], "teachers-export");
          }}
          disabled={filteredTeachers.length === 0}
        >
          <FileDown className="h-4 w-4 mr-1" /> Export CSV
        </Button>

        <div className="space-y-3">
          {filteredTeachers.map((teacher) => (
            <Card key={teacher.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/admin/teachers/${teacher.id}`)}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <ProfileAvatar name={teacher.profiles?.full_name || "?"} avatarUrl={teacher.profiles?.avatar_url} size="md" />
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">
                      {teacher.profiles?.full_name || "Unknown Teacher"}
                      {teacher.employee_id && <span className="text-sm text-muted-foreground ml-1">({teacher.employee_id})</span>}
                    </CardTitle>
                    <CardDescription>Joined: {new Date(teacher.joining_date).toLocaleDateString()}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {teacher.designation && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Briefcase className="h-4 w-4" />
                    <span>{teacher.designation}</span>
                  </div>
                )}
                {teacher.subjects && teacher.subjects.length > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                    <div className="flex flex-wrap gap-1">
                      {teacher.subjects.map((subject, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">{subject}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <span className="truncate">{teacher.profiles?.email}</span>
                </div>
                {teacher.profiles?.phone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    <span>{teacher.profiles.phone}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredTeachers.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            {searchQuery ? "No teachers found matching your search" : "No teachers added yet"}
          </div>
        )}
      </div>
      <BottomNav role="admin" />
    </div>
  );
};

export default Teachers;
