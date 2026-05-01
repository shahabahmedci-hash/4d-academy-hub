import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/shared/BottomNav";
import PageSkeleton from "@/components/shared/PageSkeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ShieldCheck, UserMinus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

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

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    const { data: roles, error: rolesErr } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "co_admin");
    if (rolesErr) {
      toast({ title: "Error", description: rolesErr.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    const ids = (roles || []).map((r) => r.user_id);
    if (ids.length === 0) {
      setCoAdmins([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, approved")
      .in("id", ids)
      .or("archived.is.null,archived.eq.false")
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setCoAdmins(data || []);
    }
    setLoading(false);
  };

  const revoke = async (id: string) => {
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ role: "student", approved: false })
      .eq("id", id);
    const { error: roleError } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", id)
      .eq("role", "co_admin");

    if (profileError || roleError) {
      toast({ title: "Error", description: (profileError || roleError)?.message, variant: "destructive" });
    } else {
      toast({ title: "Revoked", description: "Co-admin access revoked" });
      load();
    }
  };

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

      <main className="container max-w-5xl mx-auto px-4 py-6">
        {coAdmins.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No co-admins found. Promote users via Approvals.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {coAdmins.map((c) => (
              <Card key={c.id}>
                <CardHeader className="pb-2 flex flex-row items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{c.full_name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{c.email}</p>
                  </div>
                  <Badge variant={c.approved ? "default" : "secondary"}>
                    {c.approved ? "Active" : "Pending"}
                  </Badge>
                </CardHeader>
                <CardContent className="flex justify-end">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        <UserMinus className="h-4 w-4 mr-1" /> Revoke
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Revoke co-admin access?</AlertDialogTitle>
                        <AlertDialogDescription>
                          {c.full_name} will be downgraded to student and require re-approval.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => revoke(c.id)}>Revoke</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
      <BottomNav role="admin" />
    </div>
  );
};

export default CoAdmins;
