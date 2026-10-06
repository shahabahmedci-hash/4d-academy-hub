import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";

export interface Slot { day_of_week: number; start_time: string; end_time: string }
export interface ImpactRow {
  session_date: string;
  action: "add" | "remove" | "time_change" | "kept_with_attendance" | "unchanged";
  old_time: string | null;
  new_time: string | null;
  attendance_count: number;
}

export async function previewScheduleChange(classId: string, effectiveFrom: string, slots: Slot[]): Promise<ImpactRow[]> {
  const { data, error } = await (supabase.rpc as any)("preview_schedule_change", {
    _class_id: classId, _effective_from: effectiveFrom, _slots: slots,
  });
  if (error) throw error;
  return ((data || []) as ImpactRow[]).filter((r) => r.action !== "unchanged");
}

/** Confirmation is needed when a change touches past dates or existing attendance. */
export const needsConfirmation = (rows: ImpactRow[]) => {
  const today = format(new Date(), "yyyy-MM-dd");
  return rows.some((r) => r.session_date <= today || r.attendance_count > 0);
};

const LABEL: Record<ImpactRow["action"], string> = {
  add: "New session",
  remove: "Removed",
  time_change: "Time changed",
  kept_with_attendance: "Kept (has attendance)",
  unchanged: "Unchanged",
};

const fmt = (d: string) => format(new Date(`${d}T00:00:00`), "EEE d MMM yyyy");

export function ScheduleImpactDialog({ rows, open, onCancel, onConfirm, busy }: {
  rows: ImpactRow[] | null; open: boolean; onCancel: () => void; onConfirm: () => void; busy?: boolean;
}) {
  const r = rows || [];
  const count = (a: ImpactRow["action"]) => r.filter((x) => x.action === a).length;
  const today = format(new Date(), "yyyy-MM-dd");
  const past = r.filter((x) => x.session_date <= today);
  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Check the impact of this change</AlertDialogTitle>
          <AlertDialogDescription>
            {count("add")} new · {count("remove")} removed · {count("time_change")} time changed · {count("kept_with_attendance")} kept because attendance exists.
            Attendance is never deleted.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {past.length === 0 && <p className="text-sm text-muted-foreground">Only future dates are affected.</p>}
          {past.map((x) => (
            <div key={x.session_date} className="flex items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-sm">
              <span>{fmt(x.session_date)}</span>
              <span className="text-muted-foreground">{x.old_time ?? "—"} → {x.new_time ?? "—"}</span>
              <Badge variant={x.action === "remove" ? "destructive" : x.action === "kept_with_attendance" ? "outline" : "secondary"}>
                {LABEL[x.action]}{x.attendance_count > 0 ? ` · ${x.attendance_count} marked` : ""}
              </Badge>
            </div>
          ))}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={(e) => { e.preventDefault(); onConfirm(); }} disabled={busy}>
            {busy ? "Applying..." : "Apply change"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
