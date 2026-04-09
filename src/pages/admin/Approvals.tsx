import { useEffect, useState } from "react";
import BottomNav from "@/components/shared/BottomNav";
import PageSkeleton from "@/components/shared/PageSkeleton";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PendingUser {
  id: string;
  full_name: string;
  email: string;
  role: string;
  created_at: string;
}

const Approvals = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [isCoAdmin, setIsCoAdmin] = useState(false);

  useEffect(() => {
    const init = async () => {
      await checkAuth();
      await loadPendingUsers();
    };
    init();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/"); return; }
    const { data: isAdmin } = await supabase.rpc("is_admin");
    const { data: isCoAdminRole } = await supabase.rpc("is_co_admin");
    if (!isAdmin && !isCoAdminRole) { navigate("/"); return; }
    setIsCoAdmin(isCoAdminRole || false);
  };

  const loadPendingUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, role, created_at")
        .eq("approved", false)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPendingUsers(data || []);
    } catch (error) {
      console.error("Error loading pending users:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to load pending users" });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userId: string, newRole: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (isCoAdmin && (newRole === "admin" || newRole === "co_admin")) {
        toast({ variant: "destructive", title: "Permission Denied", description: "Co-admins cannot approve users as admins or co-admins" });
        return;
      }

      const profileRole = newRole === "co_admin" ? "admin" : newRole === "teacher" ? "teacher" : (newRole as "admin" | "student" | "teacher");

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          approved: true,
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
          role: profileRole,
        })
        .eq("id", userId);

      if (updateError) throw updateError;

      if (newRole === "admin" || newRole === "co_admin" || newRole === "teacher") {
        const { error: roleError } = await supabase.from("user_roles").insert({ user_id: userId, role: newRole as any });
        if (roleError && roleError.code !== "23505") throw roleError;
      }

      if (newRole === "teacher") {
        const { error: teacherError } = await supabase.from("teachers").insert({
          user_id: userId,
          joining_date: new Date().toISOString().split("T")[0],
        });
        if (teacherError && teacherError.code !== "23505") {
          console.error("Error creating teacher record:", teacherError);
        }
      }

      toast({ title: "User Approved", description: `User has been approved as ${newRole}` });
      loadPendingUsers();
    } catch (error) {
      console.error("Error approving user:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to approve user" });
    }
  };

  const handleReject = async (userId: string) => {
    try {
      const { error } = await supabase.from("profiles").delete().eq("id", userId);
      if (error) throw error;
      toast({ title: "User Rejected", description: "User registration has been rejected" });
      loadPendingUsers();
    } catch (error) {
      console.error("Error rejecting user:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to reject user" });
    }
  };

  if (loading) return <PageSkeleton />;

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex items-center gap-2 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold">User Approvals</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Pending User Approvals</CardTitle>
            <CardDescription>
              Review and approve student registrations.
              {isCoAdmin && " As a co-admin, you cannot approve users as admins."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pendingUsers.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No pending approvals</p>
            ) : (
              <div className="space-y-4">
                {pendingUsers.map((user) => (
                  <Card key={user.id}>
                    <CardContent className="p-4">
                      <h3 className="font-semibold">{user.full_name}</h3>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline">Requested: {user.role}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(user.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        <Select onValueChange={(value) => handleApprove(user.id, value)}>
                          <SelectTrigger className="w-[160px]">
                            <SelectValue placeholder="Approve as..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="student">Student</SelectItem>
                            <SelectItem value="teacher">Teacher</SelectItem>
                            {!isCoAdmin && <SelectItem value="co_admin">Co-Admin</SelectItem>}
                            {!isCoAdmin && <SelectItem value="admin">Admin</SelectItem>}
                          </SelectContent>
                        </Select>
                        <Button variant="destructive" size="sm" onClick={() => handleReject(user.id)}>
                          <X className="h-4 w-4 mr-1" /> Reject
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
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

export default Approvals;
