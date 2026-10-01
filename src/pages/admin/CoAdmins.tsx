import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/shared/BottomNav";
import PageSkeleton from "@/components/shared/PageSkeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Search, ShieldCheck, Archive, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface CoAdmin {
  id: string;
  full_name: string;
  email: string;
  approved: boolean;
}

const CoAdmins = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [coAdmins, setCoAdmins] = useState<CoAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isMainAdmin, setIsMainAdmin] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: isAdmin } = await supabase.rpc("is_admin");
      setIsMainAdmin(!!isAdmin);
      await load();
    };
    init();
  }, []);

  const load = async () => {
    setLoading(true);
    const { data: roles, error: rolesErr } = await supabase
      .from("user_roles").select("user_id").eq("role", "co_admin");
    if (rolesErr) {
      toast({ title: "Error", description: rolesErr.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    const ids = (roles || []).map((r) => r.user_id);
    if (ids.length === 0) {
      setCoAdmins([]); setLoading(false); return;
    }
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, approved")
      .in("id", ids)
      .or("archived.is.null,archived.eq.false")
      .order("created_at", { ascending: false });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else setCoAdmins(data || []);
    setLoading(false);
  };

  const changeRole = async (id: string, newRole: "student" | "teacher" | "admin") => {
    try {
      // Remove co-admin role
      const { error: delError } = await supabase
        .from("user_roles").delete().eq("user_id", id).eq("role", "co_admin");
      if (delError) throw delError;

      // Add admin role if switching to admin
      if (newRole === "admin") {
        const { error: insError } = await supabase
          .from("user_roles").insert({ user_id: id, role: "admin" });
        if (insError && insError.code !== "23505") throw insError;
      }

      // Update profile role (approved/profile_completed stay untouched)
      const profileRole = newRole === "admin" ? "admin" : newRole;
      const { error: profError } = await supabase
        .from("profiles").update({ role: profileRole }).eq("id", id);
      if (profError) throw profError;

      // Create teacher record when switching to teacher
      if (newRole === "teacher") {
        const { error: teacherError } = await supabase.from("teachers").insert({
          user_id: id,
          joining_date: new Date().toISOString().split("T")[0],
        });
        if (teacherError && teacherError.code !== "23505") {
          console.error("Error creating teacher record:", teacherError);
        }
      }

      toast({ title: "Role Changed", description: `Co-admin is now a ${newRole}` });
      load();
    } catch (error: any) {
      console.error("Error changing role:", error);
      toast({ title: "Error", description: error?.message || "Failed to change role", variant: "destructive" });
    }
  };

  const archive = async (id: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.rpc("archive_profile", {
        _profile_id: id,
        _archived_by: user?.id,
      });
      if (error) throw error;
      toast({ title: "Archived", description: "Profile archived. The user can no longer sign in." });
      load();
    } catch (error: any) {
      console.error("Error archiving profile:", error);
      toast({ title: "Error", description: error?.message || "Failed to archive profile", variant: "destructive" });
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return coAdmins;
    return coAdmins.filter((c) =>
      c.full_name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q)
    );
  }, [coAdmins, search]);

  if (loading) return <PageSkeleton />;

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold">Co-Admins</h1>
          </div>
        </div>
      </header>

      <main className="container max-w-5xl mx-auto px-4 py-6 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              {coAdmins.length === 0
                ? "No co-admins found. Promote users via Approvals."
                : "No co-admins match your search."}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    {isMainAdmin && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.full_name}</TableCell>
                      <TableCell className="text-muted-foreground">{c.email}</TableCell>
                      <TableCell>
                        <Badge variant={c.approved ? "default" : "secondary"}>
                          {c.approved ? "Active" : "Pending"}
                        </Badge>
                      </TableCell>
                      {isMainAdmin && (
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2 flex-wrap">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/admin/edit-profile/${c.id}`)}
                            >
                              <Pencil className="h-4 w-4 mr-1" /> Edit
                            </Button>
                            <Select onValueChange={(v) => changeRole(c.id, v as "student" | "teacher" | "admin")}>
                              <SelectTrigger className="w-[150px] h-8">
                                <SelectValue placeholder="Change role..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="student">Student</SelectItem>
                                <SelectItem value="teacher">Teacher</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm">
                                  <Archive className="h-4 w-4 mr-1" /> Archive
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Archive co-admin?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {c.full_name} will no longer be able to sign in and will appear under Archived Profiles, where they can be restored later.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => archive(c.id)}>Archive</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </main>
      <BottomNav role="admin" />
    </div>
  );
};

export default CoAdmins;
