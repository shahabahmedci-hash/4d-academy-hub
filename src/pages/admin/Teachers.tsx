import { useEffect, useState } from "react";
import BottomNav from "@/components/shared/BottomNav";
import PageSkeleton from "@/components/shared/PageSkeleton";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Search, Phone, Mail, User, Briefcase, BookOpen, FileDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AddTeacherDialog } from "@/components/admin/AddTeacherDialog";
import { ImportTeachersDialog } from "@/components/admin/ImportTeachersDialog";
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
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'teachers' },
        () => {
          loadTeachers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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

  const loadTeachers = async () => {
    try {
      const { data: teachersData, error: teachersError } = await supabase
        .from("teachers")
        .select("*")
        .order("joining_date", { ascending: false });

      if (teachersError) throw teachersError;

      const userIds = (teachersData || [])
        .map((t) => t.user_id)
        .filter(Boolean) as string[];

      let profilesById: Record<string, { full_name: string; email: string; phone: string | null; avatar_url: string | null; archived: boolean }> = {};
      if (userIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name, email, phone, avatar_url, archived")
          .in("id", userIds)
          .eq("archived", false);
        if (profilesError) throw profilesError;
        profilesById = Object.fromEntries(
          (profilesData || []).map((p) => [p.id, { full_name: p.full_name, email: p.email, phone: p.phone, avatar_url: p.avatar_url, archived: p.archived || false }])
        );
      }

      // Filter out teachers whose profiles are archived
      const merged = (teachersData || [])
        .filter((t) => profilesById[t.user_id])
        .map((t) => ({
          ...t,
          profiles: profilesById[t.user_id],
        }));

      setTeachers(merged);
    } catch (error) {
      console.error("Error loading teachers:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load teachers",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredTeachers = teachers.filter((teacher) => {
    const name = teacher.profiles?.full_name || "";
    const email = teacher.profiles?.email || "";
    const empId = teacher.employee_id || "";
    const subjects = teacher.subjects?.join(" ") || "";
    return (
      name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      empId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      subjects.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

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
            <div>
              <h1 className="text-2xl font-bold">Teacher Management</h1>
              <p className="text-sm text-muted-foreground">Manage all teacher records</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, employee ID or subject..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button
            variant="outline"
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
                { key: "employee_id", label: "employee_id" },
                { key: "full_name", label: "full_name" },
                { key: "email", label: "email" },
                { key: "phone", label: "phone" },
                { key: "designation", label: "designation" },
                { key: "subjects", label: "subjects" },
                { key: "joining_date", label: "joining_date" },
              ], "teachers-export");
              navigate("/preview-download");
            }}
            disabled={filteredTeachers.length === 0}
          >
            <FileDown className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <ImportTeachersDialog onTeachersImported={loadTeachers} />
          <AddTeacherDialog onTeacherAdded={loadTeachers} />
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredTeachers.map((teacher) => (
            <Card key={teacher.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-3">
                  <ProfileAvatar
                    avatarUrl={teacher.profiles?.avatar_url}
                    fullName={teacher.profiles?.full_name}
                    className="h-10 w-10"
                  />
                  <div className="min-w-0">
                    <span className="block truncate">{teacher.profiles?.full_name || "Unknown Teacher"}</span>
                    {teacher.employee_id && (
                      <span className="text-xs font-normal text-muted-foreground">({teacher.employee_id})</span>
                    )}
                  </div>
                </CardTitle>
                <CardDescription>
                  Joined: {new Date(teacher.joining_date).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {teacher.designation && (
                  <div className="flex items-center gap-2 text-sm">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    <span>{teacher.designation}</span>
                  </div>
                )}
                {teacher.subjects && teacher.subjects.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {teacher.subjects.map((subject, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        <BookOpen className="h-3 w-3 mr-1" />
                        {subject}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{teacher.profiles?.email}</span>
                </div>
                {teacher.profiles?.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{teacher.profiles.phone}</span>
                  </div>
                )}
                <div className="flex gap-2 mt-4">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => navigate(`/admin/teachers/${teacher.id}`)}
                  >
                    View Details
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => navigate(`/admin/profile/${teacher.user_id}`)}
                    title="Edit Profile"
                  >
                    <User className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredTeachers.length === 0 && (
          <Card className="mt-8">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                {searchQuery ? "No teachers found matching your search" : "No teachers added yet"}
              </p>
            </CardContent>
          </Card>
        )}
      </main>
      <BottomNav role="admin" />
      <div className="h-16 md:hidden" />
    </div>
  );
};

export default Teachers;
