import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/shared/BottomNav";
import PageSkeleton from "@/components/shared/PageSkeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Calendar, Plus, Lock, Unlock, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FY {
  id: string;
  label: string;
  start_date: string;
  end_date: string;
  is_frozen: boolean;
  frozen_at: string | null;
}

const FinancialYears = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [years, setYears] = useState<FY[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ label: "", start_date: "", end_date: "" });

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("financial_years")
      .select("*")
      .order("start_date", { ascending: false });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else setYears(data || []);
    setLoading(false);
  };

  const create = async () => {
    if (!form.label || !form.start_date || !form.end_date) {
      toast({ title: "Missing fields", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("financial_years").insert(form);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Created" });
      setOpen(false);
      setForm({ label: "", start_date: "", end_date: "" });
      load();
    }
  };

  const toggleFreeze = async (fy: FY) => {
    const { data: { user } } = await supabase.auth.getUser();
    const update = fy.is_frozen
      ? { is_frozen: false, frozen_at: null, frozen_by: null }
      : { is_frozen: true, frozen_at: new Date().toISOString(), frozen_by: user?.id };
    const { error } = await supabase.from("financial_years").update(update).eq("id", fy.id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: fy.is_frozen ? "Unfrozen" : "Frozen" });
      load();
    }
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("financial_years").delete().eq("id", id);
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
              <Calendar className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-bold">Financial Years</h1>
            </div>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Financial Year</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Label *</Label>
                  <Input placeholder="e.g. FY 2025-26" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
                </div>
                <div>
                  <Label>Start Date *</Label>
                  <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                </div>
                <div>
                  <Label>End Date *</Label>
                  <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
                </div>
              </div>
              <DialogFooter><Button onClick={create}>Create</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="container max-w-5xl mx-auto px-4 py-6">
        {years.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">No financial years.</CardContent></Card>
        ) : (
          <div className="space-y-3">
            {years.map((fy) => (
              <Card key={fy.id}>
                <CardHeader className="pb-2 flex flex-row items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{fy.label}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {new Date(fy.start_date).toLocaleDateString()} — {new Date(fy.end_date).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant={fy.is_frozen ? "destructive" : "secondary"}>
                    {fy.is_frozen ? "Frozen" : "Active"}
                  </Badge>
                </CardHeader>
                <CardContent className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => toggleFreeze(fy)}>
                    {fy.is_frozen ? <><Unlock className="h-4 w-4 mr-1" />Unfreeze</> : <><Lock className="h-4 w-4 mr-1" />Freeze</>}
                  </Button>
                  {!fy.is_frozen && (
                    <Button size="sm" variant="destructive" onClick={() => remove(fy.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
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

export default FinancialYears;
