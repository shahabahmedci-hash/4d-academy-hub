import { useEffect, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Row { domain: string; record_id: string; class_id: string; date: string; person_id: string; status: string }

/** Existing attendance that falls outside any scheduled session — shown for review, never changed. */
const OffScheduleReview = () => {
  const [rows, setRows] = useState<(Row & { label: string })[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase.rpc as any)("get_off_schedule_attendance");
      const list = (data || []) as Row[];
      if (list.length === 0) { setRows([]); return; }
      const { data: cls } = await supabase.from("classes").select("id, subject, class, section")
        .in("id", [...new Set(list.map((r) => r.class_id))]);
      const map = new Map((cls || []).map((c) => [c.id, `${c.subject}${c.class ? ` — Class ${c.class}` : ""}${c.section ? ` (Batch ${c.section})` : ""}`]));
      setRows(list.map((r) => ({ ...r, label: map.get(r.class_id) || "Unknown class" })));
    })();
  }, []);

  if (rows.length === 0) return null;
  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="text-base">Needs review: attendance outside the schedule ({rows.length})</CardTitle>
        <CardDescription>
          These saved records are on dates when the class had no scheduled session. They are kept as-is and not counted as sessions.
          Add an extra/rescheduled session for the date if the class really met.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map((r) => (
          <div key={r.record_id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
            <span>{format(new Date(`${r.date}T00:00:00`), "EEE, d MMM yyyy")} · {r.label}</span>
            <span className="flex gap-2">
              <Badge variant="outline">{r.domain === "teachers" ? "Teacher" : "Student"}</Badge>
              <Badge variant="secondary" className="capitalize">{r.status}</Badge>
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default OffScheduleReview;
