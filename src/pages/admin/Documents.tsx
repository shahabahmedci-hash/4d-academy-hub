import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/shared/BottomNav";
import PageSkeleton from "@/components/shared/PageSkeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, FileText, Upload, Download, Trash2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Doc {
  id: string;
  title: string;
  description: string | null;
  file_name: string;
  file_type: string;
  file_url: string;
  file_size: number | null;
  uploaded_by: string;
  created_at: string;
}

const Documents = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", file: null as File | null });

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else setDocs(data || []);
    setLoading(false);
  };

  const handleUpload = async () => {
    if (!form.file || !form.title) {
      toast({ title: "Missing fields", description: "Title and file required", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const ext = form.file.name.split(".").pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("documents").upload(path, form.file);
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage.from("documents").createSignedUrl
        ? await supabase.storage.from("documents").createSignedUrl(path, 60 * 60 * 24 * 365)
        : { data: { signedUrl: "" } };

      const { error: insErr } = await supabase.from("documents").insert({
        title: form.title,
        description: form.description || null,
        file_name: form.file.name,
        file_type: form.file.type,
        file_url: path,
        file_size: form.file.size,
        uploaded_by: user.id,
        uploader_role: "admin",
      });
      if (insErr) throw insErr;

      toast({ title: "Uploaded", description: "Document uploaded successfully" });
      setOpen(false);
      setForm({ title: "", description: "", file: null });
      load();
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (doc: Doc) => {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(doc.file_url, 60 * 5);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const handleDelete = async (doc: Doc) => {
    await supabase.storage.from("documents").remove([doc.file_url]);
    const { error } = await supabase.from("documents").delete().eq("id", doc.id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Deleted" });
      load();
    }
  };

  if (loading) return <PageSkeleton />;

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-bold">Documents</h1>
            </div>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Upload</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Upload Document</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Title *</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <div>
                  <Label>File *</Label>
                  <Input type="file" onChange={(e) => setForm({ ...form, file: e.target.files?.[0] || null })} />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleUpload} disabled={uploading}>
                  <Upload className="h-4 w-4 mr-1" /> {uploading ? "Uploading..." : "Upload"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="container max-w-5xl mx-auto px-4 py-6">
        {docs.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No documents uploaded yet.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {docs.map((d) => (
              <Card key={d.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-start justify-between gap-2">
                    <span>{d.title}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {d.file_size ? `${(d.file_size / 1024).toFixed(1)} KB` : ""}
                    </span>
                  </CardTitle>
                  {d.description && <p className="text-sm text-muted-foreground">{d.description}</p>}
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{d.file_name}</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleDownload(d)}>
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDelete(d)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
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

export default Documents;
