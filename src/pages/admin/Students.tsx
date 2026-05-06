import { useEffect, useState } from "react";
import BottomNav from "@/components/shared/BottomNav";
import PageSkeleton from "@/components/shared/PageSkeleton";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Search, Phone, Mail, User, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AddStudentDialog } from "@/components/admin/AddStudentDialog";
import { BulkPromotionDialog } from "@/components/admin/BulkPromotionDialog";
import { ImportStudentsDialog } from "@/components/admin/ImportStudentsDialog";
import ProfileAvatar from "@/components/shared/ProfileAvatar";
import { exportToCSV, formatDateForExport } from "@/lib/csvExport";

interface Student {
  id: string;
  user_id: string | null;
  student_id: string | null;
  enrollment_date: string;
  date_of_birth: string | null;
  address: string | null;
  class: string | null;
  section: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  profiles?: {
    full_name: string;
    email: string;
    phone: string | null;
    avatar_url: string | null;
  };
}


const Students = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const init = async () => {
      await checkAuth();
      await loadStudents();
    };
    init();

    const channel = supabase
      .channel('students-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'students' },
        () => {
          loadStudents();
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

    // Check if user is admin or co_admin
    const [adminResult, coAdminResult] = await Promise.all([
      supabase.rpc("is_admin"),
      supabase.rpc("is_co_admin")
    ]);
    
    if (!adminResult.data && !coAdminResult.data) {
      navigate("/student/dashboard");
    }
  };

  const loadStudents = async () => {
    try {
      const { data: studentsData, error: studentsError } = await supabase
        .from("students")
        .select("*")
        .order("enrollment_date", { ascending: false });

      if (studentsError) throw studentsError;

      const userIds = (studentsData || [])
        .map((s) => s.user_id)
        .filter(Boolean) as string[];

      // Get teacher user IDs to exclude them from student list
      let teacherUserIds: Set<string> = new Set();
      if (userIds.length > 0) {
        const { data: teachersData } = await supabase
          .from("teachers")
          .select("user_id")
          .in("user_id", userIds);
        teacherUserIds = new Set((teachersData || []).map(t => t.user_id));
      }

      // Get admin and co-admin user IDs to exclude them from student list
      let adminCoAdminUserIds: Set<string> = new Set();
      if (userIds.length > 0) {
        const { data: rolesData } = await supabase
          .from("user_roles")
          .select("user_id, role")
          .in("user_id", userIds)
          .in("role", ["admin", "co_admin"]);
        adminCoAdminUserIds = new Set((rolesData || []).map(r => r.user_id));
      }

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

      // Filter out students whose profiles are archived, teachers, admins, and co-admins
      const merged = (studentsData || [])
        .filter((s) => {
          // Exclude if user is a teacher
          if (s.user_id && teacherUserIds.has(s.user_id)) return false;
          // Exclude if user is an admin or co-admin
          if (s.user_id && adminCoAdminUserIds.has(s.user_id)) return false;
          // Keep if no user_id or if profile exists (not archived)
          return !s.user_id || profilesById[s.user_id];
        })
        .map((s) => ({
          ...s,
          profiles: s.user_id ? profilesById[s.user_id] : undefined,
        }));

      setStudents(merged);
    } catch (error) {
      console.error("Error loading students:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load students",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = students.filter((student) => {
    const name = student.profiles?.full_name || "";
    const email = student.profiles?.email || "";
    const sid = student.student_id || "";
    return (
      name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sid.toLowerCase().includes(searchQuery.toLowerCase())
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
              <h1 className="text-2xl font-bold">Student Management</h1>
              <p className="text-sm text-muted-foreground">Manage all student records</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email or student ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              onClick={() => {
                const data = filteredStudents.map((s) => ({
                  student_id: s.student_id || "",
                  full_name: s.profiles?.full_name || "",
                  email: s.profiles?.email || "",
                  phone: s.profiles?.phone || "",
                  class: s.class || "",
                  section: s.section || "",
                  stream: (s as any).stream || "",
                  enrollment_date: formatDateForExport(s.enrollment_date),
                }));
                exportToCSV(data, [
                  { key: "student_id", label: "student_id" },
                  { key: "full_name", label: "full_name" },
                  { key: "email", label: "email" },
                  { key: "phone", label: "phone" },
                  { key: "class", label: "class" },
                  { key: "section", label: "section" },
                  { key: "stream", label: "stream" },
                  { key: "enrollment_date", label: "enrollment_date" },
                ], "students-export");
                navigate("/preview-download");
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <ImportStudentsDialog onStudentsImported={loadStudents} />
            <BulkPromotionDialog onStudentsUpdated={loadStudents} />
            <AddStudentDialog onStudentAdded={loadStudents} />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredStudents.map((student) => (
            <Card key={student.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-3">
                  <ProfileAvatar
                    avatarUrl={student.profiles?.avatar_url}
                    fullName={student.profiles?.full_name}
                    className="h-10 w-10"
                  />
                  <div className="min-w-0">
                    <span className="block truncate">{student.profiles?.full_name || "Unknown Student"}</span>
                    {student.student_id && (
                      <span className="text-xs font-normal text-muted-foreground">({student.student_id})</span>
                    )}
                  </div>
                </CardTitle>
                <CardDescription>
                  Enrolled: {new Date(student.enrollment_date).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {(student.class || student.section) && (
                  <div className="flex gap-2 flex-wrap mb-2">
                    {student.class && <Badge variant="outline">Class {student.class}</Badge>}
                    {student.section && <Badge variant="secondary">Batch {student.section}</Badge>}
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{student.profiles?.email}</span>
                </div>
                {student.profiles?.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{student.profiles.phone}</span>
                  </div>
                )}
                {student.address && (
                  <p className="text-sm text-muted-foreground truncate">{student.address}</p>
                )}
                <div className="flex gap-2 mt-4">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => navigate(`/admin/students/${student.id}`)}
                  >
                    View Details
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => navigate(`/admin/profile/${student.user_id}`)}
                    title="Edit Profile"
                  >
                    <User className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredStudents.length === 0 && (
          <Card className="mt-8">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                {searchQuery ? "No students found matching your search" : "No students enrolled yet"}
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

export default Students;
