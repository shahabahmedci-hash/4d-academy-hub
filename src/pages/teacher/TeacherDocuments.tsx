import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/shared/BottomNav";
import PageSkeleton from "@/components/shared/PageSkeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTeacherProfileGate } from "@/hooks/useTeacherProfileGate";

const TeacherDocuments = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { loading: gateLoading, profileCompleted } = useTeacherProfileGate();
  const [loading, setLoading] = useState(true);
  const [docs, setDocs] = useState<any[]>([]);

  useEffect(() => { if (profileCompleted) load(); }, [profileCompleted]);

  const load = async () => {
    const { data } = await supabase.from("documents").select("*").order("created_at", { ascending: false });
    setDocs(data || []);
    setLoading(false);
  };

  const download = async (d: any) => {
    try {
      const { data, error } = await supabase.storage.from("documents").createSignedUrl(d.file_url, 60);
      if (error) throw error;
      window.open(data.signedUrl, "_blank");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  if (gateLoading || loading) return <PageSkeleton />;

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/teacher/dashboard")}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="text-lg font-bold">Documents</h1>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {docs.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">No documents available</CardContent></Card>
        ) : (
          docs.map((d) => (
            <Card key={d.id}>
              <CardContent className="p-4 flex items-center gap-3">
                <FileText className="h-8 w-8 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{d.title}</p>
                  {d.description && <p className="text-xs text-muted-foreground truncate">{d.description}</p>}
                  <p className="text-xs text-muted-foreground">{d.file_type}</p>
                </div>
                <Button size="icon" variant="ghost" onClick={() => download(d)}><Download className="h-4 w-4" /></Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
      <BottomNav role="teacher" />
    </div>
  );
};

export default TeacherDocuments;
