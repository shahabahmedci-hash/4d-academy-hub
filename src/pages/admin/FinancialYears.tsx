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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  const [authorized, setAuthorized] = useState(false);
  const [open, setOpen] = useState(false);
  const [startYear, setStartYear] = useState<string>(String(new Date().getFullYear()));
  const [confirmAction, setConfirmAction] = useState<{ type: "freeze" | "unfreeze" | "delete"; fy: FY } | null>(null);

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/"); return; }
    const { data: isAdmin } = await supabase.rpc("is_admin");
    if (!isAdmin) {
      toast({ title: "Unauthorized", description: "Admin access required", variant: "destructive" });
      navigate("/admin/dashboard");
      return;
    }
    setAuthorized(true);
    await load();
  };

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
    const y = parseInt(startYear, 10);
    if (!y || y < 2000 || y > 2100) {
      toast({ title: "Invalid year", variant: "destructive" });
      return;
    }
    const label = `FY ${y}-${String((y + 1) % 100).padStart(2, "0")}`;
    const start_date = `${y}-04-01`;
    const end_date = `${y + 1}-03-31`;
    const { error } = await supabase.from("financial_years").insert({ label, start_date, end_date });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Started", description: label });
      setOpen(false);
      load();
    }
  };

  const doAction = async () => {
    if (!confirmAction) return;
    const { type, fy } = confirmAction;
    if (type === "delete") {
      const { error } = await supabase.from("financial_years").delete().eq("id", fy.id);
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else { toast({ title: "Deleted" }); load(); }
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const update = type === "unfreeze"
        ? { is_frozen: false, frozen_at: null, frozen_by: null }
        : { is_frozen: true, frozen_at: new Date().toISOString(), frozen_by: user?.id };
      const { error } = await supabase.from("financial_years").update(update).eq("id", fy.id);
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else { toast({ title: type === "freeze" ? "Frozen" : "Unfrozen" }); load(); }
    }
    setConfirmAction(null);
  };

  if (!authorized || loading) return <PageSkeleton />;

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
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Start Year</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Start Financial Year</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Starting Year</Label>
                  <Input
                    type="number"
                    min={2000}
                    max={2100}
                    value={startYear}
                    onChange={(e) => setStartYear(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Auto-builds Apr 1 {startYear} → Mar 31 {Number(startYear) + 1} as "FY {startYear}-{String((Number(startYear) + 1) % 100).padStart(2, "0")}"
                  </p>
                </div>
              </div>
              <DialogFooter><Button onClick={create}>Start</Button></DialogFooter>
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
                    {fy.is_frozen && fy.frozen_at && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Frozen on {new Date(fy.frozen_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <Badge variant={fy.is_frozen ? "destructive" : "secondary"}>
                    {fy.is_frozen ? "Frozen" : "Active"}
                  </Badge>
                </CardHeader>
                <CardContent className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => setConfirmAction({ type: fy.is_frozen ? "unfreeze" : "freeze", fy })}>
                    {fy.is_frozen ? <><Unlock className="h-4 w-4 mr-1" />Unfreeze</> : <><Lock className="h-4 w-4 mr-1" />Freeze</>}
                  </Button>
                  {!fy.is_frozen && (
                    <Button size="sm" variant="destructive" onClick={() => setConfirmAction({ type: "delete", fy })}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <AlertDialog open={!!confirmAction} onOpenChange={(o) => !o && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === "freeze" && `Freeze ${confirmAction.fy.label}?`}
              {confirmAction?.type === "unfreeze" && `Unfreeze ${confirmAction.fy.label}?`}
              {confirmAction?.type === "delete" && `Delete ${confirmAction.fy.label}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === "freeze" && "Freezing blocks edits to fees/expenses/attendance dated within this year."}
              {confirmAction?.type === "unfreeze" && "Unfreezing re-enables edits within this year."}
              {confirmAction?.type === "delete" && "This cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doAction}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BottomNav role="admin" />
    </div>
  );
};

export default FinancialYears;
