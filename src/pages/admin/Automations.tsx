import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Zap, Play, Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import BottomNav from "@/components/shared/BottomNav";
import PageSkeleton from "@/components/shared/PageSkeleton";
import NotificationBell from "@/components/shared/NotificationBell";
import ThemeToggle from "@/components/shared/ThemeToggle";
import logo from "@/assets/logo.png";
import { runAutomationTask } from "@/lib/runAutomationTask";

interface AutomationSetting {
  id: string;
  task_key: string;
  label: string;
  cron_expression: string;
  description: string;
  enabled: boolean;
  frequency: string;
  day_of_week: number;
  day_of_month: number;
}

interface RecurringTemplate {
  id: string;
  type: string;
  student_id: string | null;
  teacher_id: string | null;
  admin_id: string | null;
  amount: number;
  interval: string;
  day_of_month: number;
  notes: string | null;
  category: string | null;
  is_active: boolean;
  last_generated: string | null;
  created_by: string;
}

interface Option {
  id: string;
  label: string;
}

const EXPENSE_CATEGORIES = ["rent", "utilities", "supplies", "admin_personal", "marketing", "other"];
const INTERVALS = ["monthly", "quarterly", "yearly"];
const MINUTES = ["00", "15", "30", "45"];
const FREQUENCIES = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "fortnightly", label: "Fortnightly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "half_yearly", label: "Half Yearly" },
  { value: "yearly", label: "Yearly" },
];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const FRIENDLY_LABELS: Record<string, string> = {
  "process-recurring-templates": "Auto-Generate Dues",
  "auto-mark-overdue": "Mark Overdue Fees",
  "send-fee-reminders": "Send Fee Reminders",
  "auto-attendance-summary": "Attendance Summary",
};

const parseCron = (cron: string): { hour: number; minute: number } => {
  const parts = (cron || "").split(" ");
  return { minute: parseInt(parts[0]) || 0, hour: parseInt(parts[1]) || 6 };
};

const formatTime12hr = (hour: number, minute: number): string => {
  const period = hour >= 12 ? "PM" : "AM";
  const h = hour % 12 || 12;
  return `${h}:${String(minute).padStart(2, "0")} ${period}`;
};

const buildCron = (hour: number, minute: number, frequency: string, dayOfWeek: number, dayOfMonth: number) => {
  switch (frequency) {
    case "weekly":
    case "fortnightly":
      return `${minute} ${hour} * * ${dayOfWeek}`;
    case "monthly":
      return `${minute} ${hour} ${dayOfMonth} * *`;
    case "quarterly":
      return `${minute} ${hour} ${dayOfMonth} 1,4,7,10 *`;
    case "half_yearly":
      return `${minute} ${hour} ${dayOfMonth} 1,7 *`;
    case "yearly":
      return `${minute} ${hour} ${dayOfMonth} 1 *`;
    default:
      return `${minute} ${hour} * * *`;
  }
};

const getOrdinal = (n: number) => {
  if (n >= 11 && n <= 13) return "th";
  const s = ["th", "st", "nd", "rd"];
  return s[n % 10] || s[0];
};

const buildDescription = (
  hour: number,
  minute: number,
  frequency: string,
  dayOfWeek: number,
  dayOfMonth: number,
): string => {
  const time = formatTime12hr(hour, minute);
  switch (frequency) {
    case "weekly":
      return `Runs weekly on ${DAY_NAMES[dayOfWeek]} at ${time}`;
    case "fortnightly":
      return `Runs fortnightly on ${DAY_NAMES[dayOfWeek]} at ${time}`;
    case "monthly":
      return `Runs monthly on ${dayOfMonth}${getOrdinal(dayOfMonth)} at ${time}`;
    case "quarterly":
      return `Runs quarterly on ${dayOfMonth}${getOrdinal(dayOfMonth)} at ${time}`;
    case "half_yearly":
      return `Runs half-yearly on ${dayOfMonth}${getOrdinal(dayOfMonth)} at ${time}`;
    case "yearly":
      return `Runs yearly on Jan ${dayOfMonth}${getOrdinal(dayOfMonth)} at ${time}`;
    default:
      return `Runs daily at ${time}`;
  }
};

const Automations = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<AutomationSetting[]>([]);
  const [templates, setTemplates] = useState<RecurringTemplate[]>([]);
  const [students, setStudents] = useState<Option[]>([]);
  const [teachers, setTeachers] = useState<Option[]>([]);
  const [admins, setAdmins] = useState<Option[]>([]);
  const [isMainAdmin, setIsMainAdmin] = useState(false);
  const [triggeringTask, setTriggeringTask] = useState<string | null>(null);
  const [templateTab, setTemplateTab] = useState("fee");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<RecurringTemplate | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [confirmRunTask, setConfirmRunTask] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [formType, setFormType] = useState("fee");
  const [formStudentId, setFormStudentId] = useState("");
  const [formTeacherId, setFormTeacherId] = useState("");
  const [formAdminId, setFormAdminId] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formInterval, setFormInterval] = useState("monthly");
  const [formDayOfMonth, setFormDayOfMonth] = useState("1");
  const [formNotes, setFormNotes] = useState("");
  const [formCategory, setFormCategory] = useState("other");
  const [formIsActive, setFormIsActive] = useState(true);

  useEffect(() => {
    checkAuthAndLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkAuthAndLoad = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        navigate("/");
        return;
      }
      const [adminResult, coAdminResult] = await Promise.all([
        supabase.rpc("is_admin"),
        supabase.rpc("is_co_admin"),
      ]);
      if (!adminResult.data && !coAdminResult.data) {
        navigate("/student/dashboard");
        return;
      }
      setIsMainAdmin(adminResult.data || false);
      setUserId(user.id);
      await loadData(adminResult.data || false);
    } catch {
      navigate("/");
    }
  };

  const loadData = async (adminFlag?: boolean) => {
    const isAdmin = adminFlag ?? isMainAdmin;
    setLoading(true);
    const [settingsRes, templatesRes, studentsRes, teachersRes] = await Promise.all([
      supabase.from("automation_settings").select("*").order("task_key"),
      supabase.from("recurring_templates").select("*").order("created_at", { ascending: false }),
      supabase
        .from("students")
        .select("id, student_id, user_id")
        .then(async (res) => {
          if (!res.data) return [];
          const [teacherRes, adminRolesRes] = await Promise.all([
            supabase.from("teachers").select("user_id"),
            supabase.from("user_roles").select("user_id").in("role", ["admin", "co_admin"]),
          ]);
          const excludeIds = new Set<string>([
            ...(teacherRes.data?.map((t) => t.user_id) || []),
            ...(adminRolesRes.data?.map((r) => r.user_id) || []),
          ]);
          const filtered = res.data.filter((s) => s.user_id && !excludeIds.has(s.user_id));
          const userIds = filtered.map((s) => s.user_id).filter(Boolean) as string[];
          if (userIds.length === 0) return [];
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", userIds)
            .eq("archived", false);
          const profileMap = new Map(profiles?.map((p) => [p.id, p.full_name]) || []);
          return filtered
            .filter((s) => profileMap.has(s.user_id || ""))
            .map((s) => ({
              id: s.id,
              label: `${profileMap.get(s.user_id || "") || "Unknown"} (${s.student_id || "N/A"})`,
            }));
        }),
      supabase
        .from("teachers")
        .select("id, employee_id, user_id")
        .then(async (res) => {
          if (!res.data) return [];
          const userIds = res.data.map((t) => t.user_id);
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", userIds);
          const profileMap = new Map(profiles?.map((p) => [p.id, p.full_name]) || []);
          return res.data.map((t) => ({
            id: t.id,
            label: `${profileMap.get(t.user_id) || "Unknown"} (${t.employee_id || "N/A"})`,
          }));
        }),
    ]);
    if (settingsRes.data) setSettings(settingsRes.data as AutomationSetting[]);
    if (templatesRes.data) setTemplates(templatesRes.data as RecurringTemplate[]);
    setStudents(studentsRes as Option[]);
    setTeachers(teachersRes as Option[]);

    if (isAdmin) {
      const { data: adminRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["admin", "co_admin"]);
      if (adminRoles && adminRoles.length > 0) {
        const adminUserIds = adminRoles.map((r) => r.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", adminUserIds)
          .eq("archived", false);
        setAdmins((profiles || []).map((p) => ({ id: p.id, label: p.full_name })));
      }
    }

    setLoading(false);
  };

  const updateSetting = async (id: string, updates: Partial<AutomationSetting>) => {
    const prevSettings = [...settings];
    setSettings((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));

    const { error } = await supabase
      .from("automation_settings")
      .update({ ...updates, updated_by: userId, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      setSettings(prevSettings);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Saved", description: "Setting updated." });
    }
  };

  const handleScheduleChange = (
    setting: AutomationSetting,
    changes: Partial<{ hour: number; minute: number; frequency: string; day_of_week: number; day_of_month: number }>,
  ) => {
    const current = parseCron(setting.cron_expression);
    const freq = changes.frequency ?? setting.frequency;
    const dow = changes.day_of_week ?? setting.day_of_week;
    const dom = changes.day_of_month ?? setting.day_of_month;
    const hour = changes.hour ?? current.hour;
    const minute = changes.minute ?? current.minute;
    const newCron = buildCron(hour, minute, freq, dow, dom);
    const desc = buildDescription(hour, minute, freq, dow, dom);
    updateSetting(setting.id, {
      cron_expression: newCron,
      description: desc,
      frequency: freq,
      day_of_week: dow,
      day_of_month: dom,
    });
  };

  const triggerAutomation = async (taskKey: string) => {
    setTriggeringTask(taskKey);
    try {
      const data = await runAutomationTask(taskKey);
      toast({ title: "Done", description: data?.message || "Task completed successfully." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setTriggeringTask(null);
    }
  };

  const resetForm = () => {
    setFormStudentId("");
    setFormTeacherId("");
    setFormAdminId("");
    setFormAmount("");
    setFormInterval("monthly");
    setFormDayOfMonth("1");
    setFormNotes("");
    setFormCategory("other");
    setFormIsActive(true);
    setEditingTemplate(null);
  };

  const openCreateDialog = (type: string) => {
    resetForm();
    setFormType(type);
    setDialogOpen(true);
  };

  const openEditDialog = (tpl: RecurringTemplate) => {
    setEditingTemplate(tpl);
    setFormType(tpl.type);
    setFormStudentId(tpl.student_id || "");
    setFormTeacherId(tpl.teacher_id || "");
    setFormAdminId(tpl.admin_id || "");
    setFormAmount(String(tpl.amount));
    setFormInterval(tpl.interval);
    setFormDayOfMonth(String(tpl.day_of_month));
    setFormNotes(tpl.notes || "");
    setFormCategory(tpl.category || "other");
    setFormIsActive(tpl.is_active);
    setDialogOpen(true);
  };

  const handleSaveTemplate = async () => {
    if (!formAmount || Number(formAmount) <= 0) {
      toast({ title: "Error", description: "Amount must be greater than 0", variant: "destructive" });
      return;
    }
    if (formType === "fee" && !formStudentId) {
      toast({ title: "Error", description: "Select a student", variant: "destructive" });
      return;
    }
    if (formType === "salary" && !formTeacherId) {
      toast({ title: "Error", description: "Select a teacher", variant: "destructive" });
      return;
    }
    if (formType === "expense" && formCategory === "admin_personal" && !formAdminId) {
      toast({
        title: "Error",
        description: "Select an admin/co-admin for personal expenses",
        variant: "destructive",
      });
      return;
    }
    const payload: any = {
      type: formType,
      amount: Number(formAmount),
      interval: formInterval,
      day_of_month: Number(formDayOfMonth),
      notes: formNotes || null,
      is_active: formIsActive,
      student_id: formType === "fee" ? formStudentId : null,
      teacher_id: formType === "salary" ? formTeacherId : null,
      category: formType === "expense" ? formCategory : null,
      admin_id: formType === "expense" && formCategory === "admin_personal" ? formAdminId : null,
    };
    if (editingTemplate) {
      const { error } = await supabase.from("recurring_templates").update(payload).eq("id", editingTemplate.id);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Updated", description: "Template updated." });
    } else {
      payload.created_by = userId;
      const { error } = await supabase.from("recurring_templates").insert(payload);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Created", description: "Recurring template created." });
    }
    setDialogOpen(false);
    resetForm();
    loadData();
  };

  const deleteTemplate = async (id: string) => {
    const { error } = await supabase.from("recurring_templates").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Deleted", description: "Template removed." });
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  const toggleTemplateActive = async (tpl: RecurringTemplate, checked: boolean) => {
    const prev = [...templates];
    setTemplates((p) => p.map((t) => (t.id === tpl.id ? { ...t, is_active: checked } : t)));
    const { error } = await supabase
      .from("recurring_templates")
      .update({ is_active: checked })
      .eq("id", tpl.id);
    if (error) {
      setTemplates(prev);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const filteredTemplates = templates.filter((t) => t.type === templateTab);

  const getEntityLabel = (tpl: RecurringTemplate) => {
    if (tpl.type === "fee") return students.find((s) => s.id === tpl.student_id)?.label || "Unknown";
    if (tpl.type === "salary") return teachers.find((t) => t.id === tpl.teacher_id)?.label || "Unknown";
    if (tpl.type === "expense" && tpl.category === "admin_personal" && tpl.admin_id) {
      const admin = admins.find((a) => a.id === tpl.admin_id);
      return `Admin Personal — ${admin?.label || "Unknown"}`;
    }
    return tpl.category?.replace("_", " ") || "N/A";
  };

  const getDisplayLabel = (s: AutomationSetting) => FRIENDLY_LABELS[s.task_key] || s.label;

  if (loading) return <PageSkeleton />;

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container max-w-6xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <img src={logo} alt="4D Academy" className="w-8 h-8" />
          <div className="flex items-center gap-2 flex-1">
            <Zap className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold">Automations</h1>
          </div>
          <NotificationBell />
          <ThemeToggle />
        </div>
      </header>

      <main className="container max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Automated Tasks */}
        <Card>
          <CardHeader>
            <CardTitle>Automated Tasks</CardTitle>
            <CardDescription>
              Set the time for each task and run them manually when needed
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Task</TableHead>
                    <TableHead>How Often</TableHead>
                    <TableHead>Day</TableHead>
                    <TableHead>Run Time</TableHead>
                    <TableHead>Schedule</TableHead>
                    <TableHead>On/Off</TableHead>
                    <TableHead>Manual Run</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {settings.map((s) => {
                    const { hour, minute } = parseCron(s.cron_expression);
                    const needsDow = s.frequency === "weekly" || s.frequency === "fortnightly";
                    const needsDom = ["monthly", "quarterly", "half_yearly", "yearly"].includes(s.frequency);
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{getDisplayLabel(s)}</TableCell>
                        <TableCell>
                          <Select
                            value={s.frequency}
                            onValueChange={(v) => handleScheduleChange(s, { frequency: v })}
                          >
                            <SelectTrigger className="w-36">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {FREQUENCIES.map((f) => (
                                <SelectItem key={f.value} value={f.value}>
                                  {f.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {needsDow && (
                            <Select
                              value={String(s.day_of_week)}
                              onValueChange={(v) => handleScheduleChange(s, { day_of_week: parseInt(v) })}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {DAY_NAMES.map((d, i) => (
                                  <SelectItem key={i} value={String(i)}>
                                    {d}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          {needsDom && (
                            <Select
                              value={String(s.day_of_month)}
                              onValueChange={(v) => handleScheduleChange(s, { day_of_month: parseInt(v) })}
                            >
                              <SelectTrigger className="w-20">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from({ length: 28 }, (_, i) => (
                                  <SelectItem key={i + 1} value={String(i + 1)}>
                                    {i + 1}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          {!needsDow && !needsDom && <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Select
                              value={String(hour)}
                              onValueChange={(v) => handleScheduleChange(s, { hour: parseInt(v) })}
                            >
                              <SelectTrigger className="w-24">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from({ length: 24 }, (_, i) => (
                                  <SelectItem key={i} value={String(i)}>
                                    {i === 0 ? "12 AM" : i < 12 ? `${i} AM` : i === 12 ? "12 PM" : `${i - 12} PM`}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <span>:</span>
                            <Select
                              value={String(minute).padStart(2, "0")}
                              onValueChange={(v) => handleScheduleChange(s, { minute: parseInt(v) })}
                            >
                              <SelectTrigger className="w-20">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {MINUTES.map((m) => (
                                  <SelectItem key={m} value={m}>
                                    {m}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-xs">
                          {buildDescription(hour, minute, s.frequency, s.day_of_week, s.day_of_month)}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={s.enabled}
                            onCheckedChange={(checked) => updateSetting(s.id, { enabled: checked })}
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setConfirmRunTask(s.task_key)}
                            disabled={triggeringTask === s.task_key}
                          >
                            <Play className="h-3 w-3 mr-1" />
                            {triggeringTask === s.task_key ? "Running..." : "Run Now"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-4">
              {settings.map((s) => {
                const { hour, minute } = parseCron(s.cron_expression);
                const needsDow = s.frequency === "weekly" || s.frequency === "fortnightly";
                const needsDom = ["monthly", "quarterly", "half_yearly", "yearly"].includes(s.frequency);
                return (
                  <Card key={s.id} className="border-2">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="font-medium">{getDisplayLabel(s)}</div>
                        <Switch
                          checked={s.enabled}
                          onCheckedChange={(checked) => updateSetting(s.id, { enabled: checked })}
                        />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {buildDescription(hour, minute, s.frequency, s.day_of_week, s.day_of_month)}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Frequency</Label>
                          <Select
                            value={s.frequency}
                            onValueChange={(v) => handleScheduleChange(s, { frequency: v })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {FREQUENCIES.map((f) => (
                                <SelectItem key={f.value} value={f.value}>
                                  {f.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {needsDow && (
                          <div>
                            <Label className="text-xs">Day</Label>
                            <Select
                              value={String(s.day_of_week)}
                              onValueChange={(v) => handleScheduleChange(s, { day_of_week: parseInt(v) })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {DAY_NAMES.map((d, i) => (
                                  <SelectItem key={i} value={String(i)}>
                                    {d}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        {needsDom && (
                          <div>
                            <Label className="text-xs">Day of Month</Label>
                            <Select
                              value={String(s.day_of_month)}
                              onValueChange={(v) => handleScheduleChange(s, { day_of_month: parseInt(v) })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from({ length: 28 }, (_, i) => (
                                  <SelectItem key={i + 1} value={String(i + 1)}>
                                    {i + 1}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        <div>
                          <Label className="text-xs">Hour</Label>
                          <Select
                            value={String(hour)}
                            onValueChange={(v) => handleScheduleChange(s, { hour: parseInt(v) })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 24 }, (_, i) => (
                                <SelectItem key={i} value={String(i)}>
                                  {i === 0 ? "12 AM" : i < 12 ? `${i} AM` : i === 12 ? "12 PM" : `${i - 12} PM`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Minute</Label>
                          <Select
                            value={String(minute).padStart(2, "0")}
                            onValueChange={(v) => handleScheduleChange(s, { minute: parseInt(v) })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {MINUTES.map((m) => (
                                <SelectItem key={m} value={m}>
                                  {m}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <Button
                        className="w-full"
                        size="sm"
                        variant="outline"
                        onClick={() => setConfirmRunTask(s.task_key)}
                        disabled={triggeringTask === s.task_key}
                      >
                        <Play className="h-3 w-3 mr-1" />
                        {triggeringTask === s.task_key ? "Running..." : "Run Now"}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Recurring Dues Setup */}
        <Card>
          <CardHeader>
            <CardTitle>Recurring Dues Setup</CardTitle>
            <CardDescription>
              Set up one-time instructions to auto-create pending fees, salaries, or expenses every
              month/quarter/year
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={templateTab} onValueChange={setTemplateTab}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <TabsList>
                  <TabsTrigger value="fee">Fees</TabsTrigger>
                  <TabsTrigger value="salary">Salaries</TabsTrigger>
                  <TabsTrigger value="expense">Expenses</TabsTrigger>
                </TabsList>
                <Button size="sm" onClick={() => openCreateDialog(templateTab)}>
                  <Plus className="h-4 w-4 mr-1" /> Add Template
                </Button>
              </div>

              {["fee", "salary", "expense"].map((tab) => (
                <TabsContent key={tab} value={tab}>
                  {filteredTemplates.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground border rounded-md">
                      No {tab} templates yet. Click "Add Template" to create one.
                    </div>
                  ) : (
                    <>
                      {/* Desktop table */}
                      <div className="hidden md:block overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>
                                {tab === "fee" ? "Student" : tab === "salary" ? "Teacher" : "Category"}
                              </TableHead>
                              <TableHead>Amount</TableHead>
                              <TableHead>Repeat Every</TableHead>
                              <TableHead>Due Date (Day)</TableHead>
                              <TableHead>On/Off</TableHead>
                              <TableHead>Last Created On</TableHead>
                              <TableHead>Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredTemplates.map((tpl) => (
                              <TableRow key={tpl.id}>
                                <TableCell>{getEntityLabel(tpl)}</TableCell>
                                <TableCell>₹{tpl.amount}</TableCell>
                                <TableCell className="capitalize">{tpl.interval}</TableCell>
                                <TableCell>{tpl.day_of_month}</TableCell>
                                <TableCell>
                                  <Switch
                                    checked={tpl.is_active}
                                    onCheckedChange={(checked) => toggleTemplateActive(tpl, checked)}
                                  />
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {tpl.last_generated
                                    ? new Date(tpl.last_generated).toLocaleDateString()
                                    : "Never"}
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-1">
                                    <Button size="icon" variant="ghost" onClick={() => openEditDialog(tpl)}>
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => setConfirmDeleteId(tpl.id)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                      {/* Mobile cards */}
                      <div className="md:hidden space-y-3">
                        {filteredTemplates.map((tpl) => (
                          <Card key={tpl.id} className="border-2">
                            <CardContent className="p-4 space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="font-medium text-sm">{getEntityLabel(tpl)}</div>
                                <Switch
                                  checked={tpl.is_active}
                                  onCheckedChange={(checked) => toggleTemplateActive(tpl, checked)}
                                />
                              </div>
                              <div className="text-sm text-muted-foreground">
                                ₹{tpl.amount} · {tpl.interval} · day {tpl.day_of_month}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Last:{" "}
                                {tpl.last_generated
                                  ? new Date(tpl.last_generated).toLocaleDateString()
                                  : "Never"}
                              </div>
                              <div className="flex gap-2 pt-2">
                                <Button size="sm" variant="outline" className="flex-1" onClick={() => openEditDialog(tpl)}>
                                  <Pencil className="h-3 w-3 mr-1" /> Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="flex-1"
                                  onClick={() => setConfirmDeleteId(tpl.id)}
                                >
                                  <Trash2 className="h-3 w-3 mr-1" /> Delete
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      </main>

      {/* Template Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Edit" : "Add"}{" "}
              {formType === "fee" ? "Fee" : formType === "salary" ? "Salary" : "Expense"} Template
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {formType === "fee" && (
              <div>
                <Label>Student</Label>
                <Select value={formStudentId} onValueChange={setFormStudentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select student" />
                  </SelectTrigger>
                  <SelectContent>
                    {students.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {formType === "salary" && (
              <div>
                <Label>Teacher</Label>
                <Select value={formTeacherId} onValueChange={setFormTeacherId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select teacher" />
                  </SelectTrigger>
                  <SelectContent>
                    {teachers.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {formType === "expense" && (
              <>
                <div>
                  <Label>Category</Label>
                  <Select value={formCategory} onValueChange={setFormCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPENSE_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c.replace("_", " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {formCategory === "admin_personal" && isMainAdmin && (
                  <div>
                    <Label>Admin / Co-Admin</Label>
                    <Select value={formAdminId} onValueChange={setFormAdminId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select admin" />
                      </SelectTrigger>
                      <SelectContent>
                        {admins.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}
            <div>
              <Label>Amount (₹)</Label>
              <Input
                type="number"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Repeat Every</Label>
                <Select value={formInterval} onValueChange={setFormInterval}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INTERVALS.map((i) => (
                      <SelectItem key={i} value={i}>
                        {i}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Day of Month</Label>
                <Select value={formDayOfMonth} onValueChange={setFormDayOfMonth}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 28 }, (_, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>
                        {i + 1}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} rows={2} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={formIsActive} onCheckedChange={setFormIsActive} />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveTemplate}>{editingTemplate ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Run Now confirm */}
      <AlertDialog open={!!confirmRunTask} onOpenChange={(open) => !open && setConfirmRunTask(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Run this task now?</AlertDialogTitle>
            <AlertDialogDescription>
              This will run the task immediately, in addition to its normal schedule.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmRunTask) triggerAutomation(confirmRunTask);
                setConfirmRunTask(null);
              }}
            >
              Run Now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirm */}
      <AlertDialog open={!!confirmDeleteId} onOpenChange={(open) => !open && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete template?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDeleteId) deleteTemplate(confirmDeleteId);
                setConfirmDeleteId(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BottomNav role="admin" />
    </div>
  );
};

export default Automations;
