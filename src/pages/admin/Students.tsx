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
import ProfileAvatar from "@/components/shared/ProfileAvatar";
import { exportToCSV, formatDateForExport } from "@/lib/csvExport";

interface StudentProfile {
  full_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
}

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
  profiles?: StudentProfile;
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
      .channel("students-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "students" }, () => loadStudents())
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
    if (!adminResult.data && !coAdminResult.data) navigate("/");
  };

  const loadStudents = async () => {
    try {
      const { data: studentsData, error } = await supabase
        .from("students")
        .select("*")
        .order("enrollment_date", { ascending: false });

      if (error) throw error;

      const userIds = (studentsData || []).map((s) => s.user_id).filter(Boolean) as string[];

      let teacherUserIds = new Set<string>();
      let adminCoAdminUserIds = new Set<string>();
      let profilesById: Record<string, StudentProfile & { archived: boolean }> = {};

      if (userIds.length > 0) {
        const [teachersRes, rolesRes, profilesRes] = await Promise.all([
          supabase.from("teachers").select("user_id").in("user_id", userIds),
          supabase.from("user_roles").select("user_id, role").in("user_id", userIds).in("role", ["admin", "co_admin"]),
          supabase.from("profiles").select("id, full_name, email, phone, avatar_url, archived").in("id", userIds).eq("archived", false),
        ]);

        teacherUserIds = new Set((teachersRes.data || []).map((t) => t.user_id));
        adminCoAdminUserIds = new Set((rolesRes.data || []).map((r) => r.user_id));
        profilesById = Object.fromEntries(
          (profilesRes.data || []).map((p) => [p.id, { full_name: p.full_name, email: p.email, phone: p.phone, avatar_url: p.avatar_url, archived: p.archived || false }])
        );
      }

      const merged = (studentsData || [])
        .filter((s) => {
          if (s.user_id && teacherUserIds.has(s.user_id)) return false;
          if (s.user_id && adminCoAdminUserIds.has(s.user_id)) return false;
          return !s.user_id || profilesById[s.user_id];
        })
        .map((s) => ({ ...s, profiles: s.user_id ? profilesById[s.user_id] : undefined }));

      setStudents(merged);
    } catch (error) {
      console.error("Error loading students:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to load students" });
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

  if (loading) return <PageSkeleton />;

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-bold">Students ({filteredStudents.length})</h1>
          </div>
          <div className="flex items-center gap-2">
            <AddStudentDialog onStudentAdded={loadStudents} />
          </div>
        </div>
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search students..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const data = filteredStudents.map((s) => ({
              student_id: s.student_id || "",
              full_name: s.profiles?.full_name || "",
              email: s.profiles?.email || "",
              phone: s.profiles?.phone || "",
              class: s.class || "",
              section: s.section || "",
              enrollment_date: formatDateForExport(s.enrollment_date),
            }));
            exportToCSV(data, [
              { key: "student_id", label: "Student ID" },
              { key: "full_name", label: "Full Name" },
              { key: "email", label: "Email" },
              { key: "phone", label: "Phone" },
              { key: "class", label: "Class" },
              { key: "section", label: "Section" },
              { key: "enrollment_date", label: "Enrollment Date" },
            ], "students-export");
          }}
        >
          <Download className="h-4 w-4 mr-1" /> Export CSV
        </Button>

        {filteredStudents.map((student) => (
          <Card key={student.id} className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => navigate(`/admin/students/${student.id}`)}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <ProfileAvatar avatarUrl={student.profiles?.avatar_url} fullName={student.profiles?.full_name} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{student.profiles?.full_name || "Unknown Student"}</p>
                    {student.student_id && <Badge variant="outline" className="text-xs shrink-0">{student.student_id}</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">Enrolled: {new Date(student.enrollment_date).toLocaleDateString()}</p>
                  {(student.class || student.section) && (
                    <div className="flex gap-2 mt-1">
                      {student.class && <Badge variant="secondary" className="text-xs">Class {student.class}</Badge>}
                      {student.section && <Badge variant="secondary" className="text-xs">Batch {student.section}</Badge>}
                    </div>
                  )}
                  <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                    <Mail className="h-3 w-3" />
                    <span className="truncate">{student.profiles?.email}</span>
                  </div>
                  {student.profiles?.phone && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      <span>{student.profiles.phone}</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {filteredStudents.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              {searchQuery ? "No students found matching your search" : "No students enrolled yet"}
            </CardContent>
          </Card>
        )}
      </div>

      <BottomNav role="admin" />
    </div>
  );
};

export default Students;
