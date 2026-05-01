import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/shared/BottomNav";
import PageSkeleton from "@/components/shared/PageSkeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, RotateCcw, Archive } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ArchivedProfile {
  id: string;
  full_name: string;
  email: string;
  role: string;
  archived_at: string | null;
}

const ArchivedProfiles = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<ArchivedProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, role, archived_at")
      .eq("archived", true)
      .order("archived_at", { ascending: false });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setProfiles(data || []);
    }
    setLoading(false);
  };

  const restore = async (id: string) => {
    const { error } = await supabase.rpc("restore_profile", { _profile_id: id });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Restored", description: "Profile restored successfully" });
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
            <Archive className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold">Archived Profiles</h1>
          </div>
        </div>
      </header>

      <main className="container max-w-5xl mx-auto px-4 py-6">
        {profiles.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No archived profiles.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {profiles.map((p) => (
              <Card key={p.id}>
                <CardHeader className="pb-2 flex flex-row items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{p.full_name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{p.email}</p>
                  </div>
                  <Badge variant="secondary">{p.role}</Badge>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Archived: {p.archived_at ? new Date(p.archived_at).toLocaleDateString() : "—"}
                  </p>
                  <Button size="sm" onClick={() => restore(p.id)}>
                    <RotateCcw className="h-4 w-4 mr-1" /> Restore
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
};

export default ArchivedProfiles;
