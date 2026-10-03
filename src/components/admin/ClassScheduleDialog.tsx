import { useEffect, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DAY_NAMES } from "@/lib/sessionDates";

interface Period { id: string; day_of_week: number; start_time: string; end_time: string; effective_from: string; effective_to: string | null }
interface Exception { id: string; date: string; type: string; new_date: string | null; new_start_time: string | null; new_end_time: string | null; note: string | null }

const db = supabase as any;
const fmt = (d: string) => format(new Date(`${d}T00:00:00`), "d MMM yyyy");

export function ClassScheduleDialog({ classId, title, open, onOpenChange }: {
  classId: string; title: string; open: boolean; onOpenChange: (o: boolean) => void;
}) {
  const { toast } = useToast();
  const [periods, setPeriods] = useState<Period[]>([]);
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [type, setType] = useState("cancelled");
  const [date, setDate] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [note, setNote] = useState("");

  const load = async () => {
    const [p, e] = await Promise.all([
      db.from("class_schedules").select("*").eq("class_id", classId).order("effective_from", { ascending: false }),
      db.from("schedule_exceptions").select("*").eq("class_id", classId).order("date", { ascending: false }),
    ]);
    setPeriods(p.data || []);
    setExceptions(e.data || []);
  };
  useEffect(() => { if (open) load(); }, [open, classId]);

  const add = async () => {
    if (!date) return;
    const row: any = { class_id: classId, date, type, note: note || null };
    if (type === "rescheduled") {
      if (!newDate) { toast({ variant: "destructive", title: "Pick the new date" }); return; }
      row.new_date = newDate;
    }
    if (type !== "cancelled") { row.new_start_time = newStart || null; row.new_end_time = newEnd || null; }
    const { error } = await db.from("schedule_exceptions").insert(row);
    if (error) { toast({ variant: "destructive", title: "Error", description: error.message }); return; }
    setDate(""); setNewDate(""); setNote(""); setNewStart(""); setNewEnd("");
    load();
  };

  const remove = async (id: string) => {
    const { error } = await db.from("schedule_exceptions").delete().eq("id", id);
    if (error) toast({ variant: "destructive", title: "Error", description: error.message });
    load();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Schedule — {title}</DialogTitle>
          <DialogDescription>Timetable history and one-off changes. Past periods are kept as they were.</DialogDescription>
        </DialogHeader>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Timetable periods</h3>
          {periods.length === 0 && <p className="text-sm text-muted-foreground">No timetable yet.</p>}
          {periods.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
              <span className="font-medium">{DAY_NAMES[p.day_of_week]} {p.start_time.slice(0, 5)}–{p.end_time.slice(0, 5)}</span>
              <span className="text-muted-foreground">{fmt(p.effective_from)} → {p.effective_to ? fmt(p.effective_to) : "onward"}</span>
              {!p.effective_to && <Badge>Current</Badge>}
            </div>
          ))}
          <p className="text-xs text-muted-foreground">To change the weekday or time, use Edit Class and pick the date it applies from.</p>
        </section>

        <section className="space-y-3 pt-2">
          <h3 className="text-sm font-semibold">Cancelled, rescheduled & extra sessions</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="rescheduled">Rescheduled</SelectItem>
                  <SelectItem value="extra">Extra session</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{type === "extra" ? "Session date" : "Original session date"}</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            {type === "rescheduled" && (
              <div className="space-y-1">
                <Label>Moved to</Label>
                <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
              </div>
            )}
            {type !== "cancelled" && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1"><Label>Start</Label><Input type="time" value={newStart} onChange={(e) => setNewStart(e.target.value)} /></div>
                <div className="space-y-1"><Label>End</Label><Input type="time" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} /></div>
              </div>
            )}
            <div className="space-y-1 sm:col-span-2">
              <Label>Note</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional reason" />
            </div>
          </div>
          <Button size="sm" onClick={add} disabled={!date}>Add</Button>

          <div className="space-y-2">
            {exceptions.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                <div>
                  <Badge variant={e.type === "cancelled" ? "destructive" : "secondary"} className="mr-2 capitalize">{e.type}</Badge>
                  {fmt(e.date)}{e.new_date ? ` → ${fmt(e.new_date)}` : ""}
                  {e.note && <span className="text-muted-foreground"> · {e.note}</span>}
                </div>
                <Button variant="ghost" size="icon" onClick={() => remove(e.id)} aria-label="Remove"><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
        </section>
      </DialogContent>
    </Dialog>
  );
}

export function HolidaysDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<{ id: string; date: string; label: string }[]>([]);
  const [date, setDate] = useState("");
  const [label, setLabel] = useState("");
  const load = async () => {
    const { data } = await db.from("holidays").select("*").order("date", { ascending: false });
    setRows(data || []);
  };
  useEffect(() => { if (open) load(); }, [open]);
  const add = async () => {
    const { error } = await db.from("holidays").insert({ date, label });
    if (error) { toast({ variant: "destructive", title: "Error", description: error.message }); return; }
    setDate(""); setLabel(""); load();
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Holidays</DialogTitle>
          <DialogDescription>No classes run on these dates, so nothing shows as unmarked.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Diwali" />
          <Button onClick={add} disabled={!date || !label.trim()}>Add</Button>
        </div>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <span>{fmt(r.date)} — {r.label}</span>
              <Button variant="ghost" size="icon" aria-label="Remove" onClick={async () => { await db.from("holidays").delete().eq("id", r.id); load(); }}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
