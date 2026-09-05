import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/shared/BottomNav";
import PageSkeleton from "@/components/shared/PageSkeleton";
import DateRangePicker from "@/components/shared/DateRangePicker";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, FileDown, ChevronRight, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { exportToCSV, formatDateForExport } from "@/lib/csvExport";
import { DateRange } from "@/lib/dateRange";
import { useFinancialYearFreeze } from "@/hooks/useFinancialYearFreeze";
import {
  CoverageDomain, CoverageSession, fetchStudentCoverage, fetchTeacherCoverage, summarizeCoverage,
} from "@/hooks/useAttendanceCoverage";

const ALL = "__all__";

function defaultRange(): DateRange {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  return { from, to };
}

const AttendanceCoverage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isDateFrozen } = useFinancialYearFreeze();

  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [domain, setDomain] = useState<CoverageDomain>("students");
  const [range, setRange] = useState<DateRange | undefined>(defaultRange());
  const [sessions, setSessions] = useState<CoverageSession[]>([]);
  const [classFilter, setClassFilter] = useState<string>(ALL);
  const [batchFilter, setBatchFilter] = useState<string>(ALL);
  const [stateFilter, setStateFilter] = useState<string>("missing");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/"); return; }
      const [a, c] = await Promise.all([supabase.rpc("is_admin"), supabase.rpc("is_co_admin")]);
      if (!a.data && !c.data) { navigate("/"); return; }
      setAuthChecked(true);
    })();
  }, []);

  useEffect(() => { if (authChecked) load(); }, [authChecked, domain, range?.from, range?.to]);

  const load = async () => {
    setLoading(true);
    try {
      const from = range?.from ?? defaultRange().from!;
      const to = range?.to ?? range?.from ?? new Date();
      const rows = domain === "students"
        ? await fetchStudentCoverage(from, to)
        : await fetchTeacherCoverage(from, to);
      setSessions(rows.filter((s) => !isDateFrozen(s.date)));
    } catch (e: any) {
      toast({ variant: "destructive", title: "Could not load coverage", description: e.message });
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  const classOptions = useMemo(
    () => [...new Set(sessions.map((s) => s.class).filter(Boolean) as string[])].sort(), [sessions]);
  const batchOptions = useMemo(
    () => [...new Set(sessions.filter((s) => classFilter === ALL || s.class === classFilter)
      .map((s) => s.section).filter(Boolean) as string[])].sort(), [sessions, classFilter]);

  const scoped = useMemo(() => sessions.filter((s) =>
    (classFilter === ALL || s.class === classFilter) && (batchFilter === ALL || s.section === batchFilter)
  ), [sessions, classFilter, batchFilter]);

  const visible = useMemo(
    () => scoped.filter((s) => stateFilter === ALL || s.state === stateFilter), [scoped, stateFilter]);

  const summary = useMemo(() => summarizeCoverage(scoped), [scoped]);

  const openSession = (s: CoverageSession) => {
    const base = domain === "students" ? "/admin/attendance" : "/admin/teacher-attendance";
    navigate(`${base}?class=${s.classId}&date=${s.date}`);
  };

  const handleExport = () => {
    exportToCSV(visible.map((s) => ({
      date: formatDateForExport(s.date),
      subject: s.subject,
      class: s.class || "",
      batch: s.section || "",
      expected: s.expected,
      marked: s.marked,
      status: s.state,
    })), [
      { key: "date", label: "date" },
      { key: "subject", label: "subject" },
      { key: "class", label: "class" },
      { key: "batch", label: "batch" },
      { key: "expected", label: "expected" },
      { key: "marked", label: "marked" },
      { key: "status", label: "status" },
    ], `attendance-coverage-${domain}`);
    navigate("/preview-download");
  };

  if (!authChecked) return <PageSkeleton />;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/dashboard")} aria-label="Go back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Attendance Coverage</h1>
            <p className="text-sm text-muted-foreground">Find class sessions where attendance is still missing</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        <Tabs value={domain} onValueChange={(v) => setDomain(v as CoverageDomain)}>
          <TabsList>
            <TabsTrigger value="students">Students</TabsTrigger>
            <TabsTrigger value="teachers">Teachers</TabsTrigger>
          </TabsList>
        </Tabs>

        <Card>
          <CardHeader><CardTitle className="text-base">Filters</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <DateRangePicker value={range} onChange={(r) => setRange(r ?? defaultRange())} allowClear={false} />
            <Select value={classFilter} onValueChange={(v) => { setClassFilter(v); setBatchFilter(ALL); }}>
              <SelectTrigger><SelectValue placeholder="Class" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All classes</SelectItem>
                {classOptions.map((c) => <SelectItem key={c} value={c}>Class {c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={batchFilter} onValueChange={setBatchFilter}>
              <SelectTrigger><SelectValue placeholder="Batch" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All batches</SelectItem>
                {batchOptions.map((b) => <SelectItem key={b} value={b}>Batch {b}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={stateFilter} onValueChange={setStateFilter}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All sessions</SelectItem>
                <SelectItem value="missing">Not marked</SelectItem>
                <SelectItem value="partial">Partly marked</SelectItem>
                <SelectItem value="complete">Fully marked</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="pt-6 text-center"><div className="text-3xl font-bold">{summary.expectedSessions}</div><p className="text-xs text-muted-foreground">Scheduled sessions</p></CardContent></Card>
          <Card><CardContent className="pt-6 text-center"><div className="text-3xl font-bold text-destructive">{summary.missing}</div><p className="text-xs text-muted-foreground">Not marked</p></CardContent></Card>
          <Card><CardContent className="pt-6 text-center"><div className="text-3xl font-bold text-amber-600">{summary.partial}</div><p className="text-xs text-muted-foreground">Partly marked</p></CardContent></Card>
          <Card><CardContent className="pt-6 text-center"><div className="text-3xl font-bold text-emerald-600">{summary.complete}</div><p className="text-xs text-muted-foreground">Fully marked</p></CardContent></Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle>Sessions</CardTitle>
                <CardDescription>{visible.length} sessions · tap a row to mark attendance</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={load} disabled={loading}>
                  <RefreshCw className="h-4 w-4 mr-2" />Refresh
                </Button>
                <Button variant="outline" onClick={handleExport} disabled={visible.length === 0}>
                  <FileDown className="h-4 w-4 mr-2" />Export CSV
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center text-muted-foreground py-8">Checking scheduled sessions…</p>
            ) : visible.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nothing outstanding for these filters.</p>
            ) : (
              <div className="space-y-3 max-h-[520px] overflow-y-auto">
                {visible.map((s) => (
                  <button key={s.key} onClick={() => openSession(s)}
                    className="w-full flex items-center justify-between gap-3 p-3 border rounded-lg text-left hover:bg-muted/50 transition-colors">
                    <div>
                      <p className="font-medium">{s.subject}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(`${s.date}T00:00:00`), "PPP")}
                        {s.class ? ` · Class ${s.class}` : ""}
                        {s.section ? ` · Batch ${s.section}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={s.state === "complete" ? "default" : s.state === "partial" ? "secondary" : "destructive"}>
                        {s.marked} of {s.expected} marked
                      </Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <BottomNav role="admin" />
      <div className="h-16 md:hidden" />
    </div>
  );
};

export default AttendanceCoverage;
