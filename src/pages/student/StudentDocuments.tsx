import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/shared/BottomNav";
import PageSkeleton from "@/components/shared/PageSkeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useProfileCompletionGate } from "@/hooks/useProfileCompletionGate";

interface Doc {
  id: string;
  title: string;
  description: string | null;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  class: string | null;
  section: string | null;
  stream: string | null;
  created_at: string;
}

const FILE_TYPE_LABELS: Record<string, string> = {
  "application/pdf": "PDF",
  "application/msword": "Word",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
  "application/vnd.ms-excel": "Excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel",
  "application/vnd.ms-powerpoint": "PowerPoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PowerPoint",
};

const getFileTypeLabel = (mime: string | null) => (mime && FILE_TYPE_LABELS[mime]) || "Document";

const formatFileSize = (bytes: number | null) => {
  if (!bytes) return "Unknown size";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};


const StudentDocuments = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { loading: gateLoading, profileCompleted } = useProfileCompletionGate();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profileCompleted) load();
  }, [profileCompleted]);

  const load = async () => {
    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else setDocs(data || []);
    setLoading(false);
  };

  const handleDownload = async (doc: Doc) => {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(doc.file_url, 3600);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  if (gateLoading || loading) return <PageSkeleton />;

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/student/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <FileText className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">Study Materials</h1>
        </div>
      </header>

      <main className="container max-w-5xl mx-auto px-4 py-6">
        {docs.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">No documents available.</CardContent></Card>
        ) : (
          <div className="space-y-3">
            {docs.map((d) => (
              <Card key={d.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{d.title}</CardTitle>
                  {d.description && <p className="text-sm text-muted-foreground">{d.description}</p>}
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">
                    <p>{d.file_name}</p>
                    <p>
                      {getFileTypeLabel(d.file_type)} · {formatFileSize(d.file_size)}
                      {d.class ? ` · Class ${d.class}${d.section ? `-${d.section}` : ""}` : ""}
                      {d.stream ? ` · ${d.stream}` : ""}
                    </p>
                  </div>

                  <Button size="sm" variant="outline" onClick={() => handleDownload(d)}>
                    <Download className="h-4 w-4 mr-1" /> Open
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
      <BottomNav role="student" />
    </div>
  );
};

export default StudentDocuments;
