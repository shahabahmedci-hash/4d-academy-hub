import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/shared/BottomNav";
import PageSkeleton from "@/components/shared/PageSkeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Download, FileText, Plus, Trash2, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTeacherProfileGate } from "@/hooks/useTeacherProfileGate";

const ACCEPTED_TYPES = ".doc,.docx,.xls,.xlsx,.ppt,.pptx,.pdf";

const TeacherDocuments = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { loading: gateLoading, profileCompleted } = useTeacherProfileGate();
  const [loading, setLoading] = useState(true);
  const [docs, setDocs] = useState<any[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", file: null as File | null });

  useEffect(() => { if (profileCompleted) load(); }, [profileCompleted]);

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id || null);
    const { data } = await supabase.from("documents").select("*").order("created_at", { ascending: false });
    setDocs(data || []);
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
      const { error: insErr } = await supabase.from("documents").insert({
        title: form.title,
        description: form.description || null,
        file_name: form.file.name,
        file_type: form.file.type,
        file_url: path,
        file_size: form.file.size,
        uploaded_by: user.id,
        uploader_role: "teacher",
      });
      if (insErr) throw insErr;
      toast({ title: "Uploaded", description: "Document uploaded successfully" });
      setOpen(false);
      setForm({ title: "", description: "", file: null });
      if (fileInputRef.current) fileInputRef.current.value = "";
      load();
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const download = async (d: any) => {
    try {
      const { data, error } = await supabase.storage.from("documents").createSignedUrl(d.file_url, 60 * 60);
      if (error) throw error;
      window.open(data.signedUrl, "_blank");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async (d: any) => {
    await supabase.storage.from("documents").remove([d.file_url]);
    const { error } = await supabase.from("documents").delete().eq("id", d.id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Deleted" }); load(); }
  };

  if (gateLoading || loading) return <PageSkeleton />;

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="flex items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/teacher/dashboard")}><ArrowLeft className="h-5 w-5" /></Button>
            <h1 className="text-lg font-bold">Documents</h1>
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
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPTED_TYPES}
                    onChange={(e) => setForm({ ...form, file: e.target.files?.[0] || null })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Allowed: PDF, DOC(X), XLS(X), PPT(X)</p>
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
                  <div className="flex flex-wrap gap-1 mt-1">
                    {d.uploader_role && <Badge variant="outline" className="text-xs">{d.uploader_role}</Badge>}
                    <span className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => download(d)}><Download className="h-4 w-4" /></Button>
                {d.uploaded_by === userId && (
                  <Button size="icon" variant="ghost" onClick={() => handleDelete(d)}><Trash2 className="h-4 w-4" /></Button>
                )}
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
