import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Zap, Play, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { runAutomationTask } from "@/lib/runAutomationTask";

interface AutomationSetting {
  id: string;
  task_key: string;
  label: string;
  enabled: boolean;
  cron_expression: string;
  frequency: string;
  day_of_week: number;
  day_of_month: number;
}

const FRIENDLY_LABELS: Record<string, string> = {
  "process-recurring-templates": "Auto-Generate Dues",
  "auto-mark-overdue": "Mark Overdue Fees",
  "send-fee-reminders": "Send Fee Reminders",
  "auto-attendance-summary": "Attendance Summary",
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const getOrdinal = (n: number) => {
  if (n >= 11 && n <= 13) return "th";
  const s = ["th", "st", "nd", "rd"];
  return s[n % 10] || s[0];
};

const parseCron = (cron: string) => {
  const parts = cron.split(" ");
  const minute = parseInt(parts[0]) || 0;
  const hour = parseInt(parts[1]) || 6;
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const ampm = hour < 12 ? "AM" : "PM";
  return `${String(h12).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${ampm}`;
};

const formatSchedule = (s: AutomationSetting) => {
  const time = parseCron(s.cron_expression);
  switch (s.frequency) {
    case "weekly": return `Weekly on ${DAY_NAMES[s.day_of_week]} at ${time}`;
    case "fortnightly": return `Fortnightly on ${DAY_NAMES[s.day_of_week]} at ${time}`;
    case "monthly": return `Monthly on ${s.day_of_month}${getOrdinal(s.day_of_month)} at ${time}`;
    case "quarterly": return `Quarterly on ${s.day_of_month}${getOrdinal(s.day_of_month)} at ${time}`;
    case "half_yearly": return `Half-yearly on ${s.day_of_month}${getOrdinal(s.day_of_month)} at ${time}`;
    case "yearly": return `Yearly on Jan ${s.day_of_month}${getOrdinal(s.day_of_month)} at ${time}`;
    default: return `Daily at ${time}`;
  }
};

const DashboardAutomationCard = () => {
  const [settings, setSettings] = useState<AutomationSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningTask, setRunningTask] = useState<string | null>(null);
  const [confirmRunTask, setConfirmRunTask] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("automation_settings")
      .select("id, task_key, label, enabled, cron_expression, frequency, day_of_week, day_of_month")
      .order("label");
    if (data) setSettings(data);
    setLoading(false);
  };

  const toggleEnabled = async (id: string, enabled: boolean) => {
    const prevSettings = [...settings];
    setSettings((prev) => prev.map((s) => (s.id === id ? { ...s, enabled } : s)));

    const { error } = await supabase
      .from("automation_settings")
      .update({ enabled })
      .eq("id", id);
    if (error) {
      setSettings(prevSettings);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const runNow = async (taskKey: string) => {
    setRunningTask(taskKey);
    try {
      await runAutomationTask(taskKey);
      toast({
        title: "Success",
        description: `${FRIENDLY_LABELS[taskKey] || taskKey} ran successfully`,
        variant: "default",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to run task",
        variant: "destructive",
      });
    } finally {
      setRunningTask(null);
    }
  };

  if (loading) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (settings.length === 0) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Automation Engine
          </CardTitle>
          <CardDescription>No automated tasks configured yet</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => navigate("/admin/automations")}>
            <Settings className="h-4 w-4 mr-1" />
            Set Up Automations
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Automation Engine
            </CardTitle>
            <CardDescription>Quick controls for automated tasks</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/admin/automations")}>
            <Settings className="h-4 w-4 mr-1" />
            Manage
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {settings.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-muted/30">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{FRIENDLY_LABELS[s.task_key] || s.label}</p>
                  <p className="text-xs text-muted-foreground">{formatSchedule(s)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch
                    checked={s.enabled}
                    onCheckedChange={(checked) => toggleEnabled(s.id, checked)}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={runningTask === s.task_key}
                    onClick={() => setConfirmRunTask(s.task_key)}
                  >
                    <Play className="h-3 w-3 mr-1" />
                    {runningTask === s.task_key ? "Running..." : "Run"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!confirmRunTask} onOpenChange={(open) => !open && setConfirmRunTask(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Run Task Now?</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately execute "{confirmRunTask ? FRIENDLY_LABELS[confirmRunTask] || confirmRunTask : ""}". Are you sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (confirmRunTask) { runNow(confirmRunTask); } setConfirmRunTask(null); }}>
              Run Now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default DashboardAutomationCard;
