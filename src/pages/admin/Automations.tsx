import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/shared/BottomNav";
import PageSkeleton from "@/components/shared/PageSkeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Automation {
  id: string;
  task_key: string;
  label: string;
  description: string;
  enabled: boolean;
  frequency: string;
  day_of_month: number;
  day_of_week: number;
  cron_expression: string;
}

const Automations = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [items, setItems] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("automation_settings")
      .select("*")
      .order("label");
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else setItems(data || []);
    setLoading(false);
  };

  const update = async (id: string, patch: Partial<Automation>) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("automation_settings")
      .update({ ...patch, updated_by: user?.id })
      .eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
      toast({ title: "Updated" });
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
            <Zap className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold">Automations</h1>
          </div>
        </div>
      </header>

      <main className="container max-w-5xl mx-auto px-4 py-6 space-y-4">
        {items.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No automation tasks configured. Add rows to <code>automation_settings</code> to manage recurring fees and salaries.
            </CardContent>
          </Card>
        ) : (
          items.map((a) => (
            <Card key={a.id}>
              <CardHeader className="flex flex-row items-start justify-between">
                <div>
                  <CardTitle className="text-base">{a.label}</CardTitle>
                  <p className="text-sm text-muted-foreground">{a.description}</p>
                </div>
                <Switch
                  checked={a.enabled}
                  onCheckedChange={(v) => update(a.id, { enabled: v })}
                />
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Frequency</Label>
                  <Select value={a.frequency} onValueChange={(v) => update(a.id, { frequency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {a.frequency === "monthly" && (
                  <div>
                    <Label>Day of Month</Label>
                    <Input
                      type="number" min={1} max={28}
                      value={a.day_of_month}
                      onChange={(e) => update(a.id, { day_of_month: parseInt(e.target.value) || 1 })}
                    />
                  </div>
                )}
                {a.frequency === "weekly" && (
                  <div>
                    <Label>Day of Week (0=Sun)</Label>
                    <Input
                      type="number" min={0} max={6}
                      value={a.day_of_week}
                      onChange={(e) => update(a.id, { day_of_week: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                )}
                <div>
                  <Label>Cron Expression</Label>
                  <Input
                    value={a.cron_expression}
                    onChange={(e) => update(a.id, { cron_expression: e.target.value })}
                  />
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </main>
      <BottomNav />
    </div>
  );
};

export default Automations;
